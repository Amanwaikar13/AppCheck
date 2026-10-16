import { SEVERITIES } from "@/lib/severity";

const BY_KEY = Object.fromEntries(SEVERITIES.map((s) => [s.key, s]));

/**
 * Severity label with a colored marker; the text always names the level.
 * `compact` shows a one-letter abbreviation (full name available to assistive
 * tech and on hover) for dense table cells.
 */
export default function SeverityBadge({ severity, count, compact = false }) {
  const { label, shortLabel, color } = BY_KEY[severity];
  const fullText = count !== undefined ? `${count} ${label}` : label;
  return (
    <span
      title={compact ? fullText : undefined}
      className="inline-flex h-5 items-center gap-1.5 rounded-md bg-white px-1.5 text-[11px] font-medium whitespace-nowrap text-slate-700 ring-1 ring-slate-200 ring-inset"
    >
      <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: color }} />
      {count !== undefined && <span className="tabular-nums text-slate-900">{count}</span>}
      {compact ? (
        <>
          <span aria-hidden="true">{label[0]}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        (shortLabel ?? label)
      )}
    </span>
  );
}
