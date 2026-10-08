import { describe, expect, expectTypeOf, it } from "vitest";

import type { TimerWorkerIncomingMessage } from "../../src/types";
import { normalizeDurationSeconds } from "../../src/utils/duration";

describe("duration contract", () => {
  it.each([
    [1.9, 1],
    [-1, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 0],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeDurationSeconds(input)).toBe(expected);
  });

  it("uses mode-specific registration messages", () => {
    type RegisterMessage = Extract<TimerWorkerIncomingMessage, { type: "register" }>;
    type ExpectedRegisterMessage =
      | { type: "register"; routeKey: string; id: string; mode: "down"; durationSeconds: number }
      | { type: "register"; routeKey: string; id: string; mode: "up" };

    expectTypeOf<RegisterMessage>().toEqualTypeOf<ExpectedRegisterMessage>();
  });
});
