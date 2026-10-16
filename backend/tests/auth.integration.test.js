// INTEGRATION TESTS — REQUIRE MONGODB ATLAS CREDENTIALS.
//
// Uses TEST_MONGODB_URI if set, otherwise MONGODB_URI from backend/.env, and
// always writes to a separate database (TEST_MONGODB_DB_NAME, default
// "appcheck_test") so application data is never touched. Each run uses unique
// email addresses and deletes only the users it created.
//
// If the database cannot be reached, every test here is reported as SKIPPED
// with the connection error; they are never counted as passing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { User } from '../src/models/User.js';
import { CSRF, makeTestConfig, postJson, sessionCookieFrom, startTestServer } from './helpers.js';

const TEST_DB_NAME = process.env.TEST_MONGODB_DB_NAME || 'appcheck_test';
const RUN_ID = randomUUID().slice(0, 8);
const emailFor = (label) => `it-${RUN_ID}-${label}@example.com`;
const PASSWORD = 'integration-Test-pass-1';

let skipReason = false;
try {
  const env = loadEnv();
  const uri = process.env.TEST_MONGODB_URI || env.mongodbUri;
  await connectDatabase(uri, createLogger({ logLevel: 'silent' }), {
    dnsServers: env.dnsServers,
    dbName: TEST_DB_NAME,
  });
  if (mongoose.connection.db.databaseName !== TEST_DB_NAME) {
    throw new Error(`Refusing to run: connected to "${mongoose.connection.db.databaseName}"`);
  }
  await User.init();
} catch (error) {
  skipReason = `Requires MongoDB Atlas: ${error.message.split('\n')[0]}`;
}

// This file registers more accounts than the default limit of 5 per window
// allows; the limiter itself is covered in auth.test.js.
const config = makeTestConfig({ authRateLimits: { register: 50 } });
let server;
let api;

before(async () => {
  if (skipReason) return;
  server = await startTestServer(config);
  api = `${server.baseUrl}/api/v1`;
});

after(async () => {
  if (skipReason) return;
  await server.close();
  await User.deleteMany({ email: new RegExp(`^it-${RUN_ID}-`) });
  await disconnectDatabase();
});

const register = (body) => postJson(`${api}/auth/register`, body, CSRF);
const login = (body) => postJson(`${api}/auth/login`, body, CSRF);
const me = (headers) => fetch(`${api}/auth/me`, { headers });

function assertNoSecrets(json) {
  const text = JSON.stringify(json);
  assert.doesNotMatch(text, /passwordHash|tokenVersion|\$2[aby]\$/);
  assert.ok(!text.includes(PASSWORD), 'response contains the plaintext password');
}

test('registration creates a user, starts a session, and returns a safe profile', { skip: skipReason }, async () => {
  const res = await register({ name: 'Grace', email: `  ${emailFor('reg').toUpperCase()} `, password: PASSWORD });
  assert.equal(res.status, 201);
  const body = await res.json();
  assertNoSecrets(body);
  assert.deepEqual(Object.keys(body.user).sort(), ['createdAt', 'email', 'id', 'lastLoginAt', 'name', 'role']);
  assert.equal(body.user.email, emailFor('reg'), 'email is trimmed and lowercased');
  assert.equal(body.user.role, 'user');

  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('appcheck_session='));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\/api\/v1/);
  assert.equal(res.headers.get('cache-control'), 'no-store');

  const stored = await User.findOne({ email: emailFor('reg') }).select('+passwordHash').lean();
  assert.notEqual(stored.passwordHash, PASSWORD);
  assert.match(stored.passwordHash, /^\$2[aby]\$04\$/, 'stored as a bcrypt hash');
  assert.ok(await bcrypt.compare(PASSWORD, stored.passwordHash));
});

test('duplicate email registration returns 409, regardless of case', { skip: skipReason }, async () => {
  assert.equal((await register({ name: 'A', email: emailFor('dup'), password: PASSWORD })).status, 201);
  const res = await register({ name: 'B', email: emailFor('dup').toUpperCase(), password: PASSWORD });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, 'EMAIL_TAKEN');
  assert.equal(await User.countDocuments({ email: emailFor('dup') }), 1);
});

test('login succeeds with correct credentials and returns a safe profile', { skip: skipReason }, async () => {
  await register({ name: 'Lin', email: emailFor('login'), password: PASSWORD });
  const res = await login({ email: emailFor('login'), password: PASSWORD });
  assert.equal(res.status, 200);
  const body = await res.json();
  assertNoSecrets(body);
  assert.equal(body.user.email, emailFor('login'));
  assert.ok(body.user.lastLoginAt);
  assert.ok(sessionCookieFrom(res));
});

test('invalid credentials return the same generic 401', { skip: skipReason }, async () => {
  await register({ name: 'Wu', email: emailFor('badpass'), password: PASSWORD });
  const wrongPassword = await login({ email: emailFor('badpass'), password: 'not-the-password' });
  const unknownEmail = await login({ email: emailFor('nobody'), password: PASSWORD });
  for (const res of [wrongPassword, unknownEmail]) {
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), {
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    assert.equal(sessionCookieFrom(res), null);
  }
});

test('GET /auth/me works with the session cookie and with a Bearer token', { skip: skipReason }, async () => {
  const res = await register({ name: 'Mo', email: emailFor('me'), password: PASSWORD });
  const cookie = sessionCookieFrom(res);
  const token = cookie.split('=')[1];

  for (const headers of [{ Cookie: cookie }, { Authorization: `Bearer ${token}` }]) {
    const meRes = await me(headers);
    assert.equal(meRes.status, 200);
    const body = await meRes.json();
    assertNoSecrets(body);
    assert.equal(body.user.email, emailFor('me'));
  }
});

test('self-assigning admin is impossible; role stays "user"', { skip: skipReason }, async () => {
  const attempts = [
    { name: 'Eve', email: emailFor('eve'), password: PASSWORD, role: 'admin' },
    { name: 'Eve', email: emailFor('eve'), password: PASSWORD, isAdmin: true },
  ];
  for (const body of attempts) {
    assert.equal((await register(body)).status, 400);
  }
  assert.equal(await User.countDocuments({ email: emailFor('eve') }), 0);

  // Login input cannot carry a role either.
  await register({ name: 'Eve', email: emailFor('eve'), password: PASSWORD });
  const res = await login({ email: emailFor('eve'), password: PASSWORD, role: 'admin' });
  assert.equal(res.status, 400);
  const stored = await User.findOne({ email: emailFor('eve') }).lean();
  assert.equal(stored.role, 'user');
});

test('admin role (set out of band) is reflected and revokes old sessions', { skip: skipReason }, async () => {
  const res = await register({ name: 'Root', email: emailFor('admin'), password: PASSWORD });
  const oldCookie = sessionCookieFrom(res);

  // Simulates `npm run user:set-role`: role change plus session revocation.
  await User.updateOne({ email: emailFor('admin') }, { $set: { role: 'admin' }, $inc: { tokenVersion: 1 } });
  assert.equal((await me({ Cookie: oldCookie })).status, 401);

  const fresh = await login({ email: emailFor('admin'), password: PASSWORD });
  assert.equal((await fresh.json()).user.role, 'admin');
});

test('logout revokes the session token, including copies of it', { skip: skipReason }, async () => {
  const res = await register({ name: 'Bo', email: emailFor('logout'), password: PASSWORD });
  const cookie = sessionCookieFrom(res);
  const token = cookie.split('=')[1];

  const out = await fetch(`${api}/auth/logout`, { method: 'POST', headers: { ...CSRF, Cookie: cookie } });
  assert.equal(out.status, 204);

  for (const headers of [{ Cookie: cookie }, { Authorization: `Bearer ${token}` }]) {
    const after = await me(headers);
    assert.equal(after.status, 401);
    assert.equal((await after.json()).error.code, 'INVALID_TOKEN');
  }
});

test('tokens for deleted users are rejected', { skip: skipReason }, async () => {
  const res = await register({ name: 'Gone', email: emailFor('deleted'), password: PASSWORD });
  const cookie = sessionCookieFrom(res);
  await User.deleteOne({ email: emailFor('deleted') });
  const after = await me({ Cookie: cookie });
  assert.equal(after.status, 401);
});

test('the login limiter counts only failed attempts', { skip: skipReason }, async () => {
  await register({ name: 'Rate', email: emailFor('ratelimit'), password: PASSWORD });
  // A separate app instance with a login limit of 2, so this test has its own counters.
  const limited = await startTestServer(makeTestConfig({ authRateLimits: { login: 2 } }));
  const tryLogin = (password) =>
    postJson(`${limited.baseUrl}/api/v1/auth/login`, { email: emailFor('ratelimit'), password }, CSRF);
  try {
    for (let i = 0; i < 4; i += 1) {
      assert.equal((await tryLogin(PASSWORD)).status, 200, `successful login ${i + 1} was limited`);
    }
    assert.equal((await tryLogin('wrong-password-1')).status, 401);
    assert.equal((await tryLogin('wrong-password-2')).status, 401);
    const blocked = await tryLogin('wrong-password-3');
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
    assert.ok(Number(blocked.headers.get('retry-after')) > 0, 'Retry-After is set');
    // Once blocked, even the correct password must wait (no bypass by guessing right).
    assert.equal((await tryLogin(PASSWORD)).status, 429);
  } finally {
    await limited.close();
  }
});
