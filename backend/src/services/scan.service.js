import { Finding, severityRank, toPublicFinding } from '../models/Finding.js';
import { PUBLIC_SCAN_FIELDS, Scan, toPublicScan } from '../models/Scan.js';
import { ApiError } from '../utils/ApiError.js';

/** Notice returned with a newly created scan; it never claims a scan has run. */
export function creationNotice(type, scanner) {
  if (type === 'source') {
    return 'Scan request recorded. Source code analysis is not implemented yet, so this scan remains queued and has no results.';
  }
  if (scanner.enabled && scanner.available) {
    return 'Scan queued. An OWASP ZAP baseline scan (passive checks only) will start shortly; this page shows its real status.';
  }
  return `Scan request recorded, but the URL scanner is not available on this server (${scanner.reason}). It will stay queued until the scanner is available.`;
}

function scanNotFound() {
  // Same response whether the scan does not exist or belongs to another user,
  // so the IDs of scans owned by others cannot be discovered.
  return new ApiError(404, 'SCAN_NOT_FOUND', 'Scan not found');
}

/**
 * Creates a queued scan record owned by userId. Only the owner, type, and
 * target come from the caller; status, score, findings, and timestamps are
 * left to their schema defaults.
 */
export async function createScan(userId, { type, target }) {
  const scan = await Scan.create({ userId, type, target });
  return toPublicScan(scan);
}

/** Maps an allowlisted sort option ("target", "-createdAt") to a stable Mongo sort. */
export function toMongoSort(sort) {
  const descending = sort.startsWith('-');
  const field = descending ? sort.slice(1) : sort;
  const direction = descending ? -1 : 1;
  // Newest first within equal values, then _id so pages never overlap or skip.
  if (field === 'createdAt') return { createdAt: direction, _id: direction };
  return { [field]: direction, createdAt: -1, _id: -1 };
}

/**
 * One page of the scans owned by userId. Filtering, sorting, and paging run in
 * MongoDB; only the requested page is loaded.
 */
export async function listScans(userId, { page, limit, type, status, sort }) {
  const filter = { userId };
  if (type) filter.type = type;
  if (status) filter.status = status;

  const [items, totalItems] = await Promise.all([
    Scan.find(filter)
      .select(PUBLIC_SCAN_FIELDS)
      .sort(toMongoSort(sort))
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Scan.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalItems / limit);
  return {
    items: items.map(toPublicScan),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    filters: { type: type ?? null, status: status ?? null },
    sort,
  };
}

/** The scan with this ID if userId owns it; otherwise 404. */
export async function getScanForUser(userId, scanId) {
  const scan = await Scan.findOne({ _id: scanId, userId }).select(PUBLIC_SCAN_FIELDS).lean();
  if (!scan) throw scanNotFound();
  return toPublicScan(scan);
}

/** Findings of one scan, if userId owns the scan; otherwise 404. Most severe first. */
export async function listFindingsForScan(userId, scanId) {
  const scan = await Scan.findOne({ _id: scanId, userId }).select('status findingsCount').lean();
  if (!scan) throw scanNotFound();
  const findings = await Finding.find({ scanId, userId }).lean();
  findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.occurrences - a.occurrences);
  return { scanId: scan._id.toString(), status: scan.status, items: findings.map(toPublicFinding) };
}

const ZERO_COUNTS = () => ({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });

/**
 * Dashboard data from real records only: scan counts by status, the five
 * newest scans, and open findings, counted from the latest completed scan of
 * each distinct target (so re-scanning a site does not double-count).
 */
export async function getScanSummary(userId) {
  const [byStatus, latestPerTarget, recent] = await Promise.all([
    Scan.aggregate([{ $match: { userId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Scan.aggregate([
      { $match: { userId, status: 'completed' } },
      { $sort: { completedAt: -1, _id: -1 } },
      { $group: { _id: '$target', scan: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$scan' } },
      { $sort: { completedAt: -1, _id: -1 } },
      { $limit: 500 },
    ]),
    Scan.find({ userId }).select(PUBLIC_SCAN_FIELDS).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
  ]);

  const counts = { total: 0, queued: 0, running: 0, completed: 0, failed: 0 };
  for (const { _id, n } of byStatus) {
    counts[_id] = n;
    counts.total += n;
  }
  const openFindings = ZERO_COUNTS();
  for (const scan of latestPerTarget) {
    for (const key of Object.keys(openFindings)) openFindings[key] += scan.severityCounts?.[key] ?? 0;
  }
  return {
    counts,
    recent: recent.map(toPublicScan),
    findings: {
      targets: latestPerTarget.length,
      bySeverity: openFindings,
      latest: latestPerTarget[0] ? toPublicScan(latestPerTarget[0]) : null,
    },
  };
}
