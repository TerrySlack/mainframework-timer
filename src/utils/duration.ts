export const normalizeDurationSeconds = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
