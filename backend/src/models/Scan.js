import mongoose from 'mongoose';

export const SCAN_TYPES = Object.freeze(['url', 'source']);
export const SCAN_STATUSES = Object.freeze(['queued', 'running', 'completed', 'failed']);

// Long enough for any realistic URL; the API validates targets more strictly.
export const MAX_TARGET_LENGTH = 2048;

/**
 * A request to scan a URL or a source-code project.
 *
 * New records are `queued`. For URL scans the worker (src/scanner/worker.js)
 * moves them to `running` and then `completed` (with findingsCount,
 * severityCounts, and securityScore from a real ZAP report) or `failed` (with
 * a client-safe errorCode/errorMessage). Source scans are not executed yet.
 * No API lets a client write any of these fields.
 */
const scanSchema = new mongoose.Schema(
  {
    // Owner. Always taken from the authenticated session, never from input.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      immutable: true,
    },
    type: {
      type: String,
      enum: { values: SCAN_TYPES, message: 'type must be one of: url, source' },
      required: [true, 'type is required'],
      immutable: true,
    },
    // Normalized URL (type "url") or project name (type "source").
    target: {
      type: String,
      required: [true, 'target is required'],
      trim: true,
      minlength: 1,
      maxlength: MAX_TARGET_LENGTH,
      immutable: true,
    },
    status: {
      type: String,
      enum: {
        values: SCAN_STATUSES,
        message: 'status must be one of: queued, running, completed, failed',
      },
      default: 'queued',
    },
    // 0-100, null until a scanner produces a score.
    securityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    // null means "no results yet", which is different from a scan that found 0 issues.
    findingsCount: {
      type: Number,
      min: 0,
      validate: {
        validator: (value) => value === null || Number.isInteger(value),
        message: 'findingsCount must be an integer',
      },
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    // Per-severity finding counts, set together with findingsCount on completion.
    severityCounts: {
      type: new mongoose.Schema(
        {
          critical: { type: Number, min: 0 },
          high: { type: Number, min: 0 },
          medium: { type: Number, min: 0 },
          low: { type: Number, min: 0 },
          info: { type: Number, min: 0 },
        },
        { _id: false, strict: 'throw' }
      ),
      default: null,
    },
    // Engine that ran the scan, e.g. "OWASP ZAP baseline".
    engine: { type: String, maxlength: 60, default: null },
    // Client-safe failure summary (never stack traces, IPs, or scanner logs).
    errorCode: { type: String, maxlength: 40, default: null },
    errorMessage: { type: String, maxlength: 300, default: null },
    // Worker lease: which worker is running the scan and when it last reported.
    lockedBy: { type: String, maxlength: 80, default: null, select: false },
    heartbeatAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    strict: 'throw',
  }
);

// Scan history is always queried per user, newest first; _id breaks ties so
// pagination is stable when several records share a createdAt value.
scanSchema.index({ userId: 1, createdAt: -1, _id: -1 });
// History filtered by type or status.
scanSchema.index({ userId: 1, type: 1, createdAt: -1 });
scanSchema.index({ userId: 1, status: 1, createdAt: -1 });
// Worker queue: oldest queued scan of a type, and stale running scans.
scanSchema.index({ status: 1, type: 1, createdAt: 1 });

/**
 * The only representation of a scan that may leave the API. Works for both
 * documents and lean query results. The owner (userId) is not included:
 * clients only ever see their own scans.
 */
export function toPublicScan(scan) {
  return {
    id: scan._id.toString(),
    type: scan.type,
    target: scan.target,
    status: scan.status,
    securityScore: scan.securityScore ?? null,
    findingsCount: scan.findingsCount ?? null,
    startedAt: scan.startedAt ?? null,
    completedAt: scan.completedAt ?? null,
    severityCounts: scan.severityCounts
      ? {
          critical: scan.severityCounts.critical ?? 0,
          high: scan.severityCounts.high ?? 0,
          medium: scan.severityCounts.medium ?? 0,
          low: scan.severityCounts.low ?? 0,
          info: scan.severityCounts.info ?? 0,
        }
      : null,
    engine: scan.engine ?? null,
    error: scan.errorCode ? { code: scan.errorCode, message: scan.errorMessage } : null,
    createdAt: scan.createdAt,
    updatedAt: scan.updatedAt,
  };
}

// Fields read by toPublicScan(); list queries load nothing else.
export const PUBLIC_SCAN_FIELDS =
  'type target status securityScore findingsCount startedAt completedAt severityCounts engine errorCode errorMessage createdAt updatedAt';

scanSchema.methods.toPublic = function toPublic() {
  return toPublicScan(this);
};

scanSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Scan = mongoose.models.Scan ?? mongoose.model('Scan', scanSchema);
