/** Direction a timer counts */
export type TimerMode = "down" | "up";

/** Internal worker row state */
export interface TimerRow {
  mode: TimerMode;
  /** countdown: the epoch ms it ends at. count-up: the epoch ms it started at. */
  anchorEpochMs: number;
  lastEmittedSecond: number;
}

/** Per-route bucket: timer id → row */
export interface RouteTimerState {
  timerCount: number;
  timers: Map<string, TimerRow>;
}

/** Full worker store: routeKey → route bucket */
export interface TimerStore {
  timerCount: number;
  timers: Map<string, RouteTimerState>;
}

/** Worker → main thread */
export type TimerWorkerMessage =
  | { type: "tick"; id: string; mode: "down"; secondsLeft: number }
  | { type: "tick"; id: string; mode: "up"; secondsElapsed: number }
  | { type: "expired"; id: string };

/** Main thread → worker */
export type TimerWorkerIncomingMessage =
  | { type: "route"; activeRoute: string }
  | { type: "register"; routeKey: string; id: string; mode: TimerMode; durationSeconds?: number }
  | { type: "unregister"; routeKey: string; id: string };
