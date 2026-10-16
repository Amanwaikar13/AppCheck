import mongoose from 'mongoose';

export const FINDING_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low', 'info']);
export const FINDING_SOURCES = Object.freeze(['zap']);

const instanceSchema = new mongoose.Schema(
  {
    url: { type: String, maxlength: 2048 },
    method: { type: String, maxlength: 10 },
    param: { type: String, maxlength: 200 },
    evidence: { type: String, maxlength: 300 },
  },
  { _id: false, strict: 'throw' }
);

/**
 * One scanner alert type found by one scan (e.g. "Missing Anti-clickjacking
 * Header"), with up to 10 example locations. Created only by the scan worker
 * from a real scanner report; there is no API to create or edit findings.
 */
const findingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    scanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true, immutable: true },
    source: { type: String, enum: FINDING_SOURCES, required: true },
    ruleId: { type: String, required: true, maxlength: 40 },
    // Deduplication key within a scan, e.g. "zap:10038".
    fingerprint: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 200 },
    severity: { type: String, enum: FINDING_SEVERITIES, required: true },
    confidence: { type: String, enum: ['false-positive', 'low', 'medium', 'high', 'confirmed', null], default: null },
    description: { type: String, maxlength: 4000, default: '' },
    remediation: { type: String, maxlength: 4000, default: '' },
    references: { type: [{ type: String, maxlength: 500 }], default: [], validate: (v) => v.length <= 5 },
    cweId: { type: Number, default: null },
    wascId: { type: Number, default: null },
    affectedUrl: { type: String, maxlength: 2048, default: null },
    instances: { type: [instanceSchema], default: [], validate: (v) => v.length <= 10 },
    occurrences: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true, strict: 'throw' }
);

findingSchema.index({ scanId: 1, fingerprint: 1 }, { unique: true });
findingSchema.index({ userId: 1, scanId: 1, severity: 1 });

const SEVERITY_RANK = Object.fromEntries(FINDING_SEVERITIES.map((s, i) => [s, i]));
export const severityRank = (severity) => SEVERITY_RANK[severity] ?? 99;

/** Allowlisted client representation (no owner ID). */
export function toPublicFinding(f) {
  return {
    id: f._id.toString(),
    scanId: f.scanId.toString(),
    source: f.source,
    ruleId: f.ruleId,
    title: f.title,
    severity: f.severity,
    confidence: f.confidence ?? null,
    description: f.description,
    remediation: f.remediation,
    references: f.references ?? [],
    cweId: f.cweId ?? null,
    wascId: f.wascId ?? null,
    affectedUrl: f.affectedUrl ?? null,
    instances: (f.instances ?? []).map(({ url, method, param, evidence }) => ({ url, method, param, evidence })),
    occurrences: f.occurrences,
    createdAt: f.createdAt,
  };
}

export const Finding = mongoose.models.Finding ?? mongoose.model('Finding', findingSchema);
