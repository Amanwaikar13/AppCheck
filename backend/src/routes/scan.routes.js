import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  createSourceScan,
  createUrlScan,
  getScan,
  getScanFindings,
  getScannerStatus,
  getSummary,
  listScans,
} from '../controllers/scan.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { rateLimitExceeded } from '../middleware/rateLimit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import {
  createSourceScanSchema,
  createUrlScanSchema,
  listScansQuerySchema,
  scanIdParamsSchema,
} from '../validators/scan.validators.js';

export const DEFAULT_SCAN_RATE_LIMITS = Object.freeze({
  windowMs: 15 * 60 * 1000,
  // Scan records created per user per window (URL and source combined).
  // Rejected requests are not counted; the global per-IP limit covers those.
  create: 20,
});

/** Rate limiters are created per app, so each instance (and test) has its own counters. */
export function createScanRouter(overrides = {}) {
  const limits = { ...DEFAULT_SCAN_RATE_LIMITS, ...overrides };
  const router = Router();

  // Counted per signed-in user (it runs after authenticate), on top of the
  // global per-IP limit, so one account cannot flood the future scan queue.
  const createLimiter = rateLimit({
    windowMs: limits.windowMs,
    limit: limits.create,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user._id}`,
    skipFailedRequests: true,
    handler: rateLimitExceeded('scan-create', 'Too many scan requests. Please try again later.'),
  });

  // Every scan route requires a session; ownership always comes from req.user.
  router.use(authenticate);

  router.post('/url', createLimiter, validateBody(createUrlScanSchema), createUrlScan);
  router.post('/source', createLimiter, validateBody(createSourceScanSchema), createSourceScan);
  router.get('/', validateQuery(listScansQuerySchema), listScans);
  router.get('/summary', getSummary);
  router.get('/:id', validateParams(scanIdParamsSchema), getScan);
  router.get('/:id/findings', validateParams(scanIdParamsSchema), getScanFindings);

  return router;
}

/** GET /scanner/status: whether scans can actually run on this server. */
export function createScannerRouter() {
  const router = Router();
  router.get('/status', authenticate, getScannerStatus);
  return router;
}
