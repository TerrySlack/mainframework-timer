import { useEffect, useId, useRef, useState } from "react";

import { createWorker } from "../worker/createWorker";
import { getDefaultRouteKey } from "../utils/routes";
import type { TimerMode, TimerWorkerMessage } from "../types";

const worker = createWorker();
// One shared dispatcher so every hook instance gets its own messages
const listeners = new Map<string, (msg: TimerWorkerMessage) => void>();

if (worker && !worker.onmessage) {
  worker.onmessage = (e: MessageEvent<TimerWorkerMessage>): void => {
    const msg = e.data;
    if (!msg?.id) return;
    listeners.get(msg.id)?.(msg);
  };
}

/**
 * Drives a timer via the shared worker.
 * mode "down": durationSeconds counts down to 0. Returns seconds remaining.
 * mode "up": durationSeconds is ignored. Returns seconds elapsed since mount/registration.
 */
export const useTimer = (durationSeconds: number, routeKey?: string, mode: TimerMode = "down"): number => {
  const id = useId();
  const lastRegister = useRef<{ durationSeconds: number; routeKey: string; mode: TimerMode } | null>(null);
  const [value, setValue] = useState(mode === "down" ? durationSeconds : 0);
  const keyRef = useRef<string>(routeKey ?? getDefaultRouteKey());

  if (worker) {
    listeners.set(id, (msg: TimerWorkerMessage): void => {
      if (msg.type === "tick" && msg.mode === "down") setValue(msg.secondsLeft);
      if (msg.type === "tick" && msg.mode === "up") setValue(msg.secondsElapsed);
      if (msg.type === "expired") setValue(0);
    });

    const prev = lastRegister.current;
    if (!prev || prev.durationSeconds !== durationSeconds || prev.routeKey !== keyRef.current || prev.mode !== mode) {
      lastRegister.current = { durationSeconds, routeKey: keyRef.current, mode };
      worker.postMessage({
        type: "register",
        routeKey: keyRef.current,
        id,
        mode,
        durationSeconds,
      });
    }
  }

  useEffect(() => {
    return () => {
      listeners.delete(id);
      worker?.postMessage({
        type: "unregister",
        routeKey: routeKey ?? getDefaultRouteKey(),
        id,
      });
    };
  }, [id, routeKey]);

  return value;
};
