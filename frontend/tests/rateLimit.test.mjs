import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCountdown, formatWait, parseRetryAfter, rateLimitMessage } from "@/lib/rateLimit";

test("parseRetryAfter reads delay-seconds", () => {
  assert.equal(parseRetryAfter("120"), 120);
  assert.equal(parseRetryAfter(" 5 "), 5);
  assert.equal(parseRetryAfter("0"), 1, "never asks to wait less than a second");
});

test("parseRetryAfter reads HTTP dates relative to now", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  assert.equal(parseRetryAfter("Thu, 15 Oct 2026 12:01:30 GMT", now), 90);
  assert.equal(parseRetryAfter("Thu, 15 Oct 2026 11:00:00 GMT", now), 1, "a past date means retry now");
});

test("parseRetryAfter ignores missing or invalid values", () => {
  for (const value of [undefined, null, "", "soon", "-5", "1.5"]) {
    assert.equal(parseRetryAfter(value), null, String(value));
  }
  assert.equal(parseRetryAfter("99999999"), 86400, "capped at one day");
});

test("wait formatting", () => {
  assert.equal(formatWait(1), "1 second");
  assert.equal(formatWait(45), "45 seconds");
  assert.equal(formatWait(60), "1 minute");
  assert.equal(formatWait(61), "2 minutes");
  assert.equal(formatCountdown(65), "1:05");
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(rateLimitMessage(840), "Too many requests. Please wait 14 minutes and try again.");
  assert.match(rateLimitMessage(null), /wait a few minutes/);
});
