import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { setActiveRoute } from "../../src/utils/routes";
import { clearMounts, getFakeWorker, installFakeWorker, loadUseTimer, mount } from "./timer-test-harness";

let useTimer: (durationSeconds: number, routeKey?: string, mode?: import("../../src/types").TimerMode) => number;

const Probe = ({ duration, routeKey }: { duration: number; routeKey?: string }) => {
  const value = useTimer(duration, routeKey);
  return <output>{value}</output>;
};

beforeAll(async () => {
  installFakeWorker();
  useTimer = await loadUseTimer();
});

beforeEach(() => {
  getFakeWorker().messages.length = 0;
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

  it("does not unregister the pathname default on unmount", () => {
    const mounted = mount(<Probe duration={60} />);
    const worker = getFakeWorker();

    expect(worker.messages.filter(({ type }) => type === "register")).toHaveLength(1);

    act(() => {
      mounted.root.unmount();
    });

    expect(worker.messages.some(({ type }) => type === "unregister")).toBe(false);
    expect(worker.messages.filter(({ type }) => type === "register")).toHaveLength(1);
    expect(worker.messages.find(({ type }) => type === "register")?.routeKey).toBe(window.location.pathname);
  });

  it("setActiveRoute purges pathname timers after useTimer mount", () => {
    const worker = getFakeWorker();
    const pathname = window.location.pathname;
    mount(<Probe duration={60} />);

    expect(worker.messages.filter(({ type }) => type === "register")).toHaveLength(1);
    expect(worker.messages[0]).toMatchObject({
      type: "register",
      routeKey: pathname,
      mode: "down",
      durationSeconds: 60,
    });

    act(() => {
      setActiveRoute("/other-route");
    });

    expect(worker.messages.at(-1)).toMatchObject({
      type: "route",
      activeRoute: "/other-route",
    });
  });
});
