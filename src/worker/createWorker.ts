let worker: Worker | null = null;

/**
 * Lazily creates and returns the singleton timer worker. Safe to call in
 * SSR contexts — returns null until called in a browser environment.
 *
 * This is the only piece of shared plumbing: creating the worker instance.
 * Registering timers, listening for ticks, and filtering messages by id
 * is left to the caller — the hook does its own, a vanilla JS consumer
 * does its own, directly against the returned Worker.
 *
 * NOTE (bundler dependency): `new URL("../worker/timer.worker.ts", import.meta.url)`
 * requires the consuming app's bundler to resolve worker files this way
 * (webpack 5, Vite, Next all do). If you need this package to work in
 * bundler-agnostic environments, swap this for a Blob-constructed worker
 * built from the worker source as a string instead.
 */
export const createWorker = (): Worker | null => {
  if (typeof window === "undefined") return null;
  if (!worker) {
    worker = new Worker(new URL("../worker/timer.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
};
