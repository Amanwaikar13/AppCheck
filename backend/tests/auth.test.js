// Authentication tests that do NOT need a database. They cover CSRF, input
// validation, token handling, rate limiting, roles, and log redaction.
// Database-backed flows live in auth.integration.test.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../src/config/logger.js';
import { requireRole } from '../src/middleware/authorize.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { TOKEN_AUDIENCE, TOKEN_ISSUER, signAccessToken } from '../src/services/token.service.js';
import { CSRF, TEST_ORIGIN, makeTestConfig, postJson, startTestServer } from './helpers.js';

const config = makeTestConfig();
const USER_ID = '65f000000000000000000001';
let server;
let api;

before(async () => {
  server = await startTestServer(config);
  api = `${server.baseUrl}/api/v1`;
});

after(() => server.close());

const validRegistration = { name: 'Ada', email: 'ada@example.com', password: 'correct horse battery' };

const getMe = (headers = {}) => fetch(`${api}/auth/me`, { headers });

function tokenWith(claims, { secret = config.jwt.secret, ...options } = {}) {
  return jwt.sign(claims, secret, {
    algorithm: 'HS256',
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    subject: USER_ID,
    ...options,
  });
}

// --- CSRF ---------------------------------------------------------------

test('state-changing requests without the CSRF header are rejected', async () => {
  const res = await postJson(`${api}/auth/register`, validRegistration);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'CSRF_REJECTED');
});

test('state-changing requests from a foreign Origin are rejected', async () => {
  const res = await postJson(`${api}/auth/login`, validRegistration, {
    ...CSRF,
    Origin: 'https://evil.example',
  });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.code, 'CSRF_REJECTED');
});

test('CORS preflight allows credentials and the CSRF header for the frontend only', async () => {
  const preflight = (origin) =>
    fetch(`${api}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-requested-with',
      },
    });

  const allowed = await preflight(TEST_ORIGIN);
  assert.equal(allowed.headers.get('access-control-allow-origin'), TEST_ORIGIN);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  assert.match(allowed.headers.get('access-control-allow-headers'), /X-Requested-With/i);

  const denied = await preflight('https://evil.example');
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

// --- Validation ---------------------------------------------------------

test('malformed registration input returns field errors without echoing values', async () => {
  const res = await postJson(
    `${api}/auth/register`,
    { name: '', email: 'not-an-email', password: 'short' },
    CSRF
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(body.error.details.map((d) => d.path).sort(), ['email', 'name', 'password']);
  assert.doesNotMatch(JSON.stringify(body), /not-an-email|short"/);
});

test('users cannot assign themselves a role at registration', async () => {
  const res = await postJson(`${api}/auth/register`, { ...validRegistration, role: 'admin' }, CSRF);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(body.error.details), /role/);
});

test('passwords longer than bcrypt can hash (72 bytes) are rejected, not truncated', async () => {
  const res = await postJson(
    `${api}/auth/register`,
    { ...validRegistration, password: 'é'.repeat(37) }, // 74 bytes in UTF-8
    CSRF
  );
  assert.equal(res.status, 400);
  assert.match((await res.json()).error.details[0].message, /72 bytes/);
});

test('login rejects non-string and missing fields', async () => {
  const res = await postJson(`${api}/auth/login`, { email: ['a@b.co'], password: 42 }, CSRF);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');

  const empty = await postJson(`${api}/auth/login`, '', CSRF);
  assert.equal(empty.status, 400);
});

test('invalid JSON on auth endpoints returns 400 INVALID_JSON', async () => {
  const res = await postJson(`${api}/auth/login`, '{"email":', CSRF);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_JSON');
});

test('valid registration returns 503 (not a hang or 500) while the database is down', async () => {
  const res = await postJson(`${api}/auth/register`, validRegistration, CSRF);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'DATABASE_UNAVAILABLE');
});

// --- Tokens ---------------------------------------------------------------

test('GET /auth/me without a token returns 401 AUTH_REQUIRED', async () => {
  const res = await getMe();
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'AUTH_REQUIRED');
});

test('a non-Bearer Authorization header is rejected', async () => {
  const res = await getMe({ Authorization: 'Token abc' });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'INVALID_TOKEN');
});

test('malformed tokens are rejected', async () => {
  for (const token of ['garbage', 'a.b.c', '']) {
    const res = await getMe({ Authorization: `Bearer ${token}`.trim() });
    assert.equal(res.status, 401, `token "${token}"`);
    assert.equal((await res.json()).error.code, 'INVALID_TOKEN');
  }
});

test('expired tokens return 401 TOKEN_EXPIRED', async () => {
  const expired = tokenWith({ ver: 0, exp: Math.floor(Date.now() / 1000) - 60 });
  const res = await getMe({ Authorization: `Bearer ${expired}` });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'TOKEN_EXPIRED');
});

test('tokens signed with another secret, issuer, or audience are rejected', async () => {
  const forged = [
    tokenWith({ ver: 0 }, { secret: 'a-completely-different-secret-value-123', expiresIn: '1h' }),
    tokenWith({ ver: 0 }, { issuer: 'someone-else', expiresIn: '1h' }),
    tokenWith({ ver: 0 }, { audience: 'another-app', expiresIn: '1h' }),
  ];
  for (const token of forged) {
    const res = await getMe({ Authorization: `Bearer ${token}` });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'INVALID_TOKEN');
  }
});

test('unsigned ("alg": "none") tokens are rejected', async () => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: USER_ID,
    ver: 0,
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    iat: now,
    exp: now + 3600,
  })}.`;
  const res = await getMe({ Authorization: `Bearer ${unsigned}` });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'INVALID_TOKEN');
});

test('a valid session cookie passes verification (then needs the database)', async () => {
  const token = signAccessToken({ _id: USER_ID, tokenVersion: 0 }, config.jwt);
  const res = await getMe({ Cookie: `appcheck_session=${token}` });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'DATABASE_UNAVAILABLE');
});

test('logout without a session succeeds and clears the cookie', async () => {
  const res = await fetch(`${api}/auth/logout`, { method: 'POST', headers: CSRF });
  assert.equal(res.status, 204);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('appcheck_session='));
  assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
});

// --- Rate limiting ----------------------------------------------------------

test('repeated failed logins are rate limited', async () => {
  const limited = await startTestServer(makeTestConfig({ authRateLimits: { login: 2 } }));
  try {
    const attempt = () => postJson(`${limited.baseUrl}/api/v1/auth/login`, { email: 'x' }, CSRF);
    assert.equal((await attempt()).status, 400);
    assert.equal((await attempt()).status, 400);
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  } finally {
    await limited.close();
  }
});

test('registration is rate limited', async () => {
  const limited = await startTestServer(makeTestConfig({ authRateLimits: { register: 1 } }));
  try {
    const attempt = () => postJson(`${limited.baseUrl}/api/v1/auth/register`, {}, CSRF);
    assert.equal((await attempt()).status, 400);
    assert.equal((await attempt()).status, 429);
  } finally {
    await limited.close();
  }
});

// --- Authorization ------------------------------------------------------------

test('requireRole allows matching roles and rejects others', async () => {
  const app = express();
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role) req.user = { role };
    next();
  });
  app.get('/admin', requireRole('admin'), (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  const srv = app.listen(0);
  await new Promise((resolve) => srv.once('listening', resolve));
  const url = `http://127.0.0.1:${srv.address().port}/admin`;
  try {
    assert.equal((await fetch(url, { headers: { 'x-test-role': 'admin' } })).status, 200);
    const forbidden = await fetch(url, { headers: { 'x-test-role': 'user' } });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, 'FORBIDDEN');
    assert.equal((await fetch(url)).status, 401);
  } finally {
    await new Promise((resolve) => srv.close(resolve));
  }
  assert.throws(() => requireRole('superuser'), /Unknown role/);
});

// --- Logging ----------------------------------------------------------------

test('the logger redacts credentials, tokens, and password fields', () => {
  const lines = [];
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = createLogger({ logLevel: 'info' }, sink);
  logger.info(
    {
      req: { headers: { authorization: 'Bearer abc.def.ghi', cookie: 'appcheck_session=abc' } },
      body: { password: 'hunter2-secret', passwordHash: '$2b$12$abcdef' },
      user: { token: 'tok-123' },
    },
    'login attempt'
  );
  const output = lines.join('');
  for (const secret of ['abc.def.ghi', 'appcheck_session=abc', 'hunter2-secret', '$2b$12$abcdef', 'tok-123']) {
    assert.ok(!output.includes(secret), `log output leaked ${secret}`);
  }
  assert.match(output, /\[REDACTED\]/);
});
