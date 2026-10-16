import net from 'node:net';

/*
 * Record-time safeguards for URL scan targets.
 *
 * These checks reject targets that are *visibly* local or private: loopback,
 * private, link-local, and other special-purpose IP literals, plus hostnames
 * such as "localhost" or single-label intranet names. They cannot see where a
 * public-looking hostname resolves, and DNS answers can change between now and
 * the scan (DNS rebinding). The future scanner must therefore re-check the
 * resolved address at connection time; this is a first line, not the only one.
 */

// Special-purpose ranges (IANA IPv4/IPv6 Special-Purpose Address Registries).
const BLOCKED_IPV4 = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including cloud metadata (169.254.169.254)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, including 255.255.255.255
];

const BLOCKED_IPV6 = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['::ffff:0:0', 96], // IPv4-mapped (could wrap any private IPv4 address)
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard-only
  ['2001::', 23], // IETF protocol assignments (Teredo, ORCHID, ...)
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (embeds an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
];

// Separate lists per family: a single BlockList also matches IPv4 addresses
// against IPv6 rules (as ::ffff:a.b.c.d), so the IPv4-mapped rule above would
// block every IPv4 address.
const blockedIpv4 = new net.BlockList();
for (const [address, prefix] of BLOCKED_IPV4) blockedIpv4.addSubnet(address, prefix, 'ipv4');
const blockedIpv6 = new net.BlockList();
for (const [address, prefix] of BLOCKED_IPV6) blockedIpv6.addSubnet(address, prefix, 'ipv6');

// Names that always refer to the local machine or a private network.
const BLOCKED_HOST_SUFFIXES = [
  'localhost',
  'local',
  'localdomain',
  'internal',
  'intranet',
  'lan',
  'home.arpa',
  'corp',
  'private',
];

/** True if the IP literal is loopback, private, link-local, or otherwise non-public. */
export function isNonPublicIp(address) {
  const version = net.isIP(address);
  if (version === 4) return blockedIpv4.check(address, 'ipv4');
  if (version === 6) return blockedIpv6.check(address, 'ipv6');
  return false;
}

/**
 * Returns a reason string if the URL's host must not be scanned, otherwise null.
 * Expects a URL already parsed by WHATWG `URL`, which normalizes hosts: it
 * lowercases names, and turns IPv4 shorthand such as 2130706433 or 0x7f.1 into
 * dotted form, so those cannot slip past the IP checks.
 */
export function describeBlockedHost(url) {
  // IPv6 literals keep their brackets in URL.hostname.
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (net.isIP(host)) {
    return isNonPublicIp(host)
      ? 'URL must not point to a local, private, or reserved IP address'
      : null;
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    return 'URL must not point to a local or internal host';
  }

  // Single-label names ("intranet", "router") only resolve on local networks.
  if (!host.includes('.')) {
    return 'URL must use a fully qualified public domain name';
  }

  return null;
}
