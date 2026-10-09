import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  clearMounts,
  getFakeWorker,
  installFakeWorker,
  loadUseTimer,
  mount,
} from "./timer-test-harness";

let useTimer: (durationSeconds: number, routeKey?: string, mode?: import("../../src/types").TimerMode) => number;

const Probe = ({ duration, routeKey }: { duration: number; routeKey?: string }) => {
  const value = useTimer(duration, routeKey);
  return <output>{value}</output>;
};

beforeAll(async () => {
  installFakeWorker();
  useTimer = await loadUseTimer();
});

afterEach(() => {
  clearMounts();
});

describe("useTimer default route", () => {
  it("registers with the pathname default when routeKey is omitted", () => {
    const mounted = mount(<Probe duration={60} />);
    const worker = getFakeWorker();
    const expected = window.location.pathname;

    expect(mounted.container.querySelector("output")?.textContent).toBe("60");
    expect(worker.messages.at(-1)).toMatchObject({
      type: "register",
      routeKey: expected,
      mode: "down",
      durationSeconds: 60,
    });
  });

  it("registers immediately with an explicit routeKey", () => {
    const mounted = mount(<Probe duration={60} routeKey="/explicit" />);
    const worker = getFakeWorker();

    expect(mounted.container.querySelector("output")?.textContent).toBe("60");
    expect(worker.messages.at(-1)).toMatchObject({
      type: "register",
      routeKey: "/explicit",
      mode: "down",
      durationSeconds: 60,
    });
  });

  it("unregisters the pathname default on unmount", () => {
    const mounted = mount(<Probe duration={60} />);
    const worker = getFakeWorker();
    const registration = worker.messages.at(-1);

    act(() => {
      mounted.root.unmount();
    });

    expect(worker.messages.at(-1)).toEqual({
      type: "unregister",
      routeKey: registration?.routeKey,
      id: registration?.id,
    });
    expect(registration?.routeKey).toBe(window.location.pathname);
  });
});
