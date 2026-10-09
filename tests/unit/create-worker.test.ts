import { afterEach, describe, expect, it, vi } from "vitest";

describe("createWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("throws on the server when window is missing", async () => {
    const { createWorker } = await import("../../src/worker/createWorker");
    expect(createWorker).toThrow(
      "@mainframework/timer is client-side only and requires a window environment.",
    );
  });

  it("lazily returns the same singleton on the client", async () => {
    vi.stubGlobal("window", {});
    const constructed: unknown[] = [];
    vi.stubGlobal(
      "Worker",
      class {
        constructor(...args: unknown[]) {
          constructed.push(args);
        }
      },
    );

    const { createWorker } = await import("../../src/worker/createWorker");
    const first = createWorker();
    const second = createWorker();

    expect(first).toBe(second);
    expect(constructed).toHaveLength(1);
  });
});
