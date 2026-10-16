import Badge from "@/components/ui/Badge";

export const SCAN_TYPE_LABELS = { url: "URL", source: "Source code" };

export const SCAN_STATUS_META = {
  queued: { tone: "neutral", label: "Queued" },
  running: { tone: "info", label: "Running" },
  completed: { tone: "success", label: "Completed" },
  failed: { tone: "danger", label: "Failed" },
};

export const SCAN_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "url", label: "URL" },
  { value: "source", label: "Source code" },
];

export const SCAN_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...Object.entries(SCAN_STATUS_META).map(([value, { label }]) => ({ value, label })),
];

// Mirrors the API allowlist (backend/src/validators/scan.validators.js).
export const SCAN_SORT_OPTIONS = [
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" },
  { value: "target", label: "Target (A-Z)" },
  { value: "-target", label: "Target (Z-A)" },
  { value: "type", label: "Type (A-Z)" },
  { value: "-type", label: "Type (Z-A)" },
  { value: "status", label: "Status (A-Z)" },
  { value: "-status", label: "Status (Z-A)" },
];

export const NOT_EXECUTED_EXPLANATION =
  "No scanner has run this scan yet, so it has no score or findings.";

/** True until a scanner has started this scan. */
export function isNotExecuted(scan) {
  return scan.status === "queued" && !scan.startedAt;
}

/** True while the status can still change (the detail page polls for updates). */
export function isInProgress(scan) {
  return scan.status === "queued" || scan.status === "running";
}

export function ScanStatusBadge({ status }) {
  const meta = SCAN_STATUS_META[status] ?? { tone: "neutral", label: status };
  return (
    <Badge tone={meta.tone} dot pulse={status === "running"}>
      {meta.label}
    </Badge>
  );
}

/** Shown beside records that no scanner has run. */
export function NotExecutedBadge() {
  return (
    <Badge tone="warning" variant="dashed" title={NOT_EXECUTED_EXPLANATION}>
      Not executed
    </Badge>
  );
}

/** Status badge plus the "Not executed" marker when no scanner has run. */
export function ScanStatusCell({ scan }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={scan.error?.message ?? undefined}>
      <ScanStatusBadge status={scan.status} />
      {isNotExecuted(scan) && <NotExecutedBadge />}
    </span>
  );
}

/** Score or findings value; null means the scanner has not produced one. */
export function ResultValue({ value, suffix = "" }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-400" title="No results: this scan has not been run">—</span>;
  }
  return (
    <span className="tabular-nums text-slate-900">
      {value}
      {suffix}
    </span>
  );
}
