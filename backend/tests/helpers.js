import { createApp } from '../src/app.js';
import { createLogger } from '../src/config/logger.js';

export const TEST_ORIGIN = 'http://localhost:3000';
export const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

/** A config object shaped like parseEnv()'s output, for tests. */
export function makeTestConfig(overrides = {}) {
  return {
    nodeEnv: 'test',
    isProduction: false,
    port: 0,
    mongodbUri: 'mongodb+srv://user:pass@example.invalid/appcheck',
    dnsServers: [],
    corsOrigins: [TEST_ORIGIN],
    logLevel: 'silent',
    jwt: { secret: 'test-secret-that-is-at-least-32-characters-long', expiresIn: '1h', expiresInMs: 3_600_000 },
    // Minimum bcrypt cost keeps tests fast; production config enforces 10-15.
    bcryptSaltRounds: 4,
    ...overrides,
  };
}

/**
 * Resolver for tests: no real DNS. Hosts containing "internal-resolve" act as
 * names that resolve to a private address; everything else resolves to a
 * fixed public address.
 */
export async function fakeResolveTarget(rawUrl) {
  const { TargetNotAllowedError } = await import('../src/scanner/targetPolicy.js');
  const url = new URL(rawUrl);
  if (url.hostname.includes('internal-resolve')) {
    throw new TargetNotAllowedError('TARGET_NOT_ALLOWED', 'The host name resolves to a local, private, or reserved address');
  }
  if (url.hostname.includes('nxdomain')) {
    throw new TargetNotAllowedError('TARGET_UNRESOLVABLE', 'The host name could not be resolved');
  }
  return { url: url.href, hostname: url.hostname, port: 443, address: '93.184.215.14', family: 4 };
}

/** Starts the app on a random port. Returns { baseUrl, close }. */
export async function startTestServer(config = makeTestConfig(), services = { resolveTarget: fakeResolveTarget }) {
  const app = createApp({ config, logger: createLogger(config), services });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Extracts "name=value" for the session cookie from a response's Set-Cookie headers. */
export function sessionCookieFrom(res) {
  const header = res.headers.getSetCookie().find((c) => c.startsWith('appcheck_session='));
  return header ? header.split(';')[0] : null;
}
