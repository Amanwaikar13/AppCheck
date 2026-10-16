// Target resolution policy, ZAP report normalization, and the baseline score.
// No network: DNS is replaced by an injected lookup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TargetNotAllowedError, resolveTarget } from '../src/scanner/targetPolicy.js';
import { calculateBaselineScore, countBySeverity, normalizeZapReport, safeEvidence, toPlainText } from '../src/scanner/normalize.js';

const lookupReturning = (...addresses) => async () => addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));

test('a public hostname resolves and is pinned to a checked address (IPv4 preferred)', async () => {
  const target = await resolveTarget('https://app.example.com:8443/login', {
    lookup: lookupReturning('2606:4700::1111', '93.184.215.14'),
  });
  assert.deepEqual(target, {
    url: 'https://app.example.com:8443/login',
    hostname: 'app.example.com',
    port: 8443,
    address: '93.184.215.14',
    family: 4,
  });
});

test('names resolving to private, loopback, or metadata addresses are rejected (DNS-level SSRF)', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '169.254.169.254', '::1', 'fd00::5', '0.0.0.0']) {
    await assert.rejects(
      resolveTarget('https://innocent-looking.example.com', { lookup: lookupReturning(address) }),
      (error) => error instanceof TargetNotAllowedError && error.code === 'TARGET_NOT_ALLOWED',
      address
    );
  }
});

test('a name with ANY private answer is rejected, even if another answer is public', async () => {
  await assert.rejects(
    resolveTarget('https://mixed.example.com', { lookup: lookupReturning('93.184.215.14', '10.0.0.1') }),
    { code: 'TARGET_NOT_ALLOWED' }
  );
});

test('unresolvable names, timeouts, and malformed lookups fail safely', async () => {
  const nx = async () => {
    throw Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
  };
  await assert.rejects(resolveTarget('https://nope.example.com', { lookup: nx }), { code: 'TARGET_UNRESOLVABLE' });
  const hang = () => new Promise(() => {});
  await assert.rejects(resolveTarget('https://slow.example.com', { lookup: hang, timeoutMs: 30 }), {
    code: 'TARGET_UNRESOLVABLE',
    message: 'The host name could not be resolved in time',
  });
  await assert.rejects(resolveTarget('https://empty.example.com', { lookup: async () => [] }), { code: 'TARGET_UNRESOLVABLE' });
});

test('the URL text rules still apply, and IP literals are checked without DNS', async () => {
  const noDns = async () => assert.fail('DNS must not be used');
  for (const url of ['ftp://example.com', 'https://u:p@example.com', 'http://localhost', 'http://10.0.0.1', 'http://[::1]/', 'not a url']) {
    await assert.rejects(resolveTarget(url, { lookup: noDns }), TargetNotAllowedError, url);
  }
  assert.equal((await resolveTarget('http://8.8.8.8/', { lookup: noDns })).address, '8.8.8.8');
});

test('client-facing errors never contain the resolved IP address', async () => {
  try {
    await resolveTarget('https://rebind.example.com', { lookup: lookupReturning('10.20.30.40') });
    assert.fail('expected rejection');
  } catch (error) {
    assert.doesNotMatch(error.message, /10\.20\.30\.40/);
  }
});

// --- Normalization ---------------------------------------------------------

const zapAlert = (overrides = {}) => ({
  pluginid: '10038',
  alertRef: '10038',
  alert: 'Content Security Policy (CSP) Header Not Set',
  riskcode: '2',
  confidence: '3',
  desc: '<p>Content Security Policy (CSP) is an added layer of security.</p><p>Second &amp; last.</p>',
  solution: '<p>Ensure that your web server sets the <b>Content-Security-Policy</b> header.</p>',
  reference: '<p>https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP</p><p>javascript:alert(1)</p>',
  cweid: '693',
  wascid: '15',
  count: '3',
  instances: [
    { uri: 'https://app.example.com/', method: 'GET', param: '', evidence: '' },
    { uri: 'https://app.example.com/login', method: 'GET', param: '', evidence: '' },
    { uri: 'https://app.example.com/', method: 'GET', param: '', evidence: '' },
  ],
  ...overrides,
});

test('ZAP alerts are normalized: severity mapping, plain text, references, CWE', () => {
  const report = {
    site: [
      {
        alerts: [
          zapAlert(),
          zapAlert({ alertRef: '10020-1', pluginid: '10020', alert: 'Missing Anti-clickjacking Header', riskcode: '3' }),
          zapAlert({ alertRef: '10096', pluginid: '10096', alert: 'Timestamp Disclosure', riskcode: '0' }),
          zapAlert({ alertRef: '10021', pluginid: '10021', alert: 'X-Content-Type-Options Header Missing', riskcode: '1' }),
        ],
      },
    ],
  };
  const findings = normalizeZapReport(report);
  assert.deepEqual(findings.map((f) => [f.ruleId, f.severity]), [
    ['10020-1', 'high'],
    ['10038', 'medium'],
    ['10021', 'low'],
    ['10096', 'info'],
  ]);
  const csp = findings.find((f) => f.ruleId === '10038');
  assert.equal(csp.source, 'zap');
  assert.equal(csp.fingerprint, 'zap:10038');
  assert.equal(csp.confidence, 'high');
  assert.equal(csp.description, 'Content Security Policy (CSP) is an added layer of security.\n\nSecond & last.');
  assert.equal(csp.remediation, 'Ensure that your web server sets the Content-Security-Policy header.');
  assert.deepEqual(csp.references, ['https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'], 'only http(s) links kept');
  assert.equal(csp.cweId, 693);
  assert.equal(csp.instances.length, 2, 'duplicate locations collapsed');
  assert.equal(csp.affectedUrl, 'https://app.example.com/');
  assert.equal(csp.occurrences, 3);
});

test('the same alert across sites is deduplicated into one finding per scan', () => {
  const report = {
    site: [
      { alerts: [zapAlert({ count: '1', instances: [{ uri: 'https://a.example.com/', method: 'GET' }] })] },
      { alerts: [zapAlert({ count: '2', instances: [{ uri: 'https://a.example.com/x', method: 'GET' }] })] },
    ],
  };
  const findings = normalizeZapReport(report);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].occurrences, 3);
  assert.equal(findings[0].instances.length, 2);
});

test('malformed or empty reports produce no findings (nothing is invented)', () => {
  for (const report of [null, {}, { site: 'x' }, { site: [{ alerts: [{ riskcode: '9', alert: 'x', alertRef: '1' }] }] }, { site: [{ alerts: [{ riskcode: '2' }] }] }]) {
    assert.deepEqual(normalizeZapReport(report), []);
  }
});

test('evidence is truncated and secrets in it are masked', () => {
  const evidence = safeEvidence('Set-Cookie: session=abcdef123456; HttpOnly token="s3cr3t-value" ' + 'A'.repeat(40));
  assert.doesNotMatch(evidence, /abcdef123456|s3cr3t-value|AAAAAAAAAA/);
  assert.match(evidence, /session=\[redacted\]/);
  assert.ok(safeEvidence('x'.repeat(5000).split('').join(' ')).length <= 300);
  assert.equal(toPlainText('<script>alert(1)</script>ok', 50), 'alert(1)ok', 'tags are stripped, never rendered');
});

test('baseline score: 100 - (25C + 10H + 4M + 1L), floored at 0; info does not count', () => {
  assert.equal(calculateBaselineScore({ critical: 0, high: 0, medium: 0, low: 0, info: 12 }), 100);
  assert.equal(calculateBaselineScore({ critical: 0, high: 1, medium: 2, low: 3, info: 0 }), 79);
  assert.equal(calculateBaselineScore({ critical: 5, high: 0, medium: 0, low: 0, info: 0 }), 0);
  assert.deepEqual(countBySeverity([{ severity: 'high' }, { severity: 'low' }, { severity: 'low' }]), {
    critical: 0,
    high: 1,
    medium: 0,
    low: 2,
    info: 0,
  });
});

test('lab targets map an explicit .test name to a local address; nothing else changes', async () => {
  const labTargets = new Map([['juice.lab.test', '127.0.0.1']]);
  const noDns = async () => assert.fail('lab targets must not use DNS');
  assert.deepEqual(await resolveTarget('http://juice.lab.test:3000/', { labTargets, lookup: noDns }), {
    url: 'http://juice.lab.test:3000/',
    hostname: 'juice.lab.test',
    port: 3000,
    address: '127.0.0.1',
    family: 4,
  });
  await assert.rejects(resolveTarget('http://127.0.0.1:3000/', { labTargets }), { code: 'TARGET_NOT_ALLOWED' });
  await assert.rejects(resolveTarget('http://localhost:3000/', { labTargets }), { code: 'TARGET_NOT_ALLOWED' });
  await assert.rejects(
    resolveTarget('http://other.lab.test/', { labTargets, lookup: lookupReturning('127.0.0.1') }),
    { code: 'TARGET_NOT_ALLOWED' },
    'unmapped .test names follow the normal rules'
  );
});
