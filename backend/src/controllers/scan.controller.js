import {
  createScan,
  creationNotice,
  getScanForUser,
  getScanSummary,
  listFindingsForScan,
  listScans as listUserScans,
} from '../services/scan.service.js';
import { TargetNotAllowedError } from '../scanner/targetPolicy.js';
import { ApiError } from '../utils/ApiError.js';

// Scan records are private to their owner; never let caches store them.
const noStore = (res) => res.set('Cache-Control', 'no-store');

export async function createUrlScan(req, res) {
  const { services } = req.app.locals;
  // Resolve now so obviously disallowed hosts fail fast. The worker resolves
  // and validates again at execution time and pins the address it checked.
  try {
    await services.resolveTarget(req.body.url);
  } catch (error) {
    if (error instanceof TargetNotAllowedError) {
      throw new ApiError(400, 'TARGET_NOT_ALLOWED', 'The scan target is not allowed', [
        { path: 'url', message: error.message },
      ]);
    }
    throw error;
  }
  const scan = await createScan(req.user._id, { type: 'url', target: req.body.url });
  noStore(res).status(201).json({ scan, notice: creationNotice('url', services.scannerStatus()) });
}

export async function createSourceScan(req, res) {
  const scan = await createScan(req.user._id, { type: 'source', target: req.body.projectName });
  noStore(res).status(201).json({ scan, notice: creationNotice('source') });
}

export async function listScans(req, res) {
  noStore(res).json(await listUserScans(req.user._id, req.validated.query));
}

export async function getScan(req, res) {
  const scan = await getScanForUser(req.user._id, req.validated.params.id);
  noStore(res).json({ scan });
}

export async function getScanFindings(req, res) {
  noStore(res).json(await listFindingsForScan(req.user._id, req.validated.params.id));
}

export async function getSummary(req, res) {
  noStore(res).json(await getScanSummary(req.user._id));
}

export function getScannerStatus(req, res) {
  const status = req.app.locals.services.scannerStatus();
  noStore(res).json({
    url: {
      engine: 'OWASP ZAP baseline',
      mode: 'Passive checks only (spider and passive rules, no active attacks)',
      enabled: status.enabled,
      available: status.available,
      reason: status.available ? null : status.reason,
    },
    source: { enabled: false, available: false, reason: 'Source code analysis is not implemented yet' },
  });
}
