import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TimerWorkerIncomingMessage, TimerWorkerMessage } from "../../src/types";

describe("timer worker", () => {
  let handleMessage: (event: MessageEvent<TimerWorkerIncomingMessage>) => void;
  let outgoing: TimerWorkerMessage[];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T22:00:00.100Z"));
    vi.resetModules();
    outgoing = [];

    vi.stubGlobal("self", {
      addEventListener: (type: string, listener: (event: MessageEvent<TimerWorkerIncomingMessage>) => void): void => {
        if (type === "message") handleMessage = listener;
      },
      postMessage: (message: TimerWorkerMessage): void => {
        outgoing.push(message);
      },
    });

    await import("../../src/worker/timer.worker");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const send = (data: TimerWorkerIncomingMessage): void => {
    handleMessage({ data } as MessageEvent<TimerWorkerIncomingMessage>);
  };

  it("expires a zero-duration countdown once and leaves no scheduled work", () => {
    send({ type: "register", routeKey: "zero", id: "zero", mode: "down", durationSeconds: 0 });

    expect(outgoing).toEqual([{ type: "expired", id: "zero" }]);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(outgoing).toEqual([{ type: "expired", id: "zero" }]);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "normalizes an invalid %s countdown at the worker boundary",
    (durationSeconds) => {
      send({ type: "register", routeKey: "invalid", id: "invalid", mode: "down", durationSeconds });

      expect(outgoing).toEqual([{ type: "expired", id: "invalid" }]);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("floors a fractional countdown at the worker boundary", () => {
    send({ type: "register", routeKey: "fraction", id: "fraction", mode: "down", durationSeconds: 1.9 });

    expect(outgoing).toEqual([{ type: "tick", id: "fraction", mode: "down", secondsLeft: 1 }]);
  });

  it("projects only the newly registered timer", () => {
    send({ type: "register", routeKey: "group", id: "a", mode: "up" });
    outgoing = [];
    vi.setSystemTime(new Date("2026-10-08T22:00:01.100Z"));

    send({ type: "register", routeKey: "group", id: "b", mode: "up" });

    expect(outgoing).toEqual([{ type: "tick", id: "b", mode: "up", secondsElapsed: 0 }]);
  });

  it("stops scheduled work after the last timer unregisters", () => {
    send({ type: "register", routeKey: "group", id: "timer", mode: "up" });
    expect(vi.getTimerCount()).toBe(1);

    send({ type: "unregister", routeKey: "group", id: "timer" });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts registrations before the first route message", () => {
    send({ type: "register", routeKey: "first", id: "first", mode: "up" });
    send({ type: "register", routeKey: "second", id: "second", mode: "up" });

    expect(outgoing).toEqual([
      { type: "tick", id: "first", mode: "up", secondsElapsed: 0 },
      { type: "tick", id: "second", mode: "up", secondsElapsed: 0 },
    ]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("silently rejects inactive countdown and count-up registrations without scheduling work", () => {
    send({ type: "route", activeRoute: "active" });
    send({ type: "register", routeKey: "inactive", id: "countdown", mode: "down", durationSeconds: 0 });
    send({ type: "register", routeKey: "inactive", id: "count-up", mode: "up" });

    expect(outgoing).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(outgoing).toEqual([]);
  });

  it("treats unregister after a rejected registration as an idempotent no-op", () => {
    send({ type: "route", activeRoute: "active" });
    send({ type: "register", routeKey: "inactive", id: "ignored", mode: "up" });

    send({ type: "unregister", routeKey: "inactive", id: "ignored" });
    send({ type: "unregister", routeKey: "inactive", id: "ignored" });

    expect(outgoing).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("projects and schedules a registration matching the active route", () => {
    send({ type: "route", activeRoute: "active" });
    send({ type: "register", routeKey: "active", id: "accepted", mode: "up" });

    expect(outgoing).toEqual([{ type: "tick", id: "accepted", mode: "up", secondsElapsed: 0 }]);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1900);
    expect(outgoing.at(-1)).toEqual({ type: "tick", id: "accepted", mode: "up", secondsElapsed: 1 });
  });

  it("accepts an empty-string active route and rejects other route keys", () => {
    send({ type: "route", activeRoute: "" });
    send({ type: "register", routeKey: "other", id: "rejected", mode: "up" });
    send({ type: "register", routeKey: "", id: "accepted", mode: "up" });

    expect(outgoing).toEqual([{ type: "tick", id: "accepted", mode: "up", secondsElapsed: 0 }]);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("does not revive a purged timer from a delayed inactive registration", () => {
    send({ type: "register", routeKey: "old", id: "timer", mode: "up" });
    send({ type: "route", activeRoute: "new" });
    outgoing = [];

    send({ type: "register", routeKey: "old", id: "timer", mode: "up" });

    expect(outgoing).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(outgoing).toEqual([]);
  });

  it("removes the final expired timer and stops scheduled work", () => {
    send({ type: "register", routeKey: "group", id: "countdown", mode: "down", durationSeconds: 1 });
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1900);

    expect(outgoing.at(-1)).toEqual({ type: "expired", id: "countdown" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
