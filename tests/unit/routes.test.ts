import { afterEach, describe, expect, it, vi } from "vitest";

import { getDefaultRouteKey, setActiveRoute } from "../../src/utils/routes";

describe("routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns window.location.pathname as the default route key", () => {
    vi.stubGlobal("window", { location: { pathname: "/workspace-1" } });
    expect(getDefaultRouteKey()).toBe("/workspace-1");
  });

  it("throws on the server when window is missing", () => {
    expect(getDefaultRouteKey).toThrow(
      "@mainframework/timer is client-side only and requires a window environment.",
    );
  });

  it("broadcasts the active route to the worker", () => {
    const posted: unknown[] = [];
    vi.stubGlobal("window", { location: { pathname: "/" } });
    vi.stubGlobal(
      "Worker",
      class {
        postMessage = (message: unknown): void => {
          posted.push(message);
        };

        addEventListener = (): void => {};
      },
    );

    setActiveRoute("current-workspace");

    expect(posted).toEqual([{ type: "route", activeRoute: "current-workspace" }]);
  });
});
