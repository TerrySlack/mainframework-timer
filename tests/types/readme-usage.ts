import {
  createWorker,
  getDefaultRouteKey,
  type TimerWorkerIncomingMessage,
  type TimerWorkerMessage,
} from "@mainframework/timer";
import { useTimer } from "@mainframework/timer/react";

export const checkVanillaReadmeUsage = (): void => {
  const worker = createWorker();
  const id = crypto.randomUUID();
  const routeKey = getDefaultRouteKey();
  const handleMessage = (event: MessageEvent<TimerWorkerMessage>): void => {
    if (event.data.id !== id) return;
  };
  const register: TimerWorkerIncomingMessage = {
    type: "register",
    routeKey,
    id,
    mode: "down",
    durationSeconds: 60,
  };
  const unregister: TimerWorkerIncomingMessage = { type: "unregister", routeKey, id };

  worker.addEventListener("message", handleMessage);
  worker.postMessage(register);
  worker.removeEventListener("message", handleMessage);
  worker.postMessage(unregister);
};

export const useReadmeCountdown = (): number => useTimer(60);
export const useReadmeStopwatch = (): number => useTimer(0, "stopwatch", "up");
