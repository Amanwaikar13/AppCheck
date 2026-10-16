import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PROXY_REALM } from './egressProxy.js';

/*
 * Runs an OWASP ZAP baseline scan (spider + passive rules; no active attacks)
 * in Docker. The process is started with an argument array and shell: false,
 * so no part of the target URL is ever interpreted by a shell.
 */

export const DEFAULT_ZAP_OPTIONS = Object.freeze({
  image: 'zaproxy/zap-stable',
  spiderMinutes: 2, // zap-baseline.py -m
  maxMinutes: 10, // zap-baseline.py -T (ZAP start-up + passive scan wait)
  timeoutMs: 15 * 60 * 1000, // hard kill
  memory: '2g',
  cpus: '1.5',
  pidsLimit: 512,
  // How the container reaches the egress proxy on this host.
  proxyHost: 'host.docker.internal',
  maxReportBytes: 20 * 1024 * 1024,
});

export class ScannerError extends Error {
  /** `message` is client-safe; `detail` is for server logs only. */
  constructor(code, message, detail) {
    super(message);
    this.name = 'ScannerError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * ZAP -config options routing every request through the egress proxy. Key
 * names are those of ZAP's Network add-on (ConnectionOptions.java,
 * "network.connection.httpProxy.*"). storePass=true keeps headless ZAP from
 * prompting for the password; the realm matches the proxy's 407 challenge.
 * No proxy exclusions are configured, so no host bypasses the proxy.
 */
export function zapProxyConfig({ host, port, username, password }) {
  const prefix = 'network.connection.httpProxy';
  return [
    `${prefix}.enabled=true`,
    `${prefix}.host=${host}`,
    `${prefix}.port=${port}`,
    `${prefix}.authEnabled=true`,
    `${prefix}.realm=${PROXY_REALM}`,
    `${prefix}.username=${username}`,
    `${prefix}.password=${password}`,
    `${prefix}.storePass=true`,
  ]
    .map((option) => `-config ${option}`)
    .join(' ');
}

export function buildDockerArgs({ containerName, workDir, targetUrl, proxy, options = DEFAULT_ZAP_OPTIONS }) {
  return [
    'run',
    '--rm',
    '--name', containerName,
    // Least privilege: no Linux capabilities, no privilege escalation, bounded resources.
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--memory', options.memory,
    '--cpus', options.cpus,
    '--pids-limit', String(options.pidsLimit),
    '--add-host', 'host.docker.internal:host-gateway',
    '-v', `${workDir}:/zap/wrk:rw`,
    options.image,
    'zap-baseline.py',
    '-t', targetUrl,
    '-J', 'report.json',
    '-m', String(options.spiderMinutes),
    '-T', String(options.maxMinutes),
    '-I',
    '-z', zapProxyConfig(proxy),
  ];
}

function run(spawnImpl, command, args, timeoutMs) {
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const child = spawnImpl(command, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, output: output.slice(-4096) });
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      done({ code: null, timedOut: true });
    }, timeoutMs);
    child.stdout?.on('data', (d) => (output = (output + d).slice(-8192)));
    child.stderr?.on('data', (d) => (output = (output + d).slice(-8192)));
    child.on('error', (error) => done({ code: null, error }));
    child.on('close', (code) => done({ code }));
  });
}

/** { available, reason } — Docker daemon reachable and the ZAP image present locally. */
export async function checkZapAvailable({ spawnImpl = spawn, options = DEFAULT_ZAP_OPTIONS } = {}) {
  const daemon = await run(spawnImpl, 'docker', ['version', '--format', '{{.Server.Version}}'], 10_000);
  if (daemon.error || daemon.code !== 0) {
    return { available: false, reason: 'Docker is not installed or not running on the scanner host' };
  }
  const image = await run(spawnImpl, 'docker', ['image', 'inspect', options.image], 10_000);
  if (image.code !== 0) {
    return { available: false, reason: `The OWASP ZAP image (${options.image}) has not been pulled` };
  }
  return { available: true, reason: null };
}

/** Runs the scan; resolves { report, exitCode, durationMs } or throws ScannerError. */
export async function runZapBaseline({ targetUrl, proxy, options = DEFAULT_ZAP_OPTIONS, spawnImpl = spawn, workRoot = os.tmpdir() }) {
  const workDir = await mkdtemp(path.join(workRoot, 'appcheck-zap-'));
  const containerName = `appcheck-zap-${randomBytes(6).toString('hex')}`;
  const started = Date.now();
  try {
    await chmod(workDir, 0o777); // the image runs as the unprivileged "zap" user
    const args = buildDockerArgs({ containerName, workDir, targetUrl, proxy: { ...proxy, host: options.proxyHost }, options });
    const result = await run(spawnImpl, 'docker', args, options.timeoutMs);

    if (result.timedOut) {
      await run(spawnImpl, 'docker', ['kill', containerName], 15_000);
      throw new ScannerError('SCANNER_TIMEOUT', 'The scan did not finish within the time limit', result.output);
    }
    if (result.error) {
      throw new ScannerError('SCANNER_UNAVAILABLE', 'The URL scanner is not available on this server', result.error.message);
    }
    // zap-baseline.py: 0 = no alerts over threshold, 1 = FAIL, 2 = WARN (all
    // mean the scan ran); 3 or anything else = the scan itself failed.
    if (![0, 1, 2].includes(result.code)) {
      throw new ScannerError('SCANNER_FAILED', 'The scanner could not complete the scan', `exit ${result.code}: ${result.output}`);
    }

    const reportPath = path.join(workDir, 'report.json');
    const info = await stat(reportPath).catch(() => null);
    if (!info) throw new ScannerError('SCANNER_FAILED', 'The scanner did not produce a report', result.output);
    if (info.size > options.maxReportBytes) throw new ScannerError('SCANNER_FAILED', 'The scan report was too large to process');
    let report;
    try {
      report = JSON.parse(await readFile(reportPath, 'utf8'));
    } catch (error) {
      throw new ScannerError('SCANNER_FAILED', 'The scan report could not be read', error.message);
    }
    return { report, exitCode: result.code, durationMs: Date.now() - started };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
