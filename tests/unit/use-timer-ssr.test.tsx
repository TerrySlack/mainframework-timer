import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useTimer } from "../../src/hooks/useTimer";
import type { TimerMode } from "../../src/types";

const SERVER_ROUTE_ERROR = "@mainframework/timer is client-side only and requires a window environment.";

const Probe = ({ duration, routeKey, mode }: { duration: number; routeKey?: string; mode?: TimerMode }) => {
  const value = useTimer(duration, routeKey, mode);
  return <output>{value}</output>;
};

const renderedValue = (element: React.ReactElement): string => {
  const html = renderToString(element);
  const match = /<output>(.*?)<\/output>/u.exec(html);
  if (!match?.[1] && match?.[1] !== "") throw new Error("Expected an <output> value in SSR markup.");
  return match?.[1] ?? "";
};

type RenderOrThrowResult =
  | { outcome: "value"; value: string }
  | { outcome: "throw"; message: string };

const renderOrThrow = (element: React.ReactElement): RenderOrThrowResult => {
  try {
    return { outcome: "value", value: renderedValue(element) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { outcome: "throw", message };
  }
};

const expectZeroOrRouteError = (element: React.ReactElement): void => {
  const result = renderOrThrow(element);
  if (result.outcome === "value") {
    expect(result.value).toBe("0");
    return;
  }
  expect(result.message).toBe(SERVER_ROUTE_ERROR);
};

describe("useTimer SSR", () => {
  it("returns zero without a routeKey or throws when pathname default is unavailable", () => {
    expect(typeof window).toBe("undefined");
    expectZeroOrRouteError(<Probe duration={60} />);
  });

  it("returns zero with an explicit routeKey and without throwing", () => {
    expect(renderedValue(<Probe duration={1.9} routeKey="/explicit" />)).toBe("0");
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "returns zero for invalid countdown duration %s",
    (durationSeconds) => {
      expect(renderedValue(<Probe duration={durationSeconds} routeKey="/invalid" />)).toBe("0");
    },
  );

  it("returns zero in count-up mode and ignores the duration", () => {
    expect(renderedValue(<Probe duration={99} routeKey="/up" mode="up" />)).toBe("0");
    expectZeroOrRouteError(<Probe duration={99} mode="up" />);
  });

  it("never touches the worker during server render", () => {
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe("undefined");
    expectZeroOrRouteError(<Probe duration={10} />);
    expect(renderedValue(<Probe duration={10} routeKey="/a" mode="up" />)).toBe("0");
  });
});
