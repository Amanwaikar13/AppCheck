// Scan tests that do NOT need a database: model validation, request
// validation, target safeguards, sorting, and the HTTP behavior of the scan
// routes when there is no session, no CSRF header, or no database.
// Database-backed flows live in scan.integration.test.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { Scan, toPublicScan } from '../src/models/Scan.js';
import { toMongoSort } from '../src/services/scan.service.js';
import { signAccessToken } from '../src/services/token.service.js';
import { describeBlockedHost, isNonPublicIp } from '../src/utils/networkTarget.js';
import {
  createSourceScanSchema,
  createUrlScanSchema,
  listScansQuerySchema,
  scanIdParamsSchema,
} from '../src/validators/scan.validators.js';
import { CSRF, makeTestConfig, postJson, startTestServer } from './helpers.js';

const config = makeTestConfig();
const USER_ID = new mongoose.Types.ObjectId();
let server;
let api;

before(async () => {
  server = await startTestServer(config);
  api = `${server.baseUrl}/api/v1`;
});

after(() => server.close());

const issuesOf = (schema, value) => {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};
const parsed = (schema, value) => schema.parse(value);

// --- Scan model ---------------------------------------------------------

test('Scan model: new records default to queued with no score, findings, or run times', () => {
  const scan = new Scan({ userId: USER_ID, type: 'url', target: 'https://example.com/' });
  assert.equal(scan.validateSync(), undefined);
  assert.equal(scan.status, 'queued');
  assert.equal(scan.securityScore, null);
  assert.equal(scan.findingsCount, null);
  assert.equal(scan.startedAt, null);
  assert.equal(scan.completedAt, null);
});

test('Scan model: userId, type, and target are required', () => {
  const error = new Scan({}).validateSync();
  assert.ok(error);
  assert.deepEqual(Object.keys(error.errors).sort(), ['target', 'type', 'userId']);
});

test('Scan model: type and status must be allowed enum values', () => {
  const error = new Scan({ userId: USER_ID, type: 'zip', target: 'x', status: 'done' }).validateSync();
  assert.ok(error.errors.type);
  assert.ok(error.errors.status);
  for (const status of ['queued', 'running', 'completed', 'failed']) {
    assert.equal(new Scan({ userId: USER_ID, type: 'source', target: 'x', status }).validateSync(), undefined);
  }
});

test('Scan model: securityScore is 0-100 and findingsCount a non-negative integer', () => {
  const base = { userId: USER_ID, type: 'url', target: 'https://example.com/' };
  assert.ok(new Scan({ ...base, securityScore: 101 }).validateSync().errors.securityScore);
  assert.ok(new Scan({ ...base, securityScore: -1 }).validateSync().errors.securityScore);
  assert.ok(new Scan({ ...base, findingsCount: -1 }).validateSync().errors.findingsCount);
  assert.ok(new Scan({ ...base, findingsCount: 1.5 }).validateSync().errors.findingsCount);
});

test('Scan model: target length is bounded', () => {
  const error = new Scan({ userId: USER_ID, type: 'url', target: 'x'.repeat(2049) }).validateSync();
  assert.ok(error.errors.target);
});

test('Scan model: unknown fields are rejected rather than stored', () => {
  assert.throws(
    () => new Scan({ userId: USER_ID, type: 'url', target: 'x', metadata: { anything: true } }),
    /not in schema/
  );
});

test('Scan model: owner, type, and target cannot change after creation', () => {
  const scan = new Scan({ userId: USER_ID, type: 'url', target: 'https://example.com/' });
  scan.$isNew = false; // as if loaded from the database
  scan.userId = new mongoose.Types.ObjectId();
  scan.type = 'source';
  scan.target = 'https://other.example/';
  assert.equal(scan.userId.toString(), USER_ID.toString());
  assert.equal(scan.type, 'url');
  assert.equal(scan.target, 'https://example.com/');
});

test('Scan model: indexes support per-user, newest-first history', () => {
  const indexes = Scan.schema.indexes().map(([fields]) => fields);
  assert.deepEqual(indexes[0], { userId: 1, createdAt: -1, _id: -1 });
  assert.ok(indexes.some((fields) => fields.userId === 1 && fields.type === 1));
  assert.ok(indexes.some((fields) => fields.userId === 1 && fields.status === 1));
});

test('toPublicScan exposes an allowlist of fields and never the owner', () => {
  const scan = new Scan({ userId: USER_ID, type: 'source', target: 'payments-api' });
  const publicScan = toPublicScan(scan);
  assert.deepEqual(Object.keys(publicScan).sort(), [
    'completedAt',
    'createdAt',
    'engine',
    'error',
    'findingsCount',
    'id',
    'securityScore',
    'severityCounts',
    'startedAt',
    'status',
    'target',
    'type',
    'updatedAt',
  ]);
  assert.equal(publicScan.id, scan._id.toString());
  assert.doesNotMatch(JSON.stringify(publicScan), new RegExp(USER_ID.toString()));
});

// --- URL scan validation ------------------------------------------------

test('URL scans accept public http(s) URLs and normalize them', () => {
  assert.equal(parsed(createUrlScanSchema, { url: '  https://Example.COM/a?b=1#section ' }).url, 'https://example.com/a?b=1');
  assert.equal(parsed(createUrlScanSchema, { url: 'http://example.org' }).url, 'http://example.org/');
  assert.equal(parsed(createUrlScanSchema, { url: 'https://example.com:8443/app' }).url, 'https://example.com:8443/app');
  assert.equal(parsed(createUrlScanSchema, { url: 'https://8.8.8.8/' }).url, 'https://8.8.8.8/');
  assert.equal(parsed(createUrlScanSchema, { url: 'https://[2606:4700:4700::1111]/' }).url, 'https://[2606:4700:4700::1111]/');
});

test('URL scans reject malformed URLs and non-http(s) schemes', () => {
  for (const url of ['', 'example.com', 'not a url', 'https://', 'ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'https://exa mple.com', 'https://example.com/\u0000']) {
    assert.ok(issuesOf(createUrlScanSchema, { url }).length > 0, `accepted ${JSON.stringify(url)}`);
  }
  assert.deepEqual(issuesOf(createUrlScanSchema, {}), ['URL is required']);
  assert.deepEqual(issuesOf(createUrlScanSchema, { url: 42 }), ['URL must be a string']);
  assert.ok(issuesOf(createUrlScanSchema, { url: `https://example.com/${'a'.repeat(2048)}` }).length > 0);
});

test('URL scans reject embedded credentials', () => {
  for (const url of ['https://user:pass@example.com', 'https://user@example.com', 'https://:pass@example.com']) {
    assert.deepEqual(issuesOf(createUrlScanSchema, { url }), ['URL must not contain a username or password']);
  }
});

test('URL scans reject local, private, and reserved targets', () => {
  const blocked = [
    'http://localhost',
    'http://LOCALHOST:3000/admin',
    'http://app.localhost',
    'http://localhost.',
    'http://printer.local',
    'http://db.internal',
    'http://intranet',
    'http://127.0.0.1',
    'http://127.1',
    'http://2130706433',
    'http://0x7f000001',
    'http://0.0.0.0',
    'http://10.0.0.5',
    'http://172.16.4.4',
    'http://192.168.1.1',
    'http://100.64.0.1',
    'http://169.254.169.254/latest/meta-data/',
    'http://224.0.0.1',
    'http://255.255.255.255',
    'http://[::1]',
    'http://[::]',
    'http://[::ffff:127.0.0.1]',
    'http://[fd12:3456::1]',
    'http://[fe80::1]',
  ];
  for (const url of blocked) {
    assert.equal(issuesOf(createUrlScanSchema, { url }).length, 1, `accepted ${url}`);
  }
});

test('network safeguards check each address family separately', () => {
  assert.equal(isNonPublicIp('8.8.8.8'), false);
  assert.equal(isNonPublicIp('172.15.255.255'), false);
  assert.equal(isNonPublicIp('172.32.0.1'), false);
  assert.equal(isNonPublicIp('2606:4700::1111'), false);
  assert.equal(isNonPublicIp('172.31.255.255'), true);
  assert.equal(isNonPublicIp('::ffff:8.8.8.8'), true, 'IPv4-mapped addresses are not accepted');
  assert.equal(describeBlockedHost(new URL('https://example.com')), null);
});

test('URL scan bodies are strict: protected and unknown fields are rejected', () => {
  for (const extra of [
    { userId: USER_ID.toString() },
    { status: 'completed' },
    { securityScore: 100 },
    { findingsCount: 0 },
    { startedAt: '2026-01-01T00:00:00Z' },
    { completedAt: '2026-01-01T00:00:00Z' },
    { createdAt: '2026-01-01T00:00:00Z' },
    { type: 'source' },
    { metadata: { a: 1 } },
  ]) {
    const result = createUrlScanSchema.safeParse({ url: 'https://example.com', ...extra });
    assert.equal(result.success, false, `accepted ${Object.keys(extra)[0]}`);
  }
});

// --- Source scan validation ---------------------------------------------

test('source scans accept safe project names and normalize whitespace', () => {
  assert.equal(parsed(createSourceScanSchema, { projectName: '  payments-api ' }).projectName, 'payments-api');
  assert.equal(parsed(createSourceScanSchema, { projectName: 'acme/web   frontend' }).projectName, 'acme/web frontend');
  assert.equal(parsed(createSourceScanSchema, { projectName: 'service_v2.1' }).projectName, 'service_v2.1');
});

test('source scans reject unsafe or malformed project names', () => {
  const rejected = ['', '   ', '../etc/passwd', 'a/../b', '/root', 'a//b', 'trailing/', '-flag', '.hidden', '<script>', 'name;rm -rf', 'C:\temp', 'x'.repeat(101)];
  for (const projectName of rejected) {
    assert.ok(issuesOf(createSourceScanSchema, { projectName }).length > 0, `accepted ${JSON.stringify(projectName)}`);
  }
  assert.deepEqual(issuesOf(createSourceScanSchema, {}), ['Project name is required']);
});

test('source scan bodies are strict: no file, status, or owner fields', () => {
  for (const extra of [{ file: 'UEsDBA==' }, { zip: 'x' }, { status: 'completed' }, { userId: 'x' }, { findingsCount: 3 }]) {
    assert.equal(createSourceScanSchema.safeParse({ projectName: 'api', ...extra }).success, false);
  }
});

// --- History query and ID validation ------------------------------------

test('history query: defaults and allowed values', () => {
  assert.deepEqual(parsed(listScansQuerySchema, {}), { page: 1, limit: 20, sort: '-createdAt' });
  assert.deepEqual(
    parsed(listScansQuerySchema, { page: '3', limit: '100', type: 'source', status: 'failed', sort: 'target' }),
    { page: 3, limit: 100, type: 'source', status: 'failed', sort: 'target' }
  );
});

test('history query: rejects bad paging, filters, sort fields, and unknown params', () => {
  for (const query of [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { page: '1001' },
    { limit: '0' },
    { limit: '101' },
    { type: 'zip' },
    { status: 'done' },
    { sort: 'userId' },
    { sort: 'securityScore' },
    { sort: '{"$natural":1}' },
    { type: ['url', 'source'] },
    { userId: USER_ID.toString() },
    { owner: 'me' },
  ]) {
    assert.equal(listScansQuerySchema.safeParse(query).success, false, `accepted ${JSON.stringify(query)}`);
  }
});

test('scan IDs must be 24 hex characters', () => {
  assert.equal(scanIdParamsSchema.safeParse({ id: '65f000000000000000000001' }).success, true);
  for (const id of ['', '123', 'abcdefabcdef', 'zzzzzzzzzzzzzzzzzzzzzzzz', '65f0000000000000000000011', '{"$ne":null}']) {
    assert.equal(scanIdParamsSchema.safeParse({ id }).success, false, `accepted ${id}`);
  }
});

test('sort options map to stable Mongo sorts with _id as the final tie-breaker', () => {
  assert.deepEqual(toMongoSort('-createdAt'), { createdAt: -1, _id: -1 });
  assert.deepEqual(toMongoSort('createdAt'), { createdAt: 1, _id: 1 });
  assert.deepEqual(toMongoSort('target'), { target: 1, createdAt: -1, _id: -1 });
  assert.deepEqual(toMongoSort('-status'), { status: -1, createdAt: -1, _id: -1 });
});

// --- HTTP: authentication, CSRF, database availability -----------------

const scanRequests = (headers = {}) => [
  ['POST /scans/url', () => postJson(`${api}/scans/url`, { url: 'https://example.com' }, headers)],
  ['POST /scans/source', () => postJson(`${api}/scans/source`, { projectName: 'api' }, headers)],
  ['GET /scans', () => fetch(`${api}/scans`, { headers })],
  ['GET /scans/:id', () => fetch(`${api}/scans/65f000000000000000000001`, { headers })],
];

test('every scan endpoint requires authentication', async () => {
  for (const [name, send] of scanRequests(CSRF)) {
    const res = await send();
    assert.equal(res.status, 401, name);
    assert.equal((await res.json()).error.code, 'AUTH_REQUIRED', name);
  }
});

test('scan endpoints reject invalid and forged tokens', async () => {
  const forged = signAccessToken({ _id: USER_ID }, { secret: 'x'.repeat(40), expiresIn: '1h' });
  for (const headers of [
    { Authorization: 'Bearer not-a-jwt' },
    { Authorization: `Bearer ${forged}` },
    { Cookie: `appcheck_session=${forged}` },
  ]) {
    const res = await fetch(`${api}/scans`, { headers });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, 'INVALID_TOKEN');
  }
});

test('creating scans with a cookie requires the CSRF header and an allowed origin', async () => {
  const token = signAccessToken({ _id: USER_ID }, config.jwt);
  const cookie = { Cookie: `appcheck_session=${token}` };
  for (const path of ['url', 'source']) {
    const missingHeader = await postJson(`${api}/scans/${path}`, { url: 'https://example.com' }, cookie);
    assert.equal(missingHeader.status, 403);
    assert.equal((await missingHeader.json()).error.code, 'CSRF_REJECTED');

    const foreignOrigin = await postJson(`${api}/scans/${path}`, { url: 'https://example.com' }, {
      ...cookie,
      ...CSRF,
      Origin: 'https://evil.example',
    });
    assert.equal(foreignOrigin.status, 403);
    assert.equal((await foreignOrigin.json()).error.code, 'CSRF_REJECTED');
  }
});

test('with a valid session but no database, scan endpoints return 503 without internals', async () => {
  const token = signAccessToken({ _id: USER_ID }, config.jwt);
  for (const headers of [{ Authorization: `Bearer ${token}` }, { Cookie: `appcheck_session=${token}`, ...CSRF }]) {
    for (const [name, send] of scanRequests(headers)) {
      const res = await send();
      assert.equal(res.status, 503, name);
      assert.deepEqual(await res.json(), {
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is temporarily unavailable. Please try again shortly.',
        },
      });
    }
  }
});

test('scan routes fall under the global API rate limit', async () => {
  const limited = await startTestServer(config);
  try {
    let res;
    for (let i = 0; i < 101; i += 1) {
      res = await fetch(`${limited.baseUrl}/api/v1/scans`);
      if (i < 100) await res.arrayBuffer();
    }
    assert.equal(res.status, 429);
    assert.deepEqual(await res.json(), {
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    });
  } finally {
    await limited.close();
  }
});

test('API info lists the scans endpoint', async () => {
  const res = await fetch(api);
  assert.equal((await res.json()).endpoints.scans, '/api/v1/scans');
});
