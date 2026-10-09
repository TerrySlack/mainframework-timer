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

describe("useTimer SSR edges", () => {
  it.each([1.9, 4.8, 0.5])("renders zero on the server for fractional countdown %s", (duration) => {
    expect(renderedValue(<Probe duration={duration} routeKey="/frac" />)).toBe("0");
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "renders zero for countdown edge %s",
    (duration) => {
      expect(renderedValue(<Probe duration={duration} routeKey="/edge" />)).toBe("0");
    },
  );

  it.each([0, 1.9, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "renders zero for count-up duration edge %s",
    (duration) => {
      expect(renderedValue(<Probe duration={duration} routeKey="/up-edge" mode="up" />)).toBe("0");
    },
  );

  it("renders zero across repeated server renders", () => {
    const element = <Probe duration={10} routeKey="/repeat" />;
    expect(renderedValue(element)).toBe("0");
    expect(renderedValue(element)).toBe("0");
    expect(renderedValue(<Probe duration={10} routeKey="/repeat" />)).toBe("0");
  });

  it("renders zero for omitted and explicit routeKeys on the server", () => {
    expectZeroOrRouteError(<Probe duration={7} />);
    expect(renderedValue(<Probe duration={7} routeKey="/other" />)).toBe("0");
  });
});
