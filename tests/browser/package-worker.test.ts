import { expect, test } from "vitest";

interface TimerModule {
  createWorker: () => Worker;
}

type TimerMessage =
  | { type: "tick"; id: string; mode: "down"; secondsLeft: number }
  | { type: "expired"; id: string };

test("the built package loads its worker and completes a countdown", async () => {
  const packageUrl = "/dist/vanilla/index.js";
  const timerModule = (await import(/* @vite-ignore */ packageUrl)) as TimerModule;
  const worker = timerModule.createWorker();
  const id = crypto.randomUUID();
  const observed: TimerMessage[] = [];

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("The packaged worker did not expire the countdown."));
    }, 3000);

    const handleError = (event: ErrorEvent): void => {
      window.clearTimeout(timeoutId);
      reject(event.error instanceof Error ? event.error : new Error(event.message));
    };

    const handleMessage = (event: MessageEvent<TimerMessage>): void => {
      if (event.data.id !== id) return;
      observed.push(event.data);
      if (event.data.type !== "expired") return;
      window.clearTimeout(timeoutId);
      worker.removeEventListener("error", handleError);
      worker.removeEventListener("message", handleMessage);
      resolve();
    };

    worker.addEventListener("error", handleError);
    worker.addEventListener("message", handleMessage);
    worker.postMessage({
      type: "register",
      routeKey: "package-smoke",
      id,
      mode: "down",
      durationSeconds: 1,
    });
  });

  expect(observed.some((message) => message.type === "tick")).toBe(true);
  expect(observed.at(-1)).toEqual({ type: "expired", id });
});
