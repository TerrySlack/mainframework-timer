import { useId, useLayoutEffect, useRef, useState } from "react";

import { createWorker } from "../worker/createWorker";
import { getDefaultRouteKey } from "../utils/routes";
import type { TimerMode, TimerWorkerMessage } from "../types";

type Listener = (msg: TimerWorkerMessage) => void;
const listeners = new Map<string, Listener>();
let workerListenerAttached = false;

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

  const id = useId();
  const currentWorker = createWorker();
  const activeRouteKey = routeKey ?? getDefaultRouteKey();

  const [value, setValue] = useState(mode === "down" ? durationSeconds : 0);
  const lastRegister = useRef<{ durationSeconds: number; routeKey: string; mode: TimerMode } | null>(null);

  useLayoutEffect(() => {
    ensureWorkerListener(currentWorker);

    const handleMessage = (msg: TimerWorkerMessage): void => {
      if (msg.type === "tick" && msg.mode === "down") setValue(msg.secondsLeft);
      if (msg.type === "tick" && msg.mode === "up") setValue(msg.secondsElapsed);
      if (msg.type === "expired") setValue(0);
    };

    listeners.set(id, handleMessage);

    const prev = lastRegister.current;
    if (!prev || prev.durationSeconds !== durationSeconds || prev.routeKey !== activeRouteKey || prev.mode !== mode) {
      if (prev && prev.routeKey !== activeRouteKey) {
        currentWorker.postMessage({
          type: "unregister",
          routeKey: prev.routeKey,
          id,
        });
      }
      if (prev && (prev.durationSeconds !== durationSeconds || prev.mode !== mode || prev.routeKey !== activeRouteKey)) {
        setValue(mode === "down" ? durationSeconds : 0);
      }
      lastRegister.current = { durationSeconds, routeKey: activeRouteKey, mode };
      currentWorker.postMessage({
        type: "register",
        routeKey: activeRouteKey,
        id,
        mode,
        durationSeconds,
      });
    }

    return () => {
      listeners.delete(id);
      const registered = lastRegister.current;
      currentWorker.postMessage({
        type: "unregister",
        routeKey: registered?.routeKey ?? activeRouteKey,
        id,
      });
    };
  }, [id, activeRouteKey, currentWorker, durationSeconds, mode]);

  return value;
};
