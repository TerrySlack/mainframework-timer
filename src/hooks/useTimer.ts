import { useEffect, useState } from "react";

import { createWorker } from "../worker/createWorker";
import { getDefaultRouteKey } from "../utils/routes";
import type { TimerMode, TimerWorkerMessage } from "../types";
import { normalizeDurationSeconds } from "../utils/duration";

type Listener = (msg: TimerWorkerMessage) => void;
interface TimerState {
  durationSeconds: number;
  routeKey: string;
  mode: TimerMode;
  value: number;
}

const listeners = new Map<string, Listener>();
let workerListenerAttached = false;
let nextTimerId = 0;

const ensureWorkerListener = (worker: Worker): void => {
  if (workerListenerAttached) return;
  worker.addEventListener("message", (e: MessageEvent<TimerWorkerMessage>) => {
    const msg = e.data;
    if (!msg || !msg.id) return;
    listeners.get(msg.id)?.(msg);
  });
  workerListenerAttached = true;
};

/**
 * Drives a timer via the shared worker.
 * mode "down": durationSeconds counts down to 0. Returns seconds remaining.
 * mode "up": durationSeconds is ignored. Returns seconds elapsed since mount/registration.
 */
export const useTimer = (durationSeconds: number, routeKey?: string, mode: TimerMode = "down"): number => {
  if (typeof window === "undefined") {
    throw new Error("@mainframework/timer is client-side only and requires a window environment.");
  }

  const activeRouteKey = routeKey ?? getDefaultRouteKey();
  const effectiveDuration = mode === "down" ? normalizeDurationSeconds(durationSeconds) : 0;

  const [timerState, setTimerState] = useState<TimerState>({
    durationSeconds: effectiveDuration,
    routeKey: activeRouteKey,
    mode,
    value: effectiveDuration,
  });
  const configurationChanged =
    timerState.durationSeconds !== effectiveDuration ||
    timerState.routeKey !== activeRouteKey ||
    timerState.mode !== mode;
  let value = timerState.value;
  if (configurationChanged) {
    value = effectiveDuration;
    setTimerState({
      durationSeconds: effectiveDuration,
      routeKey: activeRouteKey,
      mode,
      value,
    });
  }

  useEffect(() => {
    const currentWorker = createWorker();
    const id = `@mainframework/timer:${++nextTimerId}`;
    ensureWorkerListener(currentWorker);

    const handleMessage = (msg: TimerWorkerMessage): void => {
      let nextValue: number;
      if (msg.type === "tick" && msg.mode === "down") nextValue = msg.secondsLeft;
      else if (msg.type === "tick" && msg.mode === "up") nextValue = msg.secondsElapsed;
      else nextValue = 0;
      setTimerState({
        durationSeconds: effectiveDuration,
        routeKey: activeRouteKey,
        mode,
        value: nextValue,
      });
    };

    listeners.set(id, handleMessage);

    if (mode === "down") {
      currentWorker.postMessage({
        type: "register",
        routeKey: activeRouteKey,
        id,
        mode,
        durationSeconds: effectiveDuration,
      });
    } else {
      currentWorker.postMessage({
        type: "register",
        routeKey: activeRouteKey,
        id,
        mode,
      });
    }

    return () => {
      listeners.delete(id);
      currentWorker.postMessage({
        type: "unregister",
        routeKey: activeRouteKey,
        id,
      });
    };
  }, [activeRouteKey, effectiveDuration, mode]);

  return value;
};
