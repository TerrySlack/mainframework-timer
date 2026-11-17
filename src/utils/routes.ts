import { createWorker } from "../worker/createWorker";

/** Convenience default — current pathname. Callers can supply their own routeKey instead. */
export const getDefaultRouteKey = (): string => (typeof window !== "undefined" ? window.location.pathname : "");

/** Broadcasts the active route to the timer worker to purge inactive route timers. */
export const setActiveRoute = (routeKey: string): void => {
  const worker = createWorker();
  worker?.postMessage({ type: "route", activeRoute: routeKey });
};
