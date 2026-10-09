import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TimerWorkerIncomingMessage, TimerWorkerMessage } from "../../src/types";

describe("timer worker edges", () => {
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

  it("expires a zero-duration countdown once with no scheduled work", () => {
    send({ type: "register", routeKey: "zero", id: "zero", mode: "down", durationSeconds: 0 });

    expect(outgoing).toEqual([{ type: "expired", id: "zero" }]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "normalizes invalid countdown %s at the worker boundary",
    (durationSeconds) => {
      send({ type: "register", routeKey: "invalid", id: "invalid", mode: "down", durationSeconds });

      expect(outgoing).toEqual([{ type: "expired", id: "invalid" }]);
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

  it("silently discards inactive registrations after the active route is set", () => {
    send({ type: "route", activeRoute: "active" });
    send({ type: "register", routeKey: "inactive", id: "countdown", mode: "down", durationSeconds: 5 });
    send({ type: "register", routeKey: "inactive", id: "count-up", mode: "up" });

    expect(outgoing).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the empty-string group when it becomes authoritative", () => {
    send({ type: "register", routeKey: "", id: "kept", mode: "up" });
    send({ type: "register", routeKey: "removed", id: "removed", mode: "up" });
    send({ type: "route", activeRoute: "" });
    outgoing = [];

    vi.advanceTimersByTime(1900);

    expect(outgoing).toEqual([{ type: "tick", id: "kept", mode: "up", secondsElapsed: 1 }]);
  });
});
