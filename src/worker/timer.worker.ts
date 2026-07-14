/// <reference lib="webworker" />

import type { TimerRow, TimerStore, TimerWorkerIncomingMessage } from "../types";

const state: { store: TimerStore } = {
  store: {
    timerCount: 0,
    timers: Object.create(null) as TimerStore["timers"],
  },
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let activeRoute: string | null = null;

const getCount = (): number => state.store.timerCount;

const addTimer = (routeKey: string, id: string, endsAtEpochMs: number): void => {
  let route = state.store.timers[routeKey];
  if (!route) {
    route = { timerCount: 0, timers: Object.create(null) as Record<string, TimerRow> };
    state.store.timers[routeKey] = route;
  }

  const existing = route.timers[id];
  if (existing) {
    if (existing.endsAtEpochMs !== endsAtEpochMs) {
      existing.endsAtEpochMs = endsAtEpochMs;
      existing.lastEmittedSecond = -1;
    }
    return;
  }

  route.timers[id] = { endsAtEpochMs, lastEmittedSecond: -1 };
  route.timerCount++;
  state.store.timerCount++;
};

const deleteTimer = (routeKey: string, id: string): void => {
  const route = state.store.timers[routeKey];
  if (!route || !route.timers[id]) return;

  delete route.timers[id];
  route.timerCount--;
  state.store.timerCount--;

  if (route.timerCount === 0) delete state.store.timers[routeKey];
};

const stopLoopIfIdle = (): void => {
  if (getCount() === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

const cleanupNonActiveRoutes = (): void => {
  if (!activeRoute) return;
  for (const [routeKey, route] of Object.entries(state.store.timers)) {
    if (routeKey === activeRoute) continue;
    state.store.timerCount -= route.timerCount;
    delete state.store.timers[routeKey];
  }
};

const tickOnce = (): void => {
  const now = Date.now();
  for (const [routeKey, route] of Object.entries(state.store.timers)) {
    const expiredIds: string[] = [];
    for (const [id, row] of Object.entries(route.timers)) {
      const secondsLeft = Math.max(0, Math.ceil((row.endsAtEpochMs - now) / 1000));
      if (secondsLeft === 0) {
        if (row.lastEmittedSecond !== 0) {
          row.lastEmittedSecond = 0;
          self.postMessage({ type: "expired", id });
          expiredIds.push(id);
        }
        continue;
      }

      if (secondsLeft !== row.lastEmittedSecond) {
        row.lastEmittedSecond = secondsLeft;
        self.postMessage({ type: "tick", id, secondsLeft });
      }
    }
    for (const id of expiredIds) deleteTimer(routeKey, id);
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
    const endsAtEpochMs = Date.now() + data.durationSeconds * 1000;
    addTimer(data.routeKey, data.id, endsAtEpochMs);
    startLoop();
    tickOnce();
    return;
  }
  if (data.type === "unregister") {
    deleteTimer(data.routeKey, data.id);
    stopLoopIfIdle();
  }
};
