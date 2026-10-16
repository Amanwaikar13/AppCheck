import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { redactConnectionStrings } from '../src/utils/redact.js';
import { startTestServer } from './helpers.js';

// These tests run without a database, so they exercise the "disconnected" path.
let server;
let baseUrl;

before(async () => {
  server = await startTestServer();
  ({ baseUrl } = server);
});

after(() => server.close());

test('GET /api/v1/health reports 503 unhealthy when the database is disconnected', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.status, 503);

  const body = await res.json();
  assert.equal(body.name, 'AppCheck');
  assert.equal(body.status, 'unhealthy');
  assert.equal(body.database.status, 'disconnected');
  assert.equal(body.environment, 'test');
  assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  assert.doesNotMatch(JSON.stringify(body), /mongodb|pass/i);
});

test('GET /api/v1 returns API info', async () => {
  const res = await fetch(`${baseUrl}/api/v1`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).endpoints.health, '/api/v1/health');
});

test('unknown routes return a JSON 404', async () => {
  const res = await fetch(`${baseUrl}/api/v1/does-not-exist`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), {
    error: { code: 'NOT_FOUND', message: 'Route GET /api/v1/does-not-exist not found' },
  });
});

test('malformed JSON bodies return 400 without a stack trace', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, 'INVALID_JSON');
  assert.equal(body.error.stack, undefined);
});

test('CORS allows the configured frontend origin', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`, {
    headers: { Origin: 'http://localhost:3000' },
  });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:3000');
});

test('CORS does not allow other origins', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`, {
    headers: { Origin: 'http://evil.example' },
  });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('security headers and rate-limit headers are set', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok(res.headers.get('ratelimit'));
});

test('redactConnectionStrings strips credentials', () => {
  assert.equal(
    redactConnectionStrings('failed: mongodb+srv://bob:p%40ss@cluster0.x.net/db'),
    'failed: mongodb+srv://<credentials>@cluster0.x.net/db'
  );
});
