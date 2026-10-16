// The per-scan egress proxy, exercised with real local sockets. The upstream
// "target" is a local server; the proxy is pinned to 127.0.0.1 under the
// unresolvable name target.test, which also proves it never consults DNS.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { startEgressProxy } from '../src/scanner/egressProxy.js';

let upstream;
let upstreamPort;
const seen = [];

before(async () => {
  upstream = http.createServer((req, res) => {
    seen.push({ url: req.url, host: req.headers.host, proxyAuth: req.headers['proxy-authorization'] });
    if (req.url === '/redirect') return res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }).end();
    if (req.url === '/big') return res.end(Buffer.alloc(64 * 1024, 'a'));
    if (req.url === '/hang') return; // never responds
    res.end('hello from target');
  });
  upstream.on('connect', () => {}); // not used
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  upstreamPort = upstream.address().port;
});

after(() => new Promise((resolve) => upstream.close(resolve)));

async function withProxy(limits, fn) {
  const proxy = await startEgressProxy({ hostname: 'target.test', address: '127.0.0.1', ports: [upstreamPort], limits });
  try {
    return await fn(proxy);
  } finally {
    await proxy.close();
  }
}

const auth = (proxy) => `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`;

function viaProxy(proxy, url, { withAuth = true } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: proxy.port,
      path: url,
      headers: withAuth ? { 'proxy-authorization': auth(proxy) } : {},
    });
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      res.on('error', () => resolve({ status: res.statusCode, aborted: true, body: Buffer.concat(chunks).toString() }));
      res.on('aborted', () => resolve({ status: res.statusCode, aborted: true, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', (error) => resolve({ error }));
    req.end();
  });
}

function connectVia(proxy, target, withAuth = true) {
  return new Promise((resolve) => {
    const socket = net.connect(proxy.port, '127.0.0.1', () => {
      socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${withAuth ? `Proxy-Authorization: ${auth(proxy)}\r\n` : ''}\r\n`);
    });
    let data = '';
    socket.on('data', (d) => {
      data += d;
      if (data.includes('\r\n\r\n')) {
        resolve({ status: Number(data.split(' ')[1]), socket });
      }
    });
    socket.on('error', () => resolve({ status: null, socket }));
  });
}

test('requests without the per-scan credentials are refused (407)', async () => {
  await withProxy({}, async (proxy) => {
    const res = await viaProxy(proxy, `http://target.test:${upstreamPort}/`, { withAuth: false });
    assert.equal(res.status, 407);
    const tunnel = await connectVia(proxy, `target.test:${upstreamPort}`, false);
    assert.equal(tunnel.status, 407);
    tunnel.socket.destroy();
  });
});

test('the target host is reached at the pinned address, with the Host header kept and proxy auth stripped', async () => {
  await withProxy({}, async (proxy) => {
    seen.length = 0;
    const res = await viaProxy(proxy, `http://target.test:${upstreamPort}/page?q=1`);
    assert.equal(res.status, 200);
    assert.equal(res.body, 'hello from target');
    assert.deepEqual(seen[0], { url: '/page?q=1', host: `target.test:${upstreamPort}`, proxyAuth: undefined });
  });
});

test('other hosts, metadata addresses, and other ports are blocked before any connection', async () => {
  await withProxy({}, async (proxy) => {
    seen.length = 0;
    for (const url of [
      `http://other.example.com:${upstreamPort}/`,
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1/',
      'http://target.test:22/',
    ]) {
      assert.equal((await viaProxy(proxy, url)).status, 403, url);
    }
    for (const target of ['169.254.169.254:80', 'other.example.com:443', 'target.test:22']) {
      const tunnel = await connectVia(proxy, target);
      assert.equal(tunnel.status, 403, target);
      tunnel.socket.destroy();
    }
    assert.equal(seen.length, 0, 'nothing reached the upstream');
    assert.equal(proxy.stats.blocked, 7);
  });
});

test('redirects are passed back, and the redirect destination is validated as a new request', async () => {
  await withProxy({}, async (proxy) => {
    const res = await viaProxy(proxy, `http://target.test:${upstreamPort}/redirect`);
    assert.equal(res.status, 302);
    const follow = await viaProxy(proxy, res.headers.location);
    assert.equal(follow.status, 403, 'redirect to the metadata address is refused');
  });
});

test('CONNECT tunnels open only to the pinned address on an allowed port', async () => {
  await withProxy({}, async (proxy) => {
    const tunnel = await connectVia(proxy, `target.test:${upstreamPort}`);
    assert.equal(tunnel.status, 200);
    const reply = await new Promise((resolve) => {
      let data = '';
      tunnel.socket.on('data', (d) => {
        data += d;
        if (data.includes('hello from target')) resolve(data);
      });
      tunnel.socket.write(`GET /tunnel HTTP/1.1\r\nHost: target.test\r\nConnection: close\r\n\r\n`);
    });
    assert.match(reply, /200 OK/);
    tunnel.socket.destroy();
  });
});

test('size, request-count, and idle limits are enforced', async () => {
  await withProxy({ maxResponseBytes: 1024 }, async (proxy) => {
    const big = await viaProxy(proxy, `http://target.test:${upstreamPort}/big`);
    assert.ok(big.aborted || big.error || big.body.length <= 1024, 'oversized response was cut off');
    assert.equal(proxy.stats.limitHit, 'response-size');
  });
  await withProxy({ maxRequests: 2 }, async (proxy) => {
    assert.equal((await viaProxy(proxy, `http://target.test:${upstreamPort}/`)).status, 200);
    assert.equal((await viaProxy(proxy, `http://target.test:${upstreamPort}/`)).status, 200);
    assert.equal((await viaProxy(proxy, `http://target.test:${upstreamPort}/`)).status, 503);
  });
  await withProxy({ connectTimeoutMs: 200, idleTimeoutMs: 200 }, async (proxy) => {
    const started = Date.now();
    const res = await viaProxy(proxy, `http://target.test:${upstreamPort}/hang`);
    assert.ok(res.status === 502 || res.error || res.aborted, 'hung request was ended');
    assert.ok(Date.now() - started < 5000);
  });
});
