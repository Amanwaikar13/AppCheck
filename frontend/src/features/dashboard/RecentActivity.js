"use client";

import { useSelector } from "react-redux";
import Card from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";
import LiveDataBadge from "@/components/ui/LiveDataBadge";
import SampleDataBadge from "@/components/ui/SampleDataBadge";
import { formatDateTime } from "@/lib/format";
import { selectRecentScans } from "@/features/scans/scansSlice";
import { SAMPLE_RECENT_SCANS } from "./mockDashboardData";

const KINDS = {
  completed: { icon: "check", className: "text-emerald-600" },
  failed: { icon: "x", className: "text-red-600" },
  running: { icon: "play", className: "text-sky-600" },
  queued: { icon: "clock", className: "text-slate-500" },
};

const label = (scan) => (scan.type === "url" ? "URL scan" : "Source scan");

/** Turns a real scan record into one timeline entry. */
function toEvent(scan) {
  const plural = (n) => `${n} ${n === 1 ? "finding" : "findings"}`;
  switch (scan.status) {
    case "completed":
      return { message: `${label(scan)} completed`, detail: plural(scan.findingsCount ?? 0), at: scan.completedAt };
    case "failed":
      return { message: `${label(scan)} failed`, detail: scan.error?.message ?? "Did not complete", at: scan.completedAt ?? scan.updatedAt };
    case "running":
      return { message: `${label(scan)} started`, detail: "In progress", at: scan.startedAt };
    default:
      return { message: `${label(scan)} requested`, detail: scan.type === "url" ? "Waiting for the scanner" : "Source analysis not available yet", at: scan.createdAt };
  }
}

/**
 * Timeline of the five newest scans (from the dashboard summary; no extra
 * request). With no scan records it shows the same sample scans as the scan
 * activity card, labeled as sample data.
 */
export default function RecentActivity() {
  const { items: liveItems, counts } = useSelector(selectRecentScans);
  const sample = counts?.total === 0;
  const items = sample ? SAMPLE_RECENT_SCANS : liveItems;

  return (
    <Card id="recent-activity" title="Recent activity" meta={sample ? <SampleDataBadge /> : <LiveDataBadge />}>
      {!counts ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="history" title="No activity yet" className="py-6" />
      ) : (
        <ol className="relative space-y-4 before:absolute before:inset-y-1 before:left-[11px] before:w-px before:bg-slate-200">
          {items.map((scan) => {
            const { message, detail, at } = toEvent(scan);
            const { icon, className } = KINDS[scan.status] ?? KINDS.queued;
            return (
              <li key={scan.id} className="relative flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-slate-200 bg-white">
                  <Icon name={icon} className={`size-3 ${className}`} />
                </span>
                <div className="min-w-0 text-[13px] leading-5">
                  <p className="font-medium text-slate-900">{message}</p>
                  <p className="truncate font-mono text-[12px] text-slate-600">{scan.target}</p>
                  <p className="text-slate-500">{detail}</p>
                  {at && (
                    <time dateTime={at} className="block text-xs text-slate-400 tabular-nums">
                      {formatDateTime(at)}
                    </time>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
