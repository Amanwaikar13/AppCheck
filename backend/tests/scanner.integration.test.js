// INTEGRATION TESTS — REQUIRE MONGODB ATLAS (appcheck_test database).
// The scan worker and scan/finding APIs with a MOCKED scanner: no Docker, ZAP,
// DNS, or network traffic to any target. Skipped (never passed) without a DB.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Finding } from '../src/models/Finding.js';
import { Scan } from '../src/models/Scan.js';
import { User } from '../src/models/User.js';
import { TargetNotAllowedError } from '../src/scanner/targetPolicy.js';
import { completeScan } from '../src/scanner/urlScanJob.js';
import { createScanWorker } from '../src/scanner/worker.js';
import { ScannerError } from '../src/scanner/zapRunner.js';
import { CSRF, fakeResolveTarget, makeTestConfig, postJson, sessionCookieFrom, startTestServer } from './helpers.js';

const TEST_DB_NAME = process.env.TEST_MONGODB_DB_NAME || 'appcheck_test';
const RUN_ID = randomUUID().slice(0, 8);
const emailFor = (label) => `scanner-it-${RUN_ID}-${label}@example.com`;

let skipReason = false;
try {
  const env = loadEnv();
  await connectDatabase(process.env.TEST_MONGODB_URI || env.mongodbUri, createLogger({ logLevel: 'silent' }), {
    dnsServers: env.dnsServers,
    dbName: TEST_DB_NAME,
  });
  if (mongoose.connection.db.databaseName !== TEST_DB_NAME) throw new Error('Refusing to run: wrong database');
  await Promise.all([User.init(), Scan.init(), Finding.init()]);
} catch (error) {
  skipReason = `Requires MongoDB Atlas: ${error.message.split('\n')[0]}`;
}

const logger = createLogger({ logLevel: 'silent' });
let server;
let api;
let scannerAvailable = true;
const users = {};

const REPORT = {
  site: [
    {
      alerts: [
        { alertRef: '10038', alert: 'Content Security Policy (CSP) Header Not Set', riskcode: '2', confidence: '3', desc: '<p>CSP missing.</p>', solution: '<p>Set CSP.</p>', cweid: '693', count: '2', instances: [{ uri: 'https://shop.example.com/', method: 'GET' }, { uri: 'https://shop.example.com/cart', method: 'GET' }] },
        { alertRef: '10020-1', alert: 'Missing Anti-clickjacking Header', riskcode: '2', confidence: '2', desc: 'x', solution: 'y', count: '1', instances: [{ uri: 'https://shop.example.com/', method: 'GET' }] },
        { alertRef: '10021', alert: 'X-Content-Type-Options Header Missing', riskcode: '1', confidence: '2', desc: 'x', solution: 'y', count: '4', instances: [{ uri: 'https://shop.example.com/a.js', method: 'GET' }] },
        { alertRef: '10096', alert: 'Timestamp Disclosure - Unix', riskcode: '0', confidence: '1', desc: 'x', solution: 'y', count: '1', instances: [{ uri: 'https://shop.example.com/', method: 'GET', evidence: '1700000000' }] },
      ],
    },
  ],
};

/** A worker with mocked scanner dependencies, limited to this file's users. */
function makeWorker(overrides = {}) {
  const calls = { resolve: [], zap: [], proxyClosed: 0 };
  const deps = {
    resolveTarget: overrides.resolveTarget ?? (async (url) => { calls.resolve.push(url); return fakeResolveTarget(url); }),
    startEgressProxy: async () => ({ port: 1, username: 'u', password: 'p', stats: {}, close: async () => { calls.proxyClosed += 1; } }),
    runZapBaseline: overrides.runZapBaseline ?? (async (args) => { calls.zap.push(args); return { report: REPORT, exitCode: 2, durationMs: 5 }; }),
  };
  const worker = createScanWorker({
    scannerConfig: { enabled: true, zap: {}, proxyBindHost: '127.0.0.1' },
    logger,
    deps,
    checkAvailable: async () => (scannerAvailable ? { available: true, reason: null } : { available: false, reason: 'Docker is not installed or not running on the scanner host' }),
    availabilityTtlMs: 0,
    claimScope: { userId: { $in: Object.values(users).map((u) => new mongoose.Types.ObjectId(u.id)) } },
    ...overrides.worker,
  });
  return { worker, calls };
}

async function signUp(label) {
  const res = await postJson(`${api}/auth/register`, { name: label, email: emailFor(label), password: 'integration-Test-pass-1' }, CSRF);
  assert.equal(res.status, 201);
  const { user } = await res.json();
  const cookie = sessionCookieFrom(res);
  return { id: user.id, cookie, headers: { Cookie: cookie, ...CSRF } };
}

before(async () => {
  if (skipReason) return;
  server = await startTestServer(makeTestConfig({ authRateLimits: { register: 20 } }), {
    resolveTarget: fakeResolveTarget,
    scannerStatus: () => ({ enabled: true, available: scannerAvailable, reason: scannerAvailable ? null : 'Docker is not installed or not running on the scanner host' }),
  });
  api = `${server.baseUrl}/api/v1`;
  for (const label of ['owner', 'other']) users[label] = await signUp(label);
});

after(async () => {
  if (skipReason) return;
  await server.close();
  const ids = Object.values(users).map(({ id }) => id);
  await Finding.deleteMany({ userId: { $in: ids } });
  await Scan.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ email: new RegExp(`^scanner-it-${RUN_ID}-`) });
  await disconnectDatabase();
});

const submit = async (user, url) => postJson(`${api}/scans/url`, { url }, user.headers);
const get = (user, path) => fetch(`${api}${path}`, { headers: { Cookie: user.cookie } });
const newScan = async (user, url) => (await (await submit(user, url)).json()).scan;

// --- Submission ---------------------------------------------------------

test('targets whose DNS points at private addresses are rejected at submission', { skip: skipReason }, async () => {
  for (const [url, message] of [
    ['https://app.internal-resolve.example.com/', /private, or reserved address/],
    ['https://nxdomain.example.com/', /could not be resolved/],
  ]) {
    const res = await submit(users.owner, url);
    assert.equal(res.status, 400);
    const { error } = await res.json();
    assert.equal(error.code, 'TARGET_NOT_ALLOWED');
    assert.equal(error.details[0].path, 'url');
    assert.match(error.details[0].message, message);
  }
  assert.equal(await Scan.countDocuments({ userId: users.owner.id }), 0);
});

test('scanner status is authenticated and honest about availability', { skip: skipReason }, async () => {
  assert.equal((await fetch(`${api}/scanner/status`)).status, 401);
  scannerAvailable = false;
  const body = await (await get(users.owner, '/scanner/status')).json();
  assert.deepEqual(body.url, {
    engine: 'OWASP ZAP baseline',
    mode: 'Passive checks only (spider and passive rules, no active attacks)',
    enabled: true,
    available: false,
    reason: 'Docker is not installed or not running on the scanner host',
  });
  assert.equal(body.source.available, false);
});

// --- Worker state transitions -------------------------------------------

test('while the scanner is unavailable, scans stay queued; they run once it is available', { skip: skipReason }, async () => {
  scannerAvailable = false;
  const res = await submit(users.owner, 'https://shop.example.com/');
  assert.equal(res.status, 201);
  const { scan, notice } = await res.json();
  assert.match(notice, /not available on this server/);
  const { worker, calls } = makeWorker();
  assert.equal(await worker.tick(), false);
  assert.equal(calls.zap.length, 0);
  assert.equal((await Scan.findById(scan.id).lean()).status, 'queued');

  scannerAvailable = true;
  let statusDuringScan;
  const { worker: ready } = makeWorker({
    runZapBaseline: async () => {
      statusDuringScan = await Scan.findById(scan.id).select('+lockedBy +heartbeatAt').lean();
      return { report: REPORT, exitCode: 2, durationMs: 5 };
    },
  });
  assert.equal(await ready.tick(), true);
  assert.equal(statusDuringScan.status, 'running', 'claimed as running before ZAP runs');
  assert.ok(statusDuringScan.startedAt && statusDuringScan.heartbeatAt);
  assert.equal(statusDuringScan.lockedBy, ready.workerId);

  const done = await (await get(users.owner, `/scans/${scan.id}`)).json();
  assert.equal(done.scan.status, 'completed');
  assert.equal(done.scan.engine, 'OWASP ZAP baseline');
  assert.equal(done.scan.findingsCount, 4);
  assert.deepEqual(done.scan.severityCounts, { critical: 0, high: 0, medium: 2, low: 1, info: 1 });
  assert.equal(done.scan.securityScore, 100 - (2 * 4 + 1 * 1), 'documented formula');
  assert.equal(done.scan.error, null);
  assert.ok(done.scan.completedAt);
  assert.doesNotMatch(JSON.stringify(done), /lockedBy|heartbeatAt|userId/);
});

test('findings are stored per scan with owner, and readable only by the owner', { skip: skipReason }, async () => {
  const [scan] = await Scan.find({ userId: users.owner.id, status: 'completed' }).lean();
  const res = await get(users.owner, `/scans/${scan._id}/findings`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.status, 'completed');
  assert.deepEqual(body.items.map((f) => f.severity), ['medium', 'medium', 'low', 'info'], 'most severe first');
  const csp = body.items.find((f) => f.ruleId === '10038');
  assert.equal(csp.title, 'Content Security Policy (CSP) Header Not Set');
  assert.equal(csp.description, 'CSP missing.');
  assert.equal(csp.remediation, 'Set CSP.');
  assert.equal(csp.cweId, 693);
  assert.equal(csp.instances.length, 2);
  assert.doesNotMatch(JSON.stringify(body), /userId|fingerprint/);

  const stored = await Finding.find({ scanId: scan._id }).lean();
  assert.ok(stored.every((f) => f.userId.toString() === users.owner.id && f.source === 'zap'));

  const foreign = await get(users.other, `/scans/${scan._id}/findings`);
  assert.equal(foreign.status, 404);
  assert.equal((await foreign.json()).error.code, 'SCAN_NOT_FOUND');
  assert.equal((await get(users.other, `/scans/${scan._id}`)).status, 404);
  assert.equal((await get(users.owner, '/scans/not-an-id/findings')).status, 400);
  assert.equal((await get(users.owner, `/scans/${new mongoose.Types.ObjectId()}/findings`)).status, 404);
});

test('scanner failures and timeouts mark the scan failed with a safe summary and no findings', { skip: skipReason }, async () => {
  scannerAvailable = true;
  const cases = [
    [new ScannerError('SCANNER_TIMEOUT', 'The scan did not finish within the time limit', 'docker logs: connect 10.0.0.7 refused'), 'SCANNER_TIMEOUT', 'The scan did not finish within the time limit'],
    [new ScannerError('SCANNER_FAILED', 'The scanner could not complete the scan', 'exit 3 at /zap/zap.sh'), 'SCANNER_FAILED', 'The scanner could not complete the scan'],
    [Object.assign(new Error('ECONNREFUSED 10.0.0.7:27017 at Object.<anonymous> (/srv/app/x.js:1:1)'), { stack: 'secret stack' }), 'SCAN_FAILED', 'The scan failed because of an internal error'],
  ];
  for (const [error, code, message] of cases) {
    const scan = await newScan(users.owner, 'https://broken.example.com/');
    const { worker, calls } = makeWorker({ runZapBaseline: async () => { throw error; } });
    assert.equal(await worker.tick(), true);
    const body = await (await get(users.owner, `/scans/${scan.id}`)).json();
    assert.equal(body.scan.status, 'failed');
    assert.deepEqual(body.scan.error, { code, message });
    assert.equal(body.scan.findingsCount, null);
    assert.equal(body.scan.securityScore, null, 'no score without results');
    assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.7|zap\.sh|stack|\/srv\//);
    assert.equal(calls.proxyClosed, 1, 'egress proxy closed even on failure');
    assert.equal(await Finding.countDocuments({ scanId: scan.id }), 0);
  }
});

test('the target is re-validated at execution time (DNS rebinding after submission)', { skip: skipReason }, async () => {
  const scan = await newScan(users.owner, 'https://rebind.example.com/');
  const { worker, calls } = makeWorker({
    resolveTarget: async () => {
      throw new TargetNotAllowedError('TARGET_NOT_ALLOWED', 'The host name resolves to a local, private, or reserved address');
    },
  });
  assert.equal(await worker.tick(), true);
  assert.equal(calls.zap.length, 0, 'ZAP never started');
  const stored = await Scan.findById(scan.id).lean();
  assert.equal(stored.status, 'failed');
  assert.equal(stored.errorCode, 'TARGET_NOT_ALLOWED');
});

test('a queued scan is claimed by exactly one worker', { skip: skipReason }, async () => {
  await newScan(users.owner, 'https://race.example.com/');
  const a = makeWorker();
  const b = makeWorker();
  const results = await Promise.all([a.worker.tick(), b.worker.tick()]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(a.calls.zap.length + b.calls.zap.length, 1);
});

test('source scans are never claimed by the URL worker', { skip: skipReason }, async () => {
  const res = await postJson(`${api}/scans/source`, { projectName: 'acme/api' }, users.owner.headers);
  const { scan } = await res.json();
  const { worker, calls } = makeWorker();
  assert.equal(await worker.tick(), false);
  assert.equal(calls.zap.length, 0);
  assert.equal((await Scan.findById(scan.id).lean()).status, 'queued');
});

test('stale running scans are failed as interrupted, not retried', { skip: skipReason }, async () => {
  const stale = await Scan.create({ userId: users.owner.id, type: 'url', target: 'https://stale.example.com/' });
  await Scan.updateOne({ _id: stale._id }, { $set: { status: 'running', startedAt: new Date(Date.now() - 3_600_000), heartbeatAt: new Date(Date.now() - 3_600_000), lockedBy: 'dead-worker' } });
  const { worker } = makeWorker();
  assert.equal(await worker.recoverStale(), 1);
  const stored = await Scan.findById(stale._id).lean();
  assert.equal(stored.status, 'failed');
  assert.equal(stored.errorCode, 'SCAN_INTERRUPTED');
});

test('a worker that lost its lease cannot complete the scan', { skip: skipReason }, async () => {
  const scan = await Scan.create({ userId: users.owner.id, type: 'url', target: 'https://lease.example.com/' });
  await Scan.updateOne({ _id: scan._id }, { $set: { status: 'running', lockedBy: 'worker-a', heartbeatAt: new Date() } });
  assert.equal(await completeScan(scan, [], 'worker-b'), false);
  assert.equal((await Scan.findById(scan._id).lean()).status, 'running');
  await Scan.updateOne({ _id: scan._id }, { $set: { status: 'failed', lockedBy: null } });
});

test('dashboard summary reflects real records only, counting the latest scan per target', { skip: skipReason }, async () => {
  // A second completed scan of the same target must not double-count findings.
  await newScan(users.owner, 'https://shop.example.com/');
  const { worker } = makeWorker();
  assert.equal(await worker.tick(), true);
  const summary = await (await get(users.owner, '/scans/summary')).json();
  // Completed: shop.example.com twice, plus race.example.com from the claim test.
  assert.equal(summary.counts.completed, 3);
  assert.ok(summary.counts.failed >= 4);
  assert.equal(summary.counts.total, summary.counts.queued + summary.counts.running + summary.counts.completed + summary.counts.failed);
  assert.equal(summary.findings.targets, 2, 'two distinct targets, not three scans');
  // Latest scan of each of the 2 targets, each with the mocked report (2 medium, 1 low, 1 info).
  assert.deepEqual(summary.findings.bySeverity, { critical: 0, high: 0, medium: 4, low: 2, info: 2 });
  assert.equal(summary.findings.latest.target, 'https://shop.example.com/');
  assert.equal(summary.recent.length, 5);

  const other = await (await get(users.other, '/scans/summary')).json();
  assert.equal(other.counts.total, 0, 'another user sees nothing');
  assert.equal(other.findings.latest, null);
});
