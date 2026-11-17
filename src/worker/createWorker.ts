let worker: Worker | null = null;

export const createWorker = (): Worker | undefined => {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return undefined;
  }

  if (!worker) {
    worker = new Worker(new URL("./timer.worker.js", import.meta.url), {
      type: "module",
    });
  }

  return worker;
};
