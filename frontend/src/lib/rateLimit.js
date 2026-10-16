// Helpers for HTTP 429 responses. No imports, so they are easy to unit test.

const MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;

/**
 * Parses a Retry-After header: either delay-seconds ("120") or an HTTP date.
 * Returns whole seconds to wait (at least 1), or null when absent/invalid.
 */
export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  let seconds;
  if (/^\d+$/.test(text)) {
    seconds = Number(text);
  } else {
    // HTTP-date (IMF-fixdate), e.g. "Sun, 06 Nov 1994 08:49:37 GMT". Checked
    // strictly because Date.parse also accepts strings like "-5".
    if (!/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) return null;
    const date = Date.parse(text);
    if (Number.isNaN(date)) return null;
    seconds = Math.ceil((date - now) / 1000);
  }
  if (!Number.isFinite(seconds)) return null;
  return Math.min(Math.max(seconds, 1), MAX_RETRY_AFTER_SECONDS);
}

/** "45 seconds", "1 minute", "13 minutes" (rounded up). */
export function formatWait(seconds) {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** "1:05" style countdown for a disabled button. */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The message shown for any 429, with the wait time when the server sent one. */
export function rateLimitMessage(retryAfterSeconds) {
  return retryAfterSeconds
    ? `Too many requests. Please wait ${formatWait(retryAfterSeconds)} and try again.`
    : "Too many requests. Please wait a few minutes and try again.";
}
