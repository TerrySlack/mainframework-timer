import { StrictMode, act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { TimerMode } from "../../src/types";
import {
  clearMounts,
  getFakeWorker,
  installFakeWorker,
  loadUseTimer,
  mount,
} from "./timer-test-harness";

let useTimer: (durationSeconds: number, routeKey?: string, mode?: TimerMode) => number;

const Probe = ({
  duration,
  routeKey,
  mode,
}: {
  duration: number;
  routeKey?: string;
  mode?: TimerMode;
}) => {
  const value = useTimer(duration, routeKey, mode);
  return <output>{value}</output>;
};

beforeAll(async () => {
  installFakeWorker();
  useTimer = await loadUseTimer();
});

beforeEach(() => {
  const worker = getFakeWorker();
  worker.messages.length = 0;
});

afterEach(() => {
  clearMounts();
});

describe("useTimer hook", () => {
  it("registers again after the Strict Mode cleanup cycle and unregisters the live timer", () => {
    const mounted = mount(
      <StrictMode>
        <Probe duration={10} routeKey="strict" />
      </StrictMode>,
    );
    const worker = getFakeWorker();

    expect(worker.messages.map(({ type }) => type)).toEqual(["register", "unregister"]);
    const liveRegistration = worker.messages[0];
    expect(liveRegistration?.type).toBe("register");

    act(() => {
      mounted.root.unmount();
    });

    expect(worker.messages.at(-1)).toEqual({
      type: "unregister",
      routeKey: "strict",
      id: liveRegistration?.id,
    });
  });

  it("does not register again for an unchanged render", () => {
    const mounted = mount(<Probe duration={10} routeKey="stable" />);
    const worker = getFakeWorker();
    const messageCount = worker.messages.length;

    act(() => {
      mounted.root.render(<Probe duration={10} routeKey="stable" />);
    });

    expect(worker.messages).toHaveLength(messageCount);
  });

  it("posts a new register when duration or mode changes and shows raw countdown duration", () => {
    const mounted = mount(<Probe duration={1.9} routeKey="countdown" />);
    const worker = getFakeWorker();
    const output = mounted.container.querySelector("output");

    expect(output?.textContent).toBe("1.9");

    act(() => {
      mounted.root.render(<Probe duration={4.8} routeKey="countdown" />);
    });

    expect(output?.textContent).toBe("1.9");
    expect(worker.messages.at(-1)).toMatchObject({
      type: "register",
      routeKey: "countdown",
      mode: "down",
      durationSeconds: 4.8,
    });

    act(() => {
      mounted.root.render(<Probe duration={4.8} routeKey="countdown" mode="up" />);
    });

    expect(output?.textContent).toBe("1.9");
    expect(worker.messages.at(-1)).toMatchObject({
      type: "register",
      routeKey: "countdown",
      mode: "up",
      durationSeconds: 4.8,
    });
  });

  it("updates output from worker tick and expired messages", () => {
    const mounted = mount(<Probe duration={10} routeKey="ticks" mode="down" />);
    const worker = getFakeWorker();
    const registration = worker.messages.at(-1);
    const output = mounted.container.querySelector("output");
    const id = registration?.id ?? "";

    act(() => {
      worker.emit({ type: "tick", id, mode: "down", secondsLeft: 7 });
    });
    expect(output?.textContent).toBe("7");

    act(() => {
      mounted.root.render(<Probe duration={0} routeKey="ticks-up" mode="up" />);
    });
    const upRegistration = worker.messages.at(-1);
    const upId = upRegistration?.id ?? "";

    act(() => {
      worker.emit({ type: "tick", id: upId, mode: "up", secondsElapsed: 3 });
    });
    expect(output?.textContent).toBe("3");

    act(() => {
      worker.emit({ type: "expired", id: upId });
    });
    expect(output?.textContent).toBe("0");
  });

  it("keeps independent React roots isolated", () => {
    const first = mount(<Probe duration={10} routeKey="roots" />);
    const worker = getFakeWorker();
    const firstRegistration = worker.messages.at(-1);
    const second = mount(<Probe duration={10} routeKey="roots" />);
    const secondRegistration = worker.messages.at(-1);

    expect(firstRegistration?.id).not.toBe(secondRegistration?.id);

    act(() => {
      worker.emit({
        type: "tick",
        id: firstRegistration?.id ?? "",
        mode: "down",
        secondsLeft: 8,
      });
    });

    expect(first.container.querySelector("output")?.textContent).toBe("8");
    expect(second.container.querySelector("output")?.textContent).toBe("10");
  });

  it("does not re-register when routeKey changes but unregisters with the latest routeKey prop", () => {
    const mounted = mount(<Probe duration={10} routeKey="route-a" />);
    const worker = getFakeWorker();
    const registration = worker.messages.at(-1);

    act(() => {
      mounted.root.render(<Probe duration={10} routeKey="route-b" />);
    });

    expect(worker.messages.map(({ type }) => type)).toEqual(["register", "unregister"]);
    expect(registration?.routeKey).toBe("route-a");
    expect(worker.messages.at(-1)).toMatchObject({ type: "unregister", routeKey: "route-a" });

    act(() => {
      mounted.root.unmount();
    });

    expect(worker.messages.at(-1)).toEqual({
      type: "unregister",
      routeKey: "route-b",
      id: registration?.id,
    });
  });

  it("applies a stale tick after duration changes when the timer id is unchanged", () => {
    const mounted = mount(<Probe duration={10} routeKey="stale" />);
    const worker = getFakeWorker();
    const registration = worker.messages.at(-1);
    const id = registration?.id ?? "";
    const output = mounted.container.querySelector("output");

    act(() => {
      mounted.root.render(<Probe duration={20} routeKey="stale" />);
    });

    act(() => {
      worker.emit({ type: "tick", id, mode: "down", secondsLeft: 3 });
    });

    expect(output?.textContent).toBe("3");
  });
});
