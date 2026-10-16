// Global API rate limit, Retry-After, proxy trust, and diagnostics. No database
// needed: limits are enforced before any route touches MongoDB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/config/logger.js';
import { signAccessToken } from '../src/services/token.service.js';
import { CSRF, TEST_ORIGIN, makeTestConfig, postJson } from './helpers.js';

const ALICE = { _id: '65f0000000000000000000a1' };
const BOB = { _id: '65f0000000000000000000b2' };

/** Starts an app with small limits; returns { api, close, logs }. */
async function start(overrides = {}) {
  const config = makeTestConfig({ apiRateLimits: { anonymous: 3, authenticated: 5 }, ...overrides });
  const logs = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      logs.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const app = createApp({ config, logger: createLogger({ logLevel: 'warn' }, sink) });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    config,
    logs,
    api: `http://127.0.0.1:${server.address().port}/api/v1`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function hit(url, headers = {}, times = 1) {
  let res;
  for (let i = 0; i < times; i += 1) {
    res = await fetch(url, { headers });
    if (i < times - 1) await res.arrayBuffer();
  }
  return res;
}

const bearer = (user, config) => ({ Authorization: `Bearer ${signAccessToken(user, config.jwt)}` });

test('anonymous requests share a per-IP limit; 429 carries Retry-After readable via CORS', async () => {
  const s = await start();
  try {
    assert.equal((await hit(s.api, {}, 3)).status, 200);
    const res = await hit(s.api, { Origin: TEST_ORIGIN });
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), {
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    });
    const retryAfter = Number(res.headers.get('retry-after'));
    assert.ok(retryAfter > 0 && retryAfter <= 15 * 60, `Retry-After=${retryAfter}`);
    assert.match(res.headers.get('access-control-expose-headers'), /Retry-After/i);
    assert.equal(res.headers.get('access-control-allow-origin'), TEST_ORIGIN, 'browser can read the 429');
  } finally {
    await s.close();
  }
});

test('signed-in traffic uses a per-user bucket, so it cannot block login for the IP', async () => {
  const s = await start();
  try {
    // Heavy signed-in use: past the anonymous limit, within the per-user limit.
    assert.equal((await hit(s.api, bearer(ALICE, s.config), 5)).status, 200);
    assert.equal((await hit(s.api, bearer(ALICE, s.config))).status, 429, 'per-user limit still applies');

    // The login endpoint (anonymous) is unaffected: it reaches validation (400), not 429.
    const login = await postJson(`${s.api}/auth/login`, {}, CSRF);
    assert.equal(login.status, 400);

    // Another user on the same IP has an independent bucket.
    assert.equal((await hit(s.api, bearer(BOB, s.config))).status, 200);
  } finally {
    await s.close();
  }
});

test('forged or expired tokens cannot mint new buckets; they count against the IP', async () => {
  const s = await start();
  try {
    const forged = signAccessToken(ALICE, { secret: 'x'.repeat(40), expiresIn: '1h' });
    const expired = signAccessToken(BOB, { ...s.config.jwt, expiresIn: -10 });
    await hit(s.api, { Authorization: `Bearer ${forged}` });
    await hit(s.api, { Cookie: `appcheck_session=${expired}` });
    await hit(s.api);
    const res = await hit(s.api, { Authorization: `Bearer ${forged}` });
    assert.equal(res.status, 429);
  } finally {
    await s.close();
  }
});

test('X-Forwarded-For is ignored unless TRUST_PROXY is configured', async () => {
  const direct = await start();
  try {
    for (let i = 1; i <= 3; i += 1) await hit(direct.api, { 'X-Forwarded-For': `203.0.113.${i}` });
    const spoofed = await hit(direct.api, { 'X-Forwarded-For': '203.0.113.99' });
    assert.equal(spoofed.status, 429, 'spoofed client IPs share the real IP bucket');
  } finally {
    await direct.close();
  }

  const proxied = await start({ trustProxy: 1 });
  try {
    assert.equal((await hit(proxied.api, { 'X-Forwarded-For': '198.51.100.1' }, 3)).status, 200);
    assert.equal((await hit(proxied.api, { 'X-Forwarded-For': '198.51.100.1' })).status, 429);
    assert.equal((await hit(proxied.api, { 'X-Forwarded-For': '198.51.100.2' })).status, 200, 'distinct client behind the proxy');
  } finally {
    await proxied.close();
  }
});

test('rate-limit events are logged with diagnostics and without secrets', async () => {
  const s = await start();
  try {
    const auth = bearer(ALICE, s.config);
    await hit(s.api, { ...auth, Cookie: 'appcheck_session=cookie-secret-value' }, 6);
    const entry = s.logs.find((line) => line.rateLimit);
    assert.ok(entry, 'a warning was logged');
    assert.equal(entry.level, 40);
    assert.equal(entry.rateLimit.limiter, 'api');
    assert.equal(entry.rateLimit.keyType, 'user');
    assert.equal(entry.rateLimit.userId, ALICE._id);
    assert.equal(entry.rateLimit.limit, 5);
    assert.equal(entry.path, '/api/v1');
    const text = JSON.stringify(s.logs);
    assert.ok(!text.includes(auth.Authorization.slice(7)), 'token not logged');
    assert.ok(!text.includes('cookie-secret-value'), 'cookie not logged');
  } finally {
    await s.close();
  }
});

test('the login limiter still blocks repeated failed attempts, with Retry-After', async () => {
  const s = await start({ apiRateLimits: { anonymous: 100, authenticated: 100 }, authRateLimits: { login: 2 } });
  try {
    // No database in this test, so attempts fail (503) and count as failures.
    for (let i = 0; i < 2; i += 1) {
      const res = await postJson(`${s.api}/auth/login`, { email: 'a@example.com', password: 'wrong-password' }, CSRF);
      assert.notEqual(res.status, 429);
    }
    const blocked = await postJson(`${s.api}/auth/login`, { email: 'a@example.com', password: 'wrong-password' }, CSRF);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.message, 'Too many attempts. Please try again later.');
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
    assert.equal(s.logs.find((line) => line.rateLimit)?.rateLimit.limiter, 'login');
  } finally {
    await s.close();
  }
});
