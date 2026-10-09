let worker: Worker | null = null;

/**
 * Lazily creates and returns the singleton timer worker.
 * Client-side only — throws immediately if invoked in a non-browser environment.
 */
export const createWorker = (): Worker => {
  if (typeof window === "undefined") {
    throw new Error("@mainframework/timer is client-side only and requires a window environment.");
  }
  if (!worker) {
    worker = new Worker(new URL("../worker/timer.worker.js", import.meta.url), {
      type: "module",
    });
  }
  return worker;
};
