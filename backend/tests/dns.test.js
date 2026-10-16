import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import { parseEnv } from '../src/config/env.js';
import { applyDnsServers, connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { createLogger } from '../src/config/logger.js';

const originalServers = dns.getServers();
afterEach(() => dns.setServers(originalServers));

const baseEnv = {
  MONGODB_URI: 'mongodb+srv://user:s3cret@cluster0.example.mongodb.net/appcheck',
  FRONTEND_URL: 'http://localhost:3000',
  JWT_SECRET: 'x'.repeat(40),
};

test('DNS_SERVERS is parsed into a list of IPs', () => {
  const config = parseEnv({ ...baseEnv, DNS_SERVERS: ' 8.8.8.8 , 1.1.1.1,2001:4860:4860::8888 ' });
  assert.deepEqual(config.dnsServers, ['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888']);
});

test('DNS_SERVERS is optional', () => {
  assert.deepEqual(parseEnv(baseEnv).dnsServers, []);
  assert.deepEqual(parseEnv({ ...baseEnv, DNS_SERVERS: '' }).dnsServers, []);
});

test('invalid DNS_SERVERS values fail with a clear message', () => {
  for (const value of ['dns.google', '8.8.8', '8.8.8.8;1.1.1.1', '999.1.1.1']) {
    assert.throws(
      () => parseEnv({ ...baseEnv, DNS_SERVERS: value }),
      /DNS_SERVERS: DNS_SERVERS must contain IP addresses/,
      `expected "${value}" to be rejected`
    );
  }
});

test('applyDnsServers changes the resolver used by dns.promises (and the MongoDB driver)', () => {
  assert.deepEqual(applyDnsServers(['8.8.8.8', '1.1.1.1']), ['8.8.8.8', '1.1.1.1']);
  // The MongoDB driver resolves SRV records with dns.promises.resolve(), which uses this resolver.
  assert.deepEqual(dns.promises.getServers(), ['8.8.8.8', '1.1.1.1']);
});

test('applyDnsServers leaves system servers alone when none are configured', () => {
  assert.deepEqual(applyDnsServers([]), originalServers);
});

test('connectDatabase applies DNS_SERVERS before the SRV lookup and redacts credentials', async () => {
  // The .invalid TLD never resolves, so this fails fast without touching a real cluster.
  const logger = createLogger({ logLevel: 'silent' });
  const uri = 'mongodb+srv://user:s3cret@cluster0.appcheck-test.invalid/appcheck';

  await assert.rejects(
    connectDatabase(uri, logger, { dnsServers: ['127.0.0.1'] }),
    (error) => {
      assert.deepEqual(error.dnsServers, ['127.0.0.1']);
      assert.doesNotMatch(error.message, /s3cret/);
      return true;
    }
  );
  assert.deepEqual(dns.getServers(), ['127.0.0.1']);
  await disconnectDatabase();
});
