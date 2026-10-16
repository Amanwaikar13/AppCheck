// 429 handling and duplicate-request prevention through the real Redux store.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AxiosError } from "axios";
import { installFakeApi, rateLimited } from "./fakeApi.mjs";

const api = await installFakeApi();
const { toApiError, describeApiError } = await import("@/services/apiClient");
const { makeStore } = await import("@/store/store");
const { fetchSession, login, register } = await import("@/features/auth/authSlice");
const { checkBackendHealth } = await import("@/features/health/healthSlice");
const { fetchScans, fetchScanSummary } = await import("@/features/scans/scansSlice");

const USER = { id: "1", name: "Ada", email: "ada@example.com", role: "user" };
let store;

beforeEach(() => {
  api.calls.length = 0;
  api.respondWith(() => ({ status: 200, data: { user: USER } }));
  store = makeStore();
});

test("a 429 becomes RATE_LIMITED with Retry-After, never a connectivity message", async () => {
  api.respondWith(() => rateLimited(840));
  const result = await store.dispatch(login({ email: USER.email, password: "x" }));
  assert.equal(result.payload.status, 429);
  assert.equal(result.payload.code, "RATE_LIMITED");
  assert.equal(result.payload.retryAfterSeconds, 840);
  assert.equal(result.payload.message, "Too many requests. Please wait 14 minutes and try again.");
  assert.doesNotMatch(result.payload.message, /No response|not running|backend/i);
  assert.equal(store.getState().auth.submitting, false, "the form can be used again");
});

test("a 429 without Retry-After still gets a clear message", async () => {
  api.respondWith(() => rateLimited());
  const result = await store.dispatch(login({ email: USER.email, password: "x" }));
  assert.equal(result.payload.retryAfterSeconds, null);
  assert.match(result.payload.message, /Too many requests\. Please wait a few minutes/);
});

test("only requests that got no response are described as connectivity problems", () => {
  const noResponse = new AxiosError("Network Error", "ERR_NETWORK", {}, {});
  assert.equal(toApiError(noResponse).code, "NO_RESPONSE");
  assert.match(describeApiError(noResponse), /No response from the AppCheck API/);
});

test("duplicate login submissions send one request", async () => {
  const credentials = { email: USER.email, password: "correct horse battery" };
  const [first, second, third] = await Promise.all([
    store.dispatch(login(credentials)),
    store.dispatch(login(credentials)),
    store.dispatch(login(credentials)),
  ]);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].url, "/auth/login");
  assert.equal(api.calls[0].headers.get("X-Requested-With"), "XMLHttpRequest", "CSRF header still sent");
  assert.equal(first.type, login.fulfilled.type);
  assert.ok(second.meta.condition && third.meta.condition, "duplicates were cancelled, not failed");
  assert.equal(store.getState().auth.status, "authenticated");
});

test("login and registration cannot overlap; a new attempt is allowed after one finishes", async () => {
  api.respondWith(() => ({ status: 401, data: { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } } }));
  await Promise.all([
    store.dispatch(login({ email: USER.email, password: "wrong" })),
    store.dispatch(register({ name: "Ada", email: USER.email, password: "x" })),
  ]);
  assert.equal(api.calls.length, 1);
  await store.dispatch(login({ email: USER.email, password: "wrong again" }));
  assert.equal(api.calls.length, 2, "not blocked after the first attempt settled");
});

test("concurrent session checks (several components, Strict Mode) send one request", async () => {
  await Promise.all([1, 2, 3, 4].map(() => store.dispatch(fetchSession())));
  assert.equal(api.calls.filter((c) => c.url === "/auth/me").length, 1);
  assert.equal(store.getState().auth.status, "authenticated");
});

test("a rate-limited session check keeps the error detail for the UI", async () => {
  api.respondWith(() => rateLimited(30));
  await store.dispatch(fetchSession());
  const { status, error, errorDetail } = store.getState().auth;
  assert.equal(status, "error");
  assert.equal(errorDetail.code, "RATE_LIMITED");
  assert.equal(error, "Too many requests. Please wait 30 seconds and try again.");
});

test("concurrent health checks send one request", async () => {
  api.respondWith(() => ({ status: 200, data: { status: "healthy", database: { status: "connected" } } }));
  await Promise.all([1, 2, 3].map(() => store.dispatch(checkBackendHealth())));
  assert.equal(api.calls.length, 1);
});

test("identical scan reads in flight are deduplicated; different queries are not", async () => {
  api.respondWith(() => ({ status: 200, data: { items: [], pagination: { totalItems: 0 } } }));
  const query = { page: 1, limit: 10, type: "", status: "", sort: "-createdAt" };
  await Promise.all([store.dispatch(fetchScans(query)), store.dispatch(fetchScans({ ...query }))]);
  assert.equal(api.calls.length, 1);
  await Promise.all([store.dispatch(fetchScans(query)), store.dispatch(fetchScans({ ...query, page: 2 }))]);
  assert.equal(api.calls.length, 3);
  api.calls.length = 0;
  await Promise.all([store.dispatch(fetchScanSummary()), store.dispatch(fetchScanSummary())]);
  assert.equal(api.calls.length, 1, "concurrent summary requests are deduplicated");
  assert.equal(api.calls[0].url, "/scans/summary");
});
