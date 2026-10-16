import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/config/env.js';

const valid = {
  NODE_ENV: 'test',
  PORT: '5000',
  MONGODB_URI: 'mongodb+srv://user:s3cret@cluster0.example.mongodb.net/appcheck',
  FRONTEND_URL: 'http://localhost:3000, https://app.example.com/',
  JWT_SECRET: 'x'.repeat(40),
};

test('parses a valid configuration', () => {
  const config = parseEnv(valid);
  assert.equal(config.port, 5000);
  assert.equal(config.nodeEnv, 'test');
  assert.deepEqual(config.corsOrigins, ['http://localhost:3000', 'https://app.example.com']);
});

test('fails clearly when MONGODB_URI is missing', () => {
  const { MONGODB_URI, ...rest } = valid;
  assert.throws(() => parseEnv(rest), /MONGODB_URI: MONGODB_URI is required/);
});

test('rejects a non-MongoDB URI', () => {
  assert.throws(
    () => parseEnv({ ...valid, MONGODB_URI: 'postgres://x' }),
    /must start with mongodb\+srv:\/\/ or mongodb:\/\//
  );
});

test('rejects placeholder values copied from .env.example', () => {
  assert.throws(
    () => parseEnv({ ...valid, MONGODB_URI: 'mongodb+srv://<db_user>:<db_password>@<cluster-host>/x' }),
    /placeholder/
  );
});

test('error messages never echo the secret value', () => {
  try {
    parseEnv({ ...valid, MONGODB_URI: 'notmongo://user:hunter2@host', PORT: 'abc' });
    assert.fail('expected parseEnv to throw');
  } catch (error) {
    assert.match(error.message, /PORT/);
    assert.doesNotMatch(error.message, /hunter2/);
  }
});

test('rejects an invalid FRONTEND_URL', () => {
  assert.throws(() => parseEnv({ ...valid, FRONTEND_URL: 'not a url' }), /FRONTEND_URL/);
});

test('requires a JWT_SECRET of at least 32 characters', () => {
  const { JWT_SECRET, ...rest } = valid;
  assert.throws(() => parseEnv(rest), /JWT_SECRET: JWT_SECRET is required/);
  assert.throws(() => parseEnv({ ...valid, JWT_SECRET: 'short' }), /at least 32 characters/);
  assert.throws(() => parseEnv({ ...valid, JWT_SECRET: '<generate-a-random-secret>xxxxxxxxxx' }), /placeholder/);
});

test('JWT and bcrypt settings have safe defaults and are validated', () => {
  const config = parseEnv(valid);
  assert.deepEqual(
    { expiresIn: config.jwt.expiresIn, expiresInMs: config.jwt.expiresInMs },
    { expiresIn: '1h', expiresInMs: 3_600_000 }
  );
  assert.equal(config.bcryptSaltRounds, 12);
  assert.equal(parseEnv({ ...valid, JWT_EXPIRES_IN: '30m' }).jwt.expiresInMs, 1_800_000);
  assert.throws(() => parseEnv({ ...valid, JWT_EXPIRES_IN: 'forever' }), /JWT_EXPIRES_IN/);
  assert.throws(() => parseEnv({ ...valid, BCRYPT_SALT_ROUNDS: '4' }), /between 10 and 15/);
});

test('configuration errors never echo the JWT secret', () => {
  try {
    parseEnv({ ...valid, JWT_SECRET: 'tooshort-secret-value', PORT: 'abc' });
    assert.fail('expected parseEnv to throw');
  } catch (error) {
    assert.doesNotMatch(error.message, /tooshort-secret-value/);
  }
});

test('TRUST_PROXY is off by default and accepts hop counts or proxy addresses only', () => {
  assert.equal(parseEnv(valid).trustProxy, false);
  assert.equal(parseEnv({ ...valid, TRUST_PROXY: 'false' }).trustProxy, false);
  assert.equal(parseEnv({ ...valid, TRUST_PROXY: '1' }).trustProxy, 1);
  assert.equal(parseEnv({ ...valid, TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
  assert.equal(parseEnv({ ...valid, TRUST_PROXY: '10.0.0.0/8' }).trustProxy, '10.0.0.0/8');
  assert.throws(() => parseEnv({ ...valid, TRUST_PROXY: 'true' }), /spoofed X-Forwarded-For/);
  assert.throws(() => parseEnv({ ...valid, TRUST_PROXY: '0' }), /at least 1/);
});

test('URL scanner settings: disabled by default, explicit opt-in, validated', () => {
  const config = parseEnv(valid);
  assert.equal(config.scanner.enabled, false);
  assert.equal(config.scanner.zap.image, 'zaproxy/zap-stable');
  assert.equal(config.scanner.proxyBindHost, '127.0.0.1');
  assert.equal(config.scanner.labTargets.size, 0);
  assert.equal(parseEnv({ ...valid, URL_SCANNER: 'zap-docker' }).scanner.enabled, true);
  assert.throws(() => parseEnv({ ...valid, URL_SCANNER: 'yes' }), /URL_SCANNER/);
  assert.throws(() => parseEnv({ ...valid, ZAP_DOCKER_IMAGE: 'zap; rm -rf /' }), /ZAP_DOCKER_IMAGE/);
  assert.throws(() => parseEnv({ ...valid, SCANNER_PROXY_BIND: '0.0.0.0; x' }), /SCANNER_PROXY_BIND/);
});

test('SCANNER_LAB_TARGETS only maps reserved .test names, and never in production', () => {
  const lab = parseEnv({ ...valid, SCANNER_LAB_TARGETS: 'juice.lab.test=127.0.0.1, dvwa.test=::1' }).scanner.labTargets;
  assert.deepEqual([...lab], [['juice.lab.test', '127.0.0.1'], ['dvwa.test', '::1']]);
  for (const bad of ['example.com=127.0.0.1', 'juice.test=localhost', 'juice.test', 'evil.test.com=1.2.3.4']) {
    assert.throws(() => parseEnv({ ...valid, SCANNER_LAB_TARGETS: bad }), /SCANNER_LAB_TARGETS/, bad);
  }
  assert.throws(
    () => parseEnv({ ...valid, NODE_ENV: 'production', SCANNER_LAB_TARGETS: 'juice.lab.test=127.0.0.1' }),
    /not allowed when NODE_ENV=production/
  );
});
