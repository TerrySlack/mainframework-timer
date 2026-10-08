/// <reference lib="webworker" />

import type { TimerMode, TimerRow, TimerStore, TimerWorkerIncomingMessage } from "../types";
import { normalizeDurationSeconds } from "../utils/duration";

const state: { store: TimerStore } = {
  store: {
    timerCount: 0,
    timers: new Map(),
  },
};

let timeoutId: ReturnType<typeof setTimeout> | null = null;
let activeRoute: string | null = null;

const getCount = (): number => state.store.timerCount;

const addTimer = (routeKey: string, id: string, mode: TimerMode, anchorEpochMs: number): TimerRow => {
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
    return existing;
  }

  const row = { mode, anchorEpochMs, lastEmittedSecond: -1 };
  route.timers.set(id, row);
  route.timerCount++;
  state.store.timerCount++;
  return row;
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
  if (activeRoute === null) return;
  for (const [routeKey, route] of state.store.timers) {
    if (routeKey === activeRoute) continue;
    state.store.timerCount -= route.timerCount;
    state.store.timers.delete(routeKey);
  }
};

const tickTimer = (id: string, row: TimerRow, now: number): boolean => {
  if (row.mode === "down") {
    const secondsLeft = Math.max(0, Math.ceil((row.anchorEpochMs - now) / 1000));
    if (secondsLeft === 0) {
      if (row.lastEmittedSecond !== 0) {
        row.lastEmittedSecond = 0;
        self.postMessage({ type: "expired", id });
        return true;
      }
      return false;
    }
    if (secondsLeft !== row.lastEmittedSecond) {
      row.lastEmittedSecond = secondsLeft;
      self.postMessage({ type: "tick", id, mode: "down", secondsLeft });
    }
    return false;
  }

  const secondsElapsed = Math.max(0, Math.floor((now - row.anchorEpochMs) / 1000));
  if (secondsElapsed !== row.lastEmittedSecond) {
    row.lastEmittedSecond = secondsElapsed;
    self.postMessage({ type: "tick", id, mode: "up", secondsElapsed });
  }
  return false;
};

const tickOnce = (): void => {
  const now = Date.now();
  const expiredTimers: Array<{ routeKey: string; id: string }> = [];

  for (const [routeKey, route] of state.store.timers) {
    for (const [id, row] of route.timers) {
      if (tickTimer(id, row, now)) expiredTimers.push({ routeKey, id });
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
    const now = Date.now();
    const safeDuration = data.mode === "down" ? normalizeDurationSeconds(data.durationSeconds) : 0;
    const anchorEpochMs = data.mode === "down" ? now + safeDuration * 1000 : now;
    const row = addTimer(data.routeKey, data.id, data.mode, anchorEpochMs);
    if (tickTimer(data.id, row, now)) deleteTimer(data.routeKey, data.id);
    startLoop();
    return;
  }
  if (data.type === "unregister") {
    deleteTimer(data.routeKey, data.id);
    stopLoopIfIdle();
  }
});
