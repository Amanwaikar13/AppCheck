"use client";

import { useSelector } from "react-redux";
import { Alert, Skeleton } from "@/components/ui/Feedback";
import { selectRecentScans } from "@/features/scans/scansSlice";
import { SAMPLE_FINDINGS } from "./mockDashboardData";
import SecurityScoreCard from "./SecurityScoreCard";
import SeverityChart from "./SeverityChart";

/**
 * Score and findings from real completed scans (GET /scans/summary). Until the
 * account has one, the same cards show clearly labeled sample data. Reads the
 * summary that ScanActivityCard loads, so it adds no requests.
 */
export default function PostureSection() {
  const { counts, findings, status } = useSelector(selectRecentScans);

  if (!counts && status !== "failed") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card lg:col-span-2" />
      </div>
    );
  }

  const latest = findings?.latest;
  if (latest) {
    const targets = findings.targets;
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SecurityScoreCard live score={latest.securityScore} project={latest.target} />
        <div className="min-w-0 lg:col-span-2">
          <SeverityChart
            live
            findingCounts={findings.bySeverity}
            description={`From the latest completed scan of each of your ${targets} ${targets === 1 ? "target" : "targets"}`}
          />
        </div>
      </div>
    );
  }

  // No completed scan: labeled sample cards. Accounts with some scans also get
  // an explanation, because their other dashboard sections are live.
  const sampleCards = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <SecurityScoreCard score={SAMPLE_FINDINGS.latest.securityScore} project={SAMPLE_FINDINGS.latest.target} />
      <div className="min-w-0 lg:col-span-2">
        <SeverityChart
          findingCounts={SAMPLE_FINDINGS.bySeverity}
          description={`Sample: open findings across ${SAMPLE_FINDINGS.targets} example targets`}
        />
      </div>
    </div>
  );
  if (counts?.total === 0) return sampleCards;
  return (
    <div className="space-y-4">
      <Alert tone="info" title="No completed scans yet">
        These two cards show illustrative sample data until one of your URL scans completes. Then they
        show your real baseline score and findings.
      </Alert>
      {sampleCards}
    </div>
  );
}
