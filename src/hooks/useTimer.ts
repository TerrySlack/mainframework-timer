"use client";

import { useEffect, useId, useState } from "react";

import { createWorker } from "../worker/createWorker";
import { getDefaultRouteKey } from "../utils/routes";
import type { TimerMode, TimerWorkerMessage } from "../types";

const windowExists = typeof window !== "undefined";

let worker: Worker | undefined;
if (windowExists) {
  worker = createWorker();
}

const listeners = new Map<string, (msg: TimerWorkerMessage) => void>();

if (worker && !worker.onmessage) {
  worker.onmessage = (e: MessageEvent<TimerWorkerMessage>): void => {
    const msg = e.data;
    if (!msg?.id) return;
    listeners.get(msg.id)?.(msg);
  };
}

export const useTimer = (durationSeconds: number, routeKey?: string, mode: TimerMode = "down"): number => {
  const id = useId();
  const currentRouteKey = routeKey ?? (windowExists ? getDefaultRouteKey() : "");
  const [value, setValue] = useState(mode === "down" ? durationSeconds : 0);

  useEffect(() => {
    if (!worker || !currentRouteKey) return;

    listeners.set(id, (msg: TimerWorkerMessage): void => {
      if (msg.type === "tick" && msg.mode === "down") setValue(msg.secondsLeft);
      if (msg.type === "tick" && msg.mode === "up") setValue(msg.secondsElapsed);
      if (msg.type === "expired") setValue(0);
    });

    worker.postMessage({
      type: "register",
      routeKey: currentRouteKey,
      id,
      mode,
      durationSeconds,
    });

    return () => {
      listeners.delete(id);
      worker.postMessage({ type: "unregister", routeKey: currentRouteKey, id });
    };
  }, [id, durationSeconds, currentRouteKey, mode]);

  return value;
};
