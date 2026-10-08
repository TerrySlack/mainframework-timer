/// <reference lib="webworker" />

import type { TimerMode, TimerRow, TimerStore, TimerWorkerIncomingMessage } from "../types";

const state: { store: TimerStore } = {
  store: {
    timerCount: 0,
    timers: new Map(),
  },
};

let timeoutId: ReturnType<typeof setTimeout> | null = null;
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
  if (getCount() === 0 && timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
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
  const expiredTimers: Array<{ routeKey: string; id: string }> = [];

  for (const [routeKey, route] of state.store.timers) {
    for (const [id, row] of route.timers) {
      if (row.mode === "down") {
        const secondsLeft = Math.max(0, Math.ceil((row.anchorEpochMs - now) / 1000));
        if (secondsLeft === 0) {
          if (row.lastEmittedSecond !== 0) {
            row.lastEmittedSecond = 0;
            self.postMessage({ type: "expired", id });
            expiredTimers.push({ routeKey, id });
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

  for (const { routeKey, id } of expiredTimers) {
    deleteTimer(routeKey, id);
  }

  stopLoopIfIdle();
};

const scheduleNextTick = (): void => {
  if (getCount() === 0) {
    timeoutId = null;
    return;
  }
  const delay = Math.max(1, 1000 - (Date.now() % 1000));
  timeoutId = setTimeout(() => {
    tickOnce();
    scheduleNextTick();
  }, delay);
};

const startLoop = (): void => {
  if (timeoutId !== null) return;
  scheduleNextTick();
};

self.addEventListener("message", (e: MessageEvent<TimerWorkerIncomingMessage>): void => {
  const { data } = e;
  if (data.type === "route") {
    activeRoute = data.activeRoute;
    cleanupNonActiveRoutes();
    stopLoopIfIdle();
    return;
  }

  if (data.type === "register") {
    const safeDuration = Math.max(0, Math.floor(data.durationSeconds ?? 0));
    const anchorEpochMs = data.mode === "down" ? Date.now() + safeDuration * 1000 : Date.now();
    addTimer(data.routeKey, data.id, data.mode, anchorEpochMs);
    startLoop();
    tickOnce();
    return;
  }
  if (data.type === "unregister") {
    deleteTimer(data.routeKey, data.id);
    stopLoopIfIdle();
  }
});
