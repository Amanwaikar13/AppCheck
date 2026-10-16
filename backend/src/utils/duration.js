export const DURATION_PATTERN = /^\d+[smhd]$/;

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Converts a duration such as "30m" or "7d" to milliseconds. */
export function durationToMs(value) {
  if (!DURATION_PATTERN.test(value)) throw new Error(`Invalid duration: ${value}`);
  return Number(value.slice(0, -1)) * UNIT_MS[value.at(-1)];
}
