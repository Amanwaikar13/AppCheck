"use client";

import { useBackendHealth } from "@/hooks/useBackendHealth";
import { APP_VERSION } from "@/lib/config";

/** Release and the environment reported by the API health check (never guessed). */
export default function SidebarFooter() {
  const { report } = useBackendHealth();
  return (
    <div className="space-y-2 border-t border-white/[0.08] px-3 pt-4 text-[11px] leading-4 text-navy-400">
      <div className="flex items-center justify-between gap-2">
        <span>Version {APP_VERSION}</span>
        {report?.environment && (
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-medium text-navy-300 capitalize">
            {report.environment}
          </span>
        )}
      </div>
      <p>Scan only applications and code you are authorized to test.</p>
    </div>
  );
}
