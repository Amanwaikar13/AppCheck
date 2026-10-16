import dns from 'node:dns';
import net from 'node:net';
import { describeBlockedHost, isNonPublicIp } from '../utils/networkTarget.js';

/*
 * Resolves a scan target and decides whether it may be contacted.
 *
 * The URL text check (describeBlockedHost) cannot see where a hostname
 * points. This resolves the name, requires EVERY returned address to be
 * public, and returns one address to pin: the scanner then connects only to
 * that address (see egressProxy.js), so a later DNS answer cannot redirect it
 * to an internal host (DNS rebinding).
 */

export const DNS_TIMEOUT_MS = 5000;

export class TargetNotAllowedError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TargetNotAllowedError';
    this.code = code;
  }
}

function defaultLookup(hostname) {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('DNS lookup timed out'), { code: 'ETIMEOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Returns { url, hostname, port, address, family } for an allowed target, or
 * throws TargetNotAllowedError with a client-safe message (never an IP).
 * `lookup` is injectable for tests: (hostname) => [{ address, family }].
 */
export async function resolveTarget(rawUrl, { lookup = defaultLookup, timeoutMs = DNS_TIMEOUT_MS, labTargets = null } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TargetNotAllowedError('TARGET_INVALID', 'The target URL is not valid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TargetNotAllowedError('TARGET_INVALID', 'Only http and https targets are allowed');
  }
  if (url.username || url.password) {
    throw new TargetNotAllowedError('TARGET_INVALID', 'The target URL must not contain credentials');
  }
  // Development-only lab targets (SCANNER_LAB_TARGETS): an explicit mapping
  // from a reserved *.test name to a local address, for scanning a
  // deliberately vulnerable app on this machine. Refused in production (env.js).
  const labAddress = labTargets?.get(url.hostname.toLowerCase());
  if (labAddress) {
    const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);
    return { url: url.href, hostname: url.hostname, port, address: labAddress, family: net.isIP(labAddress) };
  }

  const blocked = describeBlockedHost(url);
  if (blocked) throw new TargetNotAllowedError('TARGET_NOT_ALLOWED', blocked);

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const port = Number(url.port) || (url.protocol === 'https:' ? 443 : 80);

  let addresses;
  if (net.isIP(hostname)) {
    addresses = [{ address: hostname, family: net.isIP(hostname) }];
  } else {
    try {
      addresses = await withTimeout(lookup(hostname), timeoutMs);
    } catch (error) {
      const timedOut = error?.code === 'ETIMEOUT';
      throw new TargetNotAllowedError(
        'TARGET_UNRESOLVABLE',
        timedOut ? 'The host name could not be resolved in time' : 'The host name could not be resolved'
      );
    }
  }

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new TargetNotAllowedError('TARGET_UNRESOLVABLE', 'The host name could not be resolved');
  }
  // All answers must be public: a name that also points at a private address
  // could be served that address on a later lookup.
  if (addresses.some(({ address }) => !net.isIP(address) || isNonPublicIp(address))) {
    throw new TargetNotAllowedError(
      'TARGET_NOT_ALLOWED',
      'The host name resolves to a local, private, or reserved address'
    );
  }

  // Prefer IPv4 for the pinned connection (widest container network support).
  const pinned = addresses.find(({ family }) => family === 4) ?? addresses[0];
  return { url: url.href, hostname: url.hostname, port, address: pinned.address, family: net.isIP(pinned.address) };
}
