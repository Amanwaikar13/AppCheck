"use client";

import Link from "next/link";
import { useBackendHealth } from "@/hooks/useBackendHealth";

const STATES = {
  checking: { dot: "bg-slate-400 animate-pulse", label: "Checking API" },
  healthy: { dot: "bg-emerald-500", label: "API online" },
  degraded: { dot: "bg-amber-500", label: "Database unavailable" },
  offline: { dot: "bg-red-500", label: "API offline" },
};

function resolveState({ isLoading, report, requestStatus }) {
  if (requestStatus === "failed") return "offline";
  if (report) return report.status === "healthy" ? "healthy" : "degraded";
  return isLoading ? "checking" : "offline";
}

/** Compact backend connectivity pill from the real health check; links to full status. */
export default function BackendStatusIndicator() {
  const health = useBackendHealth();
  const { dot, label } = STATES[resolveState(health)];

  return (
    <Link
      href="/settings#system-status"
      aria-label={`Backend status: ${label}. View system status`}
      title={`Backend status: ${label}`}
      className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      <span className="hidden md:inline">{label}</span>
    </Link>
  );
}
