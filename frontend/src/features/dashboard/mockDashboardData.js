/*
 * ⚠ SAMPLE DATA — ILLUSTRATIVE ONLY. Nothing here comes from a real scan.
 *
 * The dashboard shows this dataset as a preview when the account has no scan
 * records (every section then carries a "Sample data" badge), and the posture
 * cards use SAMPLE_FINDINGS while the account has scans but none completed.
 * It is never stored in the database and never mixed into a section that
 * shows real data.
 *
 * The values are internally consistent: the counts add up, the recent scans
 * and activity describe the same scans, the per-target severity counts add up
 * to the chart totals, and the latest completed scan's counts give its score
 * under the real formula, 100 - (25C + 10H + 4M + 1L): 100 - (10 + 8 + 4) = 78.
 * Targets use reserved example domains (RFC 2606).
 */

export const SAMPLE_SCAN_COUNTS = Object.freeze({
  total: 24,
  queued: 2,
  running: 1,
  completed: 18,
  failed: 3,
});

const severity = (critical, high, medium, low, info) => ({ critical, high, medium, low, info });

// Latest completed scan of each example target; together they make the chart.
const LATEST_BY_TARGET = {
  demo: severity(0, 1, 2, 4, 2), // 9 findings, score 78
  shop: severity(2, 3, 6, 8, 3), // 22 findings
  api: severity(0, 1, 4, 6, 2), // 13 findings
};

/** Five newest sample scans, newest first, shaped like GET /scans/summary "recent" items. */
export const SAMPLE_RECENT_SCANS = Object.freeze([
  {
    id: "sample-scan-5",
    type: "url",
    target: "https://shop.example.com/",
    status: "queued",
    findingsCount: null,
    securityScore: null,
    severityCounts: null,
    error: null,
    createdAt: "2026-10-15T15:02:00.000Z",
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-10-15T15:02:00.000Z",
  },
  {
    id: "sample-scan-4",
    type: "url",
    target: "https://api.example.com/",
    status: "running",
    findingsCount: null,
    securityScore: null,
    severityCounts: null,
    error: null,
    createdAt: "2026-10-15T14:50:00.000Z",
    startedAt: "2026-10-15T14:51:00.000Z",
    completedAt: null,
    updatedAt: "2026-10-15T14:51:00.000Z",
  },
  {
    id: "sample-scan-3",
    type: "url",
    target: "https://demo.example.com/",
    status: "completed",
    findingsCount: 9,
    securityScore: 78,
    severityCounts: LATEST_BY_TARGET.demo,
    error: null,
    createdAt: "2026-10-15T14:20:00.000Z",
    startedAt: "2026-10-15T14:21:00.000Z",
    completedAt: "2026-10-15T14:32:00.000Z",
    updatedAt: "2026-10-15T14:32:00.000Z",
  },
  {
    id: "sample-scan-2",
    type: "url",
    target: "https://shop.example.com/checkout",
    status: "failed",
    findingsCount: null,
    securityScore: null,
    severityCounts: null,
    error: { code: "SCANNER_TIMEOUT", message: "The scan did not finish within the time limit" },
    createdAt: "2026-10-15T13:40:00.000Z",
    startedAt: "2026-10-15T13:41:00.000Z",
    completedAt: "2026-10-15T13:56:00.000Z",
    updatedAt: "2026-10-15T13:56:00.000Z",
  },
  {
    id: "sample-scan-1",
    type: "url",
    target: "https://shop.example.com/",
    status: "completed",
    findingsCount: 22,
    securityScore: 0,
    severityCounts: LATEST_BY_TARGET.shop,
    error: null,
    createdAt: "2026-10-15T11:05:00.000Z",
    startedAt: "2026-10-15T11:06:00.000Z",
    completedAt: "2026-10-15T11:19:00.000Z",
    updatedAt: "2026-10-15T11:19:00.000Z",
  },
]);

/** Open findings: sum of the latest completed sample scan per target (Critical 2, High 5, Medium 12, Low 18, Info 7). */
export const SAMPLE_FINDINGS = Object.freeze({
  targets: 3,
  bySeverity: Object.values(LATEST_BY_TARGET).reduce(
    (sum, counts) => Object.fromEntries(Object.keys(sum).map((k) => [k, sum[k] + counts[k]])),
    severity(0, 0, 0, 0, 0)
  ),
  latest: SAMPLE_RECENT_SCANS[2], // demo.example.com, score 78
});
