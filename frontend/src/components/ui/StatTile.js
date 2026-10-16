import { Skeleton } from "./Feedback";

/**
 * A single headline number. `value` null shows a skeleton while loading;
 * `marker` is an optional color swatch (e.g. a severity color).
 */
export default function StatTile({ label, value, hint, marker, loading = false }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <dt className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
        {marker && <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: marker }} />}
        {label}
      </dt>
      <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
        {loading ? <Skeleton className="h-7 w-14" /> : value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

/** A row of StatTiles separated by dividers, inside one bordered surface. */
export function StatGroup({ children, columns = "sm:grid-cols-3", className = "" }) {
  return (
    <dl
      className={`grid grid-cols-1 divide-y divide-slate-100 sm:divide-x sm:divide-y-0 ${columns} ${className}`}
    >
      {children}
    </dl>
  );
}
