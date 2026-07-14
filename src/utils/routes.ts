/** Convenience default — current pathname. Callers can supply their own routeKey instead. */
export const getDefaultRouteKey = (): string =>
  typeof window === "undefined" ? "" : window.location.pathname;
