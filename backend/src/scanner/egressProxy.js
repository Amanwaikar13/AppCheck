import { randomBytes, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';

/*
 * Per-scan egress guard. ZAP is configured to send ALL traffic through this
 * forward proxy, which:
 *  - accepts only the scan's own hostname, on its port or 80/443; every other
 *    host (including redirect targets on other hosts) is refused with 403;
 *  - never resolves DNS: it connects only to the address pinned and validated
 *    before the scan (targetPolicy.js), so DNS rebinding cannot redirect it;
 *  - requires per-scan proxy credentials, so no other local process can use it;
 *  - enforces connect/idle timeouts, a per-response size cap, and caps on the
 *    total bytes and requests for the whole scan.
 * HTTPS goes through CONNECT tunnels; TLS is negotiated end to end by ZAP.
 */

// Basic-auth realm in the 407 challenge. zapRunner passes the same value to
// ZAP (network.connection.httpProxy.realm) so its credentials match it.
export const PROXY_REALM = 'appcheck-scan';

export const DEFAULT_PROXY_LIMITS = Object.freeze({
  connectTimeoutMs: 10_000,
  idleTimeoutMs: 30_000,
  maxResponseBytes: 10 * 1024 * 1024,
  maxTotalBytes: 200 * 1024 * 1024,
  maxRequests: 5000,
});

const normalizeHost = (host) => String(host ?? '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function startEgressProxy({ hostname, address, ports = [], limits = {}, bindHost = '127.0.0.1' }) {
  const cfg = { ...DEFAULT_PROXY_LIMITS, ...limits };
  const allowedHost = normalizeHost(hostname);
  const allowedPorts = new Set([80, 443, ...ports].map(Number));
  const username = 'appcheck';
  const password = randomBytes(18).toString('base64url');
  const expectedAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const stats = { requests: 0, bytes: 0, blocked: 0, limitHit: null };
  const sockets = new Set();

  const authorized = (headers) => safeEqual(String(headers['proxy-authorization'] ?? ''), expectedAuth);
  const allowed = (host, port) => normalizeHost(host) === allowedHost && allowedPorts.has(Number(port));
  const budgetLeft = () => {
    if (stats.requests >= cfg.maxRequests) stats.limitHit = 'requests';
    if (stats.bytes >= cfg.maxTotalBytes) stats.limitHit = 'bytes';
    return !stats.limitHit;
  };
  const count = (chunk) => {
    stats.bytes += chunk.length;
    return stats.bytes <= cfg.maxTotalBytes;
  };

  const server = http.createServer((req, res) => {
    let target;
    try {
      target = new URL(req.url);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!authorized(req.headers)) {
      res.writeHead(407, { 'Proxy-Authenticate': `Basic realm="${PROXY_REALM}"` }).end();
      return;
    }
    const port = Number(target.port) || 80;
    if (target.protocol !== 'http:' || !allowed(target.hostname, port)) {
      stats.blocked += 1;
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Blocked by AppCheck scan policy');
      return;
    }
    if (!budgetLeft()) {
      res.writeHead(503, { 'Content-Type': 'text/plain' }).end('Scan traffic limit reached');
      return;
    }
    stats.requests += 1;

    const headers = { ...req.headers, host: target.host };
    delete headers['proxy-authorization'];
    delete headers['proxy-connection'];
    const upstream = http.request({
      host: address, // pinned: never re-resolved
      port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
      timeout: cfg.connectTimeoutMs,
    });
    upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502).end();
      else res.destroy();
    });
    upstream.on('response', (up) => {
      let size = 0;
      res.writeHead(up.statusCode, up.headers);
      up.setTimeout(cfg.idleTimeoutMs, () => up.destroy());
      up.on('data', (chunk) => {
        size += chunk.length;
        if (size > cfg.maxResponseBytes || !count(chunk)) {
          if (size > cfg.maxResponseBytes) stats.limitHit ??= 'response-size';
          up.destroy();
          res.destroy();
          return;
        }
        res.write(chunk);
      });
      up.on('end', () => res.end());
      up.on('error', () => res.destroy());
    });
    req.pipe(upstream);
  });

  server.on('connect', (req, client, head) => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => client.destroy());
    const [host, portText] = req.url.split(/:(?=\d+$)/);
    const reply = (status, text) => client.end(`HTTP/1.1 ${status} ${text}\r\n\r\n`);
    if (!authorized(req.headers)) {
      client.end(`HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="${PROXY_REALM}"\r\n\r\n`);
      return;
    }
    if (!portText || !allowed(host, portText)) {
      stats.blocked += 1;
      reply(403, 'Forbidden');
      return;
    }
    if (!budgetLeft()) {
      reply(503, 'Service Unavailable');
      return;
    }
    stats.requests += 1;
    const upstream = net.connect({ host: address, port: Number(portText) });
    sockets.add(upstream);
    upstream.on('close', () => sockets.delete(upstream));
    const connectTimer = setTimeout(() => upstream.destroy(), cfg.connectTimeoutMs);
    upstream.on('connect', () => {
      clearTimeout(connectTimer);
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) upstream.write(head);
      for (const socket of [client, upstream]) socket.setTimeout(cfg.idleTimeoutMs, () => socket.destroy());
      upstream.on('data', (chunk) => (count(chunk) ? client.write(chunk) : (upstream.destroy(), client.destroy())));
      client.pipe(upstream);
    });
    upstream.on('error', () => {
      clearTimeout(connectTimer);
      if (!client.destroyed) reply(502, 'Bad Gateway');
    });
    upstream.on('close', () => client.destroy());
    client.on('close', () => upstream.destroy());
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, bindHost, resolve);
  });

  return {
    port: server.address().port,
    username,
    password,
    stats,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
