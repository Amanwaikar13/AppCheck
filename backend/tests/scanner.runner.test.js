// The Docker/ZAP runner with a fake spawn: no Docker or network is used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_ZAP_OPTIONS, ScannerError, buildDockerArgs, checkZapAvailable, runZapBaseline } from '../src/scanner/zapRunner.js';

const PROXY = { port: 41234, username: 'appcheck', password: 'pw-123' };
const options = { ...DEFAULT_ZAP_OPTIONS, timeoutMs: 200 };

/** Fake child_process.spawn. `behave(command, args, child)` decides what happens. */
function fakeSpawn(behave) {
  const calls = [];
  const spawnImpl = (command, args, spawnOptions) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = (signal) => {
      child.killed = signal;
      setImmediate(() => child.emit('close', null));
    };
    calls.push({ command, args, spawnOptions, child });
    setImmediate(() => behave(command, args, child));
    return child;
  };
  return { spawnImpl, calls };
}

const workDirOf = (args) => args[args.indexOf('-v') + 1].replace(/:\/zap\/wrk:rw$/, '');

test('docker is invoked without a shell, with the URL as a single argument', () => {
  const evil = 'https://example.com/$(touch /tmp/x);`id`|&&';
  const args = buildDockerArgs({ containerName: 'c1', workDir: '/tmp/w', targetUrl: evil, proxy: { ...PROXY, host: 'host.docker.internal' } });
  assert.equal(args[args.indexOf('-t') + 1], evil, 'passed verbatim as one argv element');
  for (const flag of ['--rm', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit', '--memory', '--cpus']) {
    assert.ok(args.includes(flag), flag);
  }
  assert.ok(args.includes('zap-baseline.py'), 'baseline (passive) scan only');
  assert.ok(!args.some((a) => /zap-full-scan|zap-api-scan/.test(a)), 'no active scan scripts');
  const config = args[args.indexOf('-z') + 1];
  assert.match(config, /network\.connection\.httpProxy\.enabled=true/);
  assert.match(config, /network\.connection\.httpProxy\.port=41234/);
  for (const option of ['authEnabled=true', 'realm=appcheck-scan', 'storePass=true']) {
    assert.ok(config.split(' ').includes(`network.connection.httpProxy.${option}`), option);
  }
  assert.ok(!config.includes('exclusion'), 'no host may bypass the proxy');
});

test('a completed scan returns the parsed report; spawn uses shell: false; temp dir is removed', async () => {
  let dir;
  const { spawnImpl, calls } = fakeSpawn((command, args, child) => {
    dir = workDirOf(args);
    writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ site: [{ alerts: [] }] }));
    child.emit('close', 2); // WARN alerts: still a completed scan
  });
  const result = await runZapBaseline({ targetUrl: 'https://example.com/', proxy: PROXY, options, spawnImpl });
  assert.deepEqual(result.report, { site: [{ alerts: [] }] });
  assert.equal(result.exitCode, 2);
  assert.equal(calls[0].command, 'docker');
  assert.equal(calls[0].spawnOptions.shell, false);
  assert.equal(existsSync(dir), false, 'work directory cleaned up');
});

test('timeouts kill the process and the container, and report SCANNER_TIMEOUT', async () => {
  const { spawnImpl, calls } = fakeSpawn((command, args, child) => {
    if (args[0] === 'kill') child.emit('close', 0);
    // the scan itself never finishes
  });
  await assert.rejects(runZapBaseline({ targetUrl: 'https://example.com/', proxy: PROXY, options, spawnImpl }), (error) => {
    assert.ok(error instanceof ScannerError);
    assert.equal(error.code, 'SCANNER_TIMEOUT');
    return true;
  });
  assert.equal(calls[0].child.killed, 'SIGKILL');
  assert.equal(calls[1].args[0], 'kill');
  assert.match(calls[1].args[1], /^appcheck-zap-[0-9a-f]{12}$/);
});

test('missing docker, scanner errors, and missing or invalid reports are failures with safe messages', async () => {
  const cases = [
    [(c, a, child) => child.emit('error', Object.assign(new Error('spawn docker ENOENT /usr/secret/path'), { code: 'ENOENT' })), 'SCANNER_UNAVAILABLE'],
    [(c, a, child) => child.emit('close', 3), 'SCANNER_FAILED'],
    [(c, a, child) => child.emit('close', 0), 'SCANNER_FAILED'], // no report written
    [
      (c, args, child) => {
        writeFileSync(path.join(workDirOf(args), 'report.json'), '{not json');
        child.emit('close', 0);
      },
      'SCANNER_FAILED',
    ],
  ];
  for (const [behave, code] of cases) {
    const { spawnImpl } = fakeSpawn(behave);
    await assert.rejects(runZapBaseline({ targetUrl: 'https://example.com/', proxy: PROXY, options, spawnImpl }), (error) => {
      assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /ENOENT|secret|exit|\//, 'client message has no internals');
      return true;
    });
  }
});

test('availability: reports Docker or the ZAP image missing', async () => {
  const noDocker = fakeSpawn((c, a, child) => child.emit('error', new Error('ENOENT')));
  assert.deepEqual(await checkZapAvailable({ spawnImpl: noDocker.spawnImpl }), {
    available: false,
    reason: 'Docker is not installed or not running on the scanner host',
  });
  const noImage = fakeSpawn((c, args, child) => child.emit('close', args[0] === 'version' ? 0 : 1));
  assert.match((await checkZapAvailable({ spawnImpl: noImage.spawnImpl })).reason, /has not been pulled/);
  const ready = fakeSpawn((c, a, child) => child.emit('close', 0));
  assert.deepEqual(await checkZapAvailable({ spawnImpl: ready.spawnImpl }), { available: true, reason: null });
});
