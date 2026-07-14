/// <reference lib="webworker" />

import type { TimerMode, TimerRow, TimerStore, TimerWorkerIncomingMessage } from "../types";

const state: { store: TimerStore } = {
  store: {
    timerCount: 0,
    timers: new Map(),
  },
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let activeRoute: string | null = null;

const getCount = (): number => state.store.timerCount;

const addTimer = (routeKey: string, id: string, mode: TimerMode, anchorEpochMs: number): void => {
  let route = state.store.timers.get(routeKey);
  if (!route) {
    route = { timerCount: 0, timers: new Map<string, TimerRow>() };
    state.store.timers.set(routeKey, route);
  }

  const existing = route.timers.get(id);
  if (existing) {
    if (existing.anchorEpochMs !== anchorEpochMs || existing.mode !== mode) {
      existing.mode = mode;
      existing.anchorEpochMs = anchorEpochMs;
      existing.lastEmittedSecond = -1;
    }
    return;
  }

  route.timers.set(id, { mode, anchorEpochMs, lastEmittedSecond: -1 });
  route.timerCount++;
  state.store.timerCount++;
};

const deleteTimer = (routeKey: string, id: string): void => {
  const route = state.store.timers.get(routeKey);
  if (!route || !route.timers.has(id)) return;

  route.timers.delete(id);
  route.timerCount--;
  state.store.timerCount--;

  if (route.timerCount === 0) state.store.timers.delete(routeKey);
};

const stopLoopIfIdle = (): void => {
  if (getCount() === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const cleanupNonActiveRoutes = (): void => {
  if (!activeRoute) return;
  for (const [routeKey, route] of state.store.timers) {
    if (routeKey === activeRoute) continue;
    state.store.timerCount -= route.timerCount;
    state.store.timers.delete(routeKey);
  }
};

const tickOnce = (): void => {
  const now = Date.now();
  for (const [routeKey, route] of state.store.timers) {
    for (const [id, row] of route.timers) {
      if (row.mode === "down") {
        const secondsLeft = Math.max(0, Math.ceil((row.anchorEpochMs - now) / 1000));
        if (secondsLeft === 0) {
          if (row.lastEmittedSecond !== 0) {
            row.lastEmittedSecond = 0;
            self.postMessage({ type: "expired", id });
            deleteTimer(routeKey, id);
          }
          continue;
        }
        if (secondsLeft !== row.lastEmittedSecond) {
          row.lastEmittedSecond = secondsLeft;
          self.postMessage({ type: "tick", id, mode: "down", secondsLeft });
        }
      } else {
        const secondsElapsed = Math.max(0, Math.floor((now - row.anchorEpochMs) / 1000));
        if (secondsElapsed !== row.lastEmittedSecond) {
          row.lastEmittedSecond = secondsElapsed;
          self.postMessage({ type: "tick", id, mode: "up", secondsElapsed });
        }
      }
    }
  }
  stopLoopIfIdle();
};

const startLoop = (): void => {
  if (intervalId !== null) return;
  intervalId = setInterval(tickOnce, 1000);
};

self.onmessage = (e: MessageEvent<TimerWorkerIncomingMessage>): void => {
  const { data } = e;
  if (data.type === "route") {
    activeRoute = data.activeRoute;
    cleanupNonActiveRoutes();
    stopLoopIfIdle();
    return;
  }
  if (data.type === "register") {
    const anchorEpochMs = data.mode === "down" ? Date.now() + (data.durationSeconds ?? 0) * 1000 : Date.now();
    addTimer(data.routeKey, data.id, data.mode, anchorEpochMs);
    startLoop();
    tickOnce();
    return;
  }
  if (data.type === "unregister") {
    deleteTimer(data.routeKey, data.id);
    stopLoopIfIdle();
  }
};
