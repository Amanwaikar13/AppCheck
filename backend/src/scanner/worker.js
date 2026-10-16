import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { Scan } from '../models/Scan.js';
import { URL_SCAN_ENGINE, completeScan, defaultJobDeps, executeUrlScan, failScan } from './urlScanJob.js';
import { checkZapAvailable } from './zapRunner.js';

export const INTERRUPTED = {
  code: 'SCAN_INTERRUPTED',
  message: 'The scan was interrupted (for example, the server restarted) and did not finish',
};

/**
 * In-process background worker for URL scans. One scan at a time; scans are
 * claimed atomically (findOneAndUpdate queued -> running), so a scan is never
 * processed twice even if several API processes run workers. A heartbeat marks
 * liveness; scans whose heartbeat stops are failed as interrupted rather than
 * retried, so a target that crashes the scanner is not hit repeatedly.
 */
export function createScanWorker({
  scannerConfig,
  logger,
  deps = defaultJobDeps,
  checkAvailable = () => checkZapAvailable({ options: scannerConfig.zap }),
  pollMs = 5000,
  heartbeatMs = 30_000,
  staleMs = 25 * 60 * 1000,
  availabilityTtlMs = 60_000,
  // Extra query restricting which scans this worker may claim (tests use it
  // to stay within their own records in a shared database).
  claimScope = {},
}) {
  const workerId = `${os.hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`;
  const log = logger.child({ component: 'scan-worker' });
  let status = scannerConfig.enabled
    ? { enabled: true, available: false, reason: 'Checking scanner availability', checkedAt: null }
    : { enabled: false, available: false, reason: 'The URL scanner is disabled on this server', checkedAt: null };
  let timer = null;
  let busy = false;
  let current = null; // scan being processed by this worker
  let lastRecovery = 0;

  async function refreshAvailability(force = false) {
    if (!scannerConfig.enabled) return status;
    if (!force && status.checkedAt && Date.now() - status.checkedAt < availabilityTtlMs) return status;
    const result = await checkAvailable().catch(() => ({ available: false, reason: 'Scanner availability check failed' }));
    if (result.available !== status.available) {
      log.info({ available: result.available, reason: result.reason }, 'URL scanner availability changed');
    }
    status = { enabled: true, available: result.available, reason: result.reason, checkedAt: Date.now() };
    return status;
  }

  async function recoverStale() {
    const cutoff = new Date(Date.now() - staleMs);
    const { modifiedCount } = await Scan.updateMany(
      { ...claimScope, type: 'url', status: 'running', $or: [{ heartbeatAt: { $lt: cutoff } }, { heartbeatAt: null }] },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          errorCode: INTERRUPTED.code,
          errorMessage: INTERRUPTED.message,
          lockedBy: null,
        },
      }
    );
    if (modifiedCount) log.warn({ count: modifiedCount }, 'Marked interrupted URL scans as failed');
    return modifiedCount;
  }

  function claimNext() {
    const now = new Date();
    return Scan.findOneAndUpdate(
      { ...claimScope, type: 'url', status: 'queued' },
      { $set: { status: 'running', startedAt: now, heartbeatAt: now, lockedBy: workerId, engine: URL_SCAN_ENGINE } },
      { sort: { createdAt: 1, _id: 1 }, new: true }
    );
  }

  async function processScan(scan) {
    current = scan;
    const scanLog = log.child({ scanId: scan._id.toString() });
    const beat = setInterval(() => {
      Scan.updateOne({ _id: scan._id, lockedBy: workerId }, { $set: { heartbeatAt: new Date() } }).catch(() => {});
    }, heartbeatMs);
    beat.unref?.();
    try {
      scanLog.info('URL scan started');
      const { findings, proxyStats, durationMs } = await executeUrlScan(scan.target, {
        deps,
        zapOptions: scannerConfig.zap,
        proxyBindHost: scannerConfig.proxyBindHost,
      });
      const saved = await completeScan(scan, findings, workerId);
      scanLog.info({ findings: findings.length, durationMs, proxyStats, saved }, 'URL scan completed');
    } catch (error) {
      // Full details stay in server logs; the scan record gets a safe summary.
      const detail = typeof error.detail === 'string' ? error.detail.slice(0, 2000) : error.message;
      scanLog.warn({ errorName: error.name, code: error.code, detail }, 'URL scan failed');
      await failScan(scan, error, workerId).catch((e) => scanLog.error({ err: e }, 'Could not record scan failure'));
    } finally {
      clearInterval(beat);
      current = null;
    }
  }

  /** One polling step; returns true if a scan was processed. Exposed for tests. */
  async function tick() {
    if (busy) return false;
    busy = true;
    try {
      if (Date.now() - lastRecovery > staleMs / 5) {
        lastRecovery = Date.now();
        await recoverStale();
      }
      const { available } = await refreshAvailability();
      if (!available) return false; // scans stay queued until a scanner is available
      const scan = await claimNext();
      if (!scan) return false;
      await processScan(scan);
      return true;
    } catch (error) {
      log.error({ err: error }, 'Scan worker step failed');
      return false;
    } finally {
      busy = false;
    }
  }

  return {
    workerId,
    tick,
    recoverStale,
    refreshAvailability,
    getStatus: () => ({ enabled: status.enabled, available: status.available, reason: status.reason }),
    async start() {
      lastRecovery = Date.now();
      await recoverStale();
      await refreshAvailability(true);
      log.info({ enabled: status.enabled, available: status.available, reason: status.reason }, 'Scan worker started');
      if (!scannerConfig.enabled) return;
      const loop = async () => {
        await tick();
        timer = setTimeout(loop, pollMs);
      };
      timer = setTimeout(loop, pollMs);
    },
    /**
     * Stops polling. A scan in progress is marked failed (interrupted) right
     * away. Its ZAP container loses its egress proxy when this process exits,
     * so it can no longer reach the target and ends at its own time limit.
     */
    async stop() {
      clearTimeout(timer);
      timer = null;
      if (current) {
        await Scan.updateOne(
          { _id: current._id, status: 'running', lockedBy: workerId },
          { $set: { status: 'failed', completedAt: new Date(), errorCode: INTERRUPTED.code, errorMessage: INTERRUPTED.message, lockedBy: null } }
        ).catch(() => {});
      }
    },
  };
}
