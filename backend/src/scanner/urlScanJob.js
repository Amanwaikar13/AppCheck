import { Finding } from '../models/Finding.js';
import { Scan } from '../models/Scan.js';
import { startEgressProxy } from './egressProxy.js';
import { calculateBaselineScore, countBySeverity, normalizeZapReport } from './normalize.js';
import { TargetNotAllowedError, resolveTarget } from './targetPolicy.js';
import { DEFAULT_ZAP_OPTIONS, ScannerError, runZapBaseline } from './zapRunner.js';

export const URL_SCAN_ENGINE = 'OWASP ZAP baseline';

export const defaultJobDeps = Object.freeze({ resolveTarget, startEgressProxy, runZapBaseline });

/**
 * Runs one URL scan end to end and returns normalized findings. Throws
 * TargetNotAllowedError or ScannerError (client-safe messages) on failure.
 * The target is re-resolved and re-validated here, at execution time, rather
 * than trusting the check made when the scan was submitted.
 */
export async function executeUrlScan(target, { deps = defaultJobDeps, zapOptions = DEFAULT_ZAP_OPTIONS, proxyBindHost } = {}) {
  const resolved = await deps.resolveTarget(target);
  const proxy = await deps.startEgressProxy({
    hostname: resolved.hostname,
    address: resolved.address,
    ports: [resolved.port],
    bindHost: proxyBindHost,
  });
  try {
    const result = await deps.runZapBaseline({
      targetUrl: resolved.url,
      proxy: { port: proxy.port, username: proxy.username, password: proxy.password },
      options: zapOptions,
    });
    return { findings: normalizeZapReport(result.report), proxyStats: { ...proxy.stats }, durationMs: result.durationMs };
  } finally {
    await proxy.close();
  }
}

/** Saves findings and marks the scan completed, if this worker still holds it. */
export async function completeScan(scan, findings, workerId) {
  await Finding.deleteMany({ scanId: scan._id }); // idempotent if a previous attempt wrote partially
  if (findings.length) {
    await Finding.insertMany(
      findings.map((f) => ({ ...f, userId: scan.userId, scanId: scan._id })),
      { ordered: false }
    );
  }
  const counts = countBySeverity(findings);
  const result = await Scan.updateOne(
    { _id: scan._id, status: 'running', lockedBy: workerId },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        findingsCount: findings.length,
        severityCounts: counts,
        securityScore: calculateBaselineScore(counts),
        errorCode: null,
        errorMessage: null,
        lockedBy: null,
      },
    }
  );
  return result.modifiedCount === 1;
}

/** Client-safe code and message for any failure; internal details are never stored. */
export function describeFailure(error) {
  if (error instanceof TargetNotAllowedError || error instanceof ScannerError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'SCAN_FAILED', message: 'The scan failed because of an internal error' };
}

export async function failScan(scan, error, workerId) {
  const { code, message } = describeFailure(error);
  await Finding.deleteMany({ scanId: scan._id });
  await Scan.updateOne(
    { _id: scan._id, status: 'running', lockedBy: workerId },
    { $set: { status: 'failed', completedAt: new Date(), errorCode: code, errorMessage: message, lockedBy: null } }
  );
  return { code, message };
}
