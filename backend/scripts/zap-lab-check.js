// Real OWASP ZAP boundary check (requires Docker + zaproxy/zap-stable).
//   node scripts/zap-lab-check.js
// Everything is local: a TARGET server (scanned) and a CANARY server that
// must never be contacted. The target links and redirects to the canary via
// another host name and via host.docker.internal. ZAP must reach the target
// only through the egress proxy; any canary hit means ZAP bypassed it.
// No database, no public hosts, no metadata addresses. Exit 1 on any failure.
import http from 'node:http';
import { startEgressProxy } from '../src/scanner/egressProxy.js';
import { normalizeZapReport } from '../src/scanner/normalize.js';
import { resolveTarget } from '../src/scanner/targetPolicy.js';
import { DEFAULT_ZAP_OPTIONS, checkZapAvailable, runZapBaseline } from '../src/scanner/zapRunner.js';

const results = [];
const check = (name, ok, info = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
};

function serve(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const availability = await checkZapAvailable();
if (!availability.available) {
  console.log(`NOT RUN: ${availability.reason}. No scan was performed.`);
  process.exit(2);
}

const canaryHits = [];
const canary = await serve((req, res) => {
  canaryHits.push(`${req.method} ${req.headers.host}${req.url}`);
  res.end('canary');
});
const C = canary.address().port;

const targetHits = [];
const target = await serve((req, res) => {
  targetHits.push({ host: req.headers.host, url: req.url });
  if (req.url === '/redirect-other-host') return res.writeHead(302, { Location: `http://canary.lab.test:${C}/redirected` }).end();
  if (req.url === '/redirect-host-gateway') return res.writeHead(302, { Location: `http://host.docker.internal:${C}/redirected` }).end();
  res.setHeader('Content-Type', 'text/html');
  res.end(`<html><body><h1>AppCheck lab target</h1>
    <a href="/page2">same host</a>
    <a href="/redirect-other-host">redirect to other host</a>
    <a href="/redirect-host-gateway">redirect to host gateway</a>
    <a href="http://canary.lab.test:${C}/link">other host</a>
    <a href="http://host.docker.internal:${C}/direct">host gateway</a>
    <form action="/login" method="post"><input name="password" type="password"></form>
  </body></html>`);
});
const T = target.address().port;

const labTargets = new Map([['target.lab.test', '127.0.0.1']]);
const resolved = await resolveTarget(`http://target.lab.test:${T}/`, { labTargets });
const options = { ...DEFAULT_ZAP_OPTIONS, spiderMinutes: 1, maxMinutes: 5, timeoutMs: 8 * 60 * 1000 };

async function scan(limits, zapOptions = options) {
  const proxy = await startEgressProxy({ hostname: resolved.hostname, address: resolved.address, ports: [resolved.port], limits });
  try {
    const result = await runZapBaseline({ targetUrl: resolved.url, proxy, options: zapOptions });
    return { result, stats: { ...proxy.stats } };
  } catch (error) {
    return { error, stats: { ...proxy.stats } };
  } finally {
    await proxy.close();
  }
}

console.log(`Run 1: full baseline scan of ${resolved.url} (pinned to ${resolved.address})`);
const run1 = await scan({});
check('ZAP ran and produced a report', !run1.error, run1.error ? `${run1.error.code}: ${run1.error.detail ?? run1.error.message}`.slice(0, 600) : '');
check('traffic went through the egress proxy (proxyStats.requests > 0)', run1.stats.requests > 0, JSON.stringify(run1.stats));
check('target received requests', targetHits.length > 0, `${targetHits.length} requests`);
check('every target request carried the scanned host name', targetHits.every((h) => h.host === `target.lab.test:${T}`));
check('links/redirects to other hosts were attempted and blocked by the proxy', run1.stats.blocked > 0, `blocked=${run1.stats.blocked}`);
check('CANARY: no request bypassed the proxy', canaryHits.length === 0, canaryHits.join(', ') || 'none');
if (run1.result) {
  const findings = normalizeZapReport(run1.result.report);
  check('genuine ZAP report normalized into findings', findings.length > 0, findings.map((f) => `${f.severity}:${f.title}`).join('; ').slice(0, 400));
}

console.log('Run 2: request limit');
const run2 = await scan({ maxRequests: 3 });
check('request cap enforced', run2.stats.limitHit === 'requests' && run2.stats.requests <= 3, JSON.stringify(run2.stats));

console.log('Run 3: time limit');
const started = Date.now();
const run3 = await scan({}, { ...options, timeoutMs: 45_000 });
check('scan killed at the time limit', run3.error?.code === 'SCANNER_TIMEOUT' && Date.now() - started < 90_000, run3.error?.code ?? 'completed before limit');
check('CANARY: still no bypass after all runs', canaryHits.length === 0);

canary.close();
target.close();
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} CHECK(S) FAILED. If the canary was hit, keep URL_SCANNER=disabled.` : '\nAll boundary checks passed.');
process.exit(failed ? 1 : 0);
