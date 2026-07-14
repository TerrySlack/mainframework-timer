/** Internal worker row state */
export interface TimerRow {
  endsAtEpochMs: number;
  lastEmittedSecond: number;
}

/** Per-route bucket: timer id → row */
export interface RouteTimerState {
  timerCount: number;
  timers: Record<string, TimerRow>;
}

/** Full worker store: routeKey → route bucket */
export interface TimerStore {
  timerCount: number;
  timers: Record<string, RouteTimerState>;
}

/** Worker → main thread */
export type TimerWorkerMessage = { type: "tick"; id: string; secondsLeft: number } | { type: "expired"; id: string };

/** Main thread → worker */
export type TimerWorkerIncomingMessage =
  | { type: "route"; activeRoute: string }
  | { type: "register"; routeKey: string; id: string; durationSeconds: number }
  | { type: "unregister"; routeKey: string; id: string };
