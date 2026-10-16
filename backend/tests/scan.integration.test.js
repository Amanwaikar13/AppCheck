// INTEGRATION TESTS — REQUIRE MONGODB ATLAS CREDENTIALS.
//
// Same setup as auth.integration.test.js: TEST_MONGODB_URI if set, otherwise
// MONGODB_URI from backend/.env, always against a separate database
// (TEST_MONGODB_DB_NAME, default "appcheck_test"). Each run registers users
// with unique emails and deletes only those users and their scans.
//
// If the database cannot be reached, every test here is reported as SKIPPED
// with the connection error; they are never counted as passing.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Scan } from '../src/models/Scan.js';
import { User } from '../src/models/User.js';
import { CSRF, makeTestConfig, postJson, sessionCookieFrom, startTestServer } from './helpers.js';

const TEST_DB_NAME = process.env.TEST_MONGODB_DB_NAME || 'appcheck_test';
const RUN_ID = randomUUID().slice(0, 8);
const EMAIL_PATTERN = new RegExp(`^scan-it-${RUN_ID}-`);
const emailFor = (label) => `scan-it-${RUN_ID}-${label}@example.com`;
const PASSWORD = 'integration-Test-pass-1';
const CREATE_LIMIT = 8;

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
  await Promise.all([User.init(), Scan.init()]);
} catch (error) {
  skipReason = `Requires MongoDB Atlas: ${error.message.split('\n')[0]}`;
}

const config = makeTestConfig({
  authRateLimits: { register: 20 },
  scanRateLimits: { create: CREATE_LIMIT },
});
let server;
let api;
// Signed-in test users: { id, cookie, token, headers }
const users = {};

async function signUp(label) {
  const res = await postJson(`${api}/auth/register`, { name: label, email: emailFor(label), password: PASSWORD }, CSRF);
  assert.equal(res.status, 201, `could not register ${label}`);
  const { user } = await res.json();
  const cookie = sessionCookieFrom(res);
  return { id: user.id, cookie, token: cookie.split('=')[1], headers: { Cookie: cookie, ...CSRF } };
}

before(async () => {
  if (skipReason) return;
  server = await startTestServer(config);
  api = `${server.baseUrl}/api/v1`;
  for (const label of ['alice', 'bob', 'carol', 'dave']) users[label] = await signUp(label);
});

after(async () => {
  if (skipReason) return;
  await server.close();
  const ids = Object.values(users).map(({ id }) => id);
  await Scan.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ email: EMAIL_PATTERN });
  await disconnectDatabase();
});

const createUrl = (user, body) => postJson(`${api}/scans/url`, body, user.headers);
const createSource = (user, body) => postJson(`${api}/scans/source`, body, user.headers);
const list = (user, query = '') => fetch(`${api}/scans${query}`, { headers: { Cookie: user.cookie } });
const getOne = (user, id) => fetch(`${api}/scans/${id}`, { headers: { Cookie: user.cookie } });

const PUBLIC_KEYS = ['completedAt', 'createdAt', 'engine', 'error', 'findingsCount', 'id', 'securityScore', 'severityCounts', 'startedAt', 'status', 'target', 'type', 'updatedAt'];

function assertUnexecuted(scan) {
  assert.equal(scan.status, 'queued');
  assert.equal(scan.securityScore, null, 'no fabricated score');
  assert.equal(scan.findingsCount, null, 'no fabricated findings');
  assert.equal(scan.startedAt, null);
  assert.equal(scan.completedAt, null);
}

// --- Creation -----------------------------------------------------------

test('POST /scans/url creates a queued record owned by the signed-in user', { skip: skipReason }, async () => {
  const res = await createUrl(users.alice, { url: '  https://Example.com/app?x=1#top ' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  // The test server has no scanner, and the notice must say so rather than imply a scan will run.
  assert.match(body.notice, /not available/i);
  assert.deepEqual(Object.keys(body.scan).sort(), PUBLIC_KEYS);
  assert.equal(body.scan.type, 'url');
  assert.equal(body.scan.target, 'https://example.com/app?x=1');
  assertUnexecuted(body.scan);

  const stored = await Scan.findById(body.scan.id).lean();
  assert.equal(stored.userId.toString(), users.alice.id, 'owner comes from the session');
  assertUnexecuted(stored);
});

test('POST /scans/source creates a queued source record', { skip: skipReason }, async () => {
  const res = await createSource(users.alice, { projectName: ' acme/payments   api ' });
  assert.equal(res.status, 201);
  const { scan } = await res.json();
  assert.equal(scan.type, 'source');
  assert.equal(scan.target, 'acme/payments api');
  assertUnexecuted(scan);
  assert.equal((await Scan.findById(scan.id).lean()).userId.toString(), users.alice.id);
});

test('bearer tokens work without the CSRF header; cookies do not', { skip: skipReason }, async () => {
  const bearer = await postJson(`${api}/scans/url`, { url: 'https://bearer.example.com' }, {
    Authorization: `Bearer ${users.alice.token}`,
  });
  assert.equal(bearer.status, 201);

  const before = await Scan.countDocuments({ userId: users.alice.id });
  const cookieOnly = await postJson(`${api}/scans/url`, { url: 'https://csrf.example.com' }, { Cookie: users.alice.cookie });
  assert.equal(cookieOnly.status, 403);
  assert.equal((await cookieOnly.json()).error.code, 'CSRF_REJECTED');
  assert.equal(await Scan.countDocuments({ userId: users.alice.id }), before);
});

test('clients cannot set owner, status, score, findings, or timestamps', { skip: skipReason }, async () => {
  const affected = { userId: { $in: [users.carol.id, users.bob.id] } };
  const before = await Scan.countDocuments(affected);
  const attempts = [
    [createUrl, { url: 'https://example.com', userId: users.bob.id }],
    [createUrl, { url: 'https://example.com', status: 'completed' }],
    [createUrl, { url: 'https://example.com', securityScore: 100 }],
    [createUrl, { url: 'https://example.com', findingsCount: 0 }],
    [createUrl, { url: 'https://example.com', createdAt: '2020-01-01T00:00:00Z' }],
    [createSource, { projectName: 'api', status: 'running' }],
    [createSource, { projectName: 'api', completedAt: '2020-01-01T00:00:00Z' }],
  ];
  for (const [send, body] of attempts) {
    const res = await send(users.carol, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    const { error } = await res.json();
    assert.equal(error.code, 'VALIDATION_ERROR');
  }
  assert.equal(await Scan.countDocuments(affected), before, 'nothing was stored');
});

test('invalid or unsafe targets are rejected and not stored', { skip: skipReason }, async () => {
  const before = await Scan.countDocuments({ userId: users.carol.id });
  for (const body of [{ url: 'http://localhost:5000' }, { url: 'https://user:pw@example.com' }, { url: 'ftp://example.com' }]) {
    const res = await createUrl(users.carol, body);
    assert.equal(res.status, 400);
    const { error } = await res.json();
    assert.equal(error.details[0].path, 'url');
    assert.doesNotMatch(JSON.stringify(error), /user:pw|localhost:5000/, 'submitted values are not echoed');
  }
  assert.equal((await createSource(users.carol, { projectName: '../secrets' })).status, 400);
  assert.equal(await Scan.countDocuments({ userId: users.carol.id }), before);
});

// --- History: pagination, filtering, sorting ----------------------------

// Carol gets five scans through the API plus one "failed" record inserted
// directly. That record is a test fixture for the status filter only; the
// API itself never sets a status other than "queued".
let carolIds = [];
async function seedCarol() {
  if (carolIds.length) return carolIds;
  await Scan.create({ userId: users.carol.id, type: 'source', target: 'zeta-fixture', status: 'failed' });
  const inputs = [
    [createUrl, { url: 'https://alpha.example.com' }],
    [createSource, { projectName: 'beta-project' }],
    [createUrl, { url: 'https://charlie.example.org' }],
    [createSource, { projectName: 'delta' }],
    [createUrl, { url: 'https://echo.example.net' }],
  ];
  for (const [send, body] of inputs) assert.equal((await send(users.carol, body)).status, 201);
  const docs = await Scan.find({ userId: users.carol.id }).sort({ createdAt: -1, _id: -1 }).lean();
  carolIds = docs.map((doc) => doc._id.toString());
  return carolIds;
}

test('GET /scans returns the newest scans first with pagination metadata', { skip: skipReason }, async () => {
  const expected = await seedCarol();
  const res = await list(users.carol);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(body.items.map((scan) => scan.id), expected);
  assert.deepEqual(body.pagination, {
    page: 1,
    limit: 20,
    totalItems: 6,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  assert.deepEqual(body.filters, { type: null, status: null });
  assert.equal(body.sort, '-createdAt');
  for (const scan of body.items) assert.deepEqual(Object.keys(scan).sort(), PUBLIC_KEYS);
});

test('pages do not overlap and cover every scan', { skip: skipReason }, async () => {
  const expected = await seedCarol();
  const seen = [];
  for (let page = 1; page <= 4; page += 1) {
    const body = await (await list(users.carol, `?limit=2&page=${page}`)).json();
    assert.equal(body.pagination.totalPages, 3);
    assert.equal(body.pagination.hasPreviousPage, page > 1);
    assert.equal(body.pagination.hasNextPage, page < 3);
    assert.equal(body.items.length, page <= 3 ? 2 : 0);
    seen.push(...body.items.map((scan) => scan.id));
  }
  assert.deepEqual(seen, expected);
});

test('history can be filtered by type and status', { skip: skipReason }, async () => {
  await seedCarol();
  const sources = await (await list(users.carol, '?type=source')).json();
  assert.equal(sources.pagination.totalItems, 3);
  assert.ok(sources.items.every((scan) => scan.type === 'source'));

  const failed = await (await list(users.carol, '?status=failed')).json();
  assert.deepEqual(failed.items.map((scan) => scan.target), ['zeta-fixture']);

  const queuedUrls = await (await list(users.carol, '?type=url&status=queued')).json();
  assert.equal(queuedUrls.pagination.totalItems, 3);
  assert.deepEqual(queuedUrls.filters, { type: 'url', status: 'queued' });
});

test('history can be sorted by allowlisted fields only', { skip: skipReason }, async () => {
  await seedCarol();
  const targets = (body) => body.items.map((scan) => scan.target);
  const ascending = await (await list(users.carol, '?sort=target')).json();
  assert.deepEqual(targets(ascending), [...targets(ascending)].sort());
  assert.equal(ascending.items[0].target, 'beta-project');

  const descending = await (await list(users.carol, '?sort=-target')).json();
  assert.deepEqual(targets(descending), [...targets(ascending)].reverse());

  const byStatus = await (await list(users.carol, '?sort=status')).json();
  assert.equal(byStatus.items[0].status, 'failed');

  const rejected = await list(users.carol, '?sort=userId');
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error.code, 'VALIDATION_ERROR');
});

// --- Single scan and ownership ------------------------------------------

test('GET /scans/:id returns the scan to its owner', { skip: skipReason }, async () => {
  const [id] = await seedCarol();
  const res = await getOne(users.carol, id);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { scan } = await res.json();
  assert.equal(scan.id, id);
  assert.deepEqual(Object.keys(scan).sort(), PUBLIC_KEYS);
});

test('users cannot read or list scans owned by someone else', { skip: skipReason }, async () => {
  const ids = await seedCarol();
  const missingId = new mongoose.Types.ObjectId().toString();

  const foreign = await getOne(users.bob, ids[0]);
  const missing = await getOne(users.bob, missingId);
  assert.equal(foreign.status, 404);
  assert.equal(missing.status, 404);
  const expected = { error: { code: 'SCAN_NOT_FOUND', message: 'Scan not found' } };
  assert.deepEqual(await foreign.json(), expected);
  assert.deepEqual(await missing.json(), expected, 'foreign and missing scans look the same');

  const bobList = await (await list(users.bob)).json();
  assert.ok(bobList.items.every((scan) => !ids.includes(scan.id)));

  // Query parameters cannot widen the owner filter.
  for (const query of [`?userId=${users.carol.id}`, '?userId[$ne]=x', '?owner=all']) {
    const res = await list(users.bob, query);
    assert.equal(res.status, 400, query);
  }
});

test('malformed scan IDs return 400; unknown valid IDs return 404', { skip: skipReason }, async () => {
  for (const id of ['not-an-id', 'abcdefabcdef']) {
    const res = await getOne(users.carol, id);
    assert.equal(res.status, 400, id);
    const { error } = await res.json();
    assert.equal(error.code, 'VALIDATION_ERROR');
    assert.equal(error.details[0].path, 'id');
  }
  const res = await getOne(users.carol, new mongoose.Types.ObjectId().toString());
  assert.equal(res.status, 404);
});

// --- Limits and honesty -------------------------------------------------

test('scan creation is rate limited per user', { skip: skipReason }, async () => {
  for (let i = 0; i < CREATE_LIMIT; i += 1) {
    assert.equal((await createSource(users.dave, { projectName: `project-${i}` })).status, 201);
  }
  const blocked = await createSource(users.dave, { projectName: 'one-too-many' });
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), {
    error: { code: 'RATE_LIMITED', message: 'Too many scan requests. Please try again later.' },
  });
  assert.equal(await Scan.countDocuments({ userId: users.dave.id }), CREATE_LIMIT);

  // The limit is per user: another account is unaffected.
  assert.equal((await createSource(users.bob, { projectName: 'unaffected' })).status, 201);
});

test('no scan created through the API has a score, findings, or run times', { skip: skipReason }, async () => {
  const ids = Object.values(users).map(({ id }) => id);
  const created = await Scan.find({ userId: { $in: ids }, target: { $ne: 'zeta-fixture' } }).lean();
  assert.ok(created.length > 0);
  for (const scan of created) assertUnexecuted(scan);
});

test('API errors never leak stack traces or database internals', { skip: skipReason }, async () => {
  const res = await getOne(users.carol, 'zzz');
  const text = await res.text();
  assert.doesNotMatch(text, /stack|mongo|CastError|at \w+ \(/i);
});
