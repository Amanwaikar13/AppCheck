"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import LiveDataBadge from "@/components/ui/LiveDataBadge";
import StatTile, { StatGroup } from "@/components/ui/StatTile";
import { SEVERITIES } from "@/lib/severity";
import FindingsList from "./FindingsList";
import { fetchScanFindings, selectScanFindings } from "./scansSlice";

export const SCORE_FORMULA = "100 − (25 × critical + 10 × high + 4 × medium + 1 × low), counted per distinct issue, minimum 0";

/** Score, severity counts, and findings of a completed scan, all from the real scanner report. */
export default function ScanResults({ scan }) {
  const dispatch = useDispatch();
  const slot = useSelector(selectScanFindings);
  const current = slot.id === scan.id;

  useEffect(() => {
    dispatch(fetchScanFindings(scan.id));
  }, [dispatch, scan.id]);

  const counts = scan.severityCounts ?? {};
  let findingsBody;
  if (current && slot.status === "failed") {
    findingsBody = (
      <div className="border-t border-slate-200 p-5">
        <ErrorState
          title="Could not load findings"
          action={
            <Button variant="secondary" size="sm" onClick={() => dispatch(fetchScanFindings(scan.id))}>
              Try again
            </Button>
          }
        >
          {slot.error?.message}
        </ErrorState>
      </div>
    );
  } else if (!current || slot.status !== "succeeded") {
    findingsBody = (
      <div role="status" aria-label="Loading findings" className="space-y-3 border-t border-slate-200 p-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  } else if (slot.items.length === 0) {
    findingsBody = (
      <EmptyState className="border-t border-slate-200" icon="checkCircle" title="No issues reported by this scan">
        The passive baseline scan found nothing to report in the responses it saw. This does not mean the
        application has no vulnerabilities; active testing was not performed.
      </EmptyState>
    );
  } else {
    findingsBody = <FindingsList findings={slot.items} />;
  }

  return (
    <>
      <Card flush id="scan-summary" title="Results" meta={<LiveDataBadge />} description={`Engine: ${scan.engine ?? "Unknown"}`}>
        <StatGroup className="border-t border-slate-200" columns="sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Baseline score" value={`${scan.securityScore} / 100`} hint="See formula below" />
          {SEVERITIES.map(({ key, label, color }) => (
            <StatTile key={key} label={label} value={counts[key] ?? 0} marker={color} />
          ))}
        </StatGroup>
        <p className="border-t border-slate-100 px-5 py-3 text-xs leading-5 text-slate-500">
          Baseline score = {SCORE_FORMULA}. It reflects this passive scan only, not the overall security of
          the application. ZAP baseline rules never report Critical.
        </p>
      </Card>

      <Card
        flush
        id="scan-findings"
        title="Findings"
        description={`${scan.findingsCount} distinct ${scan.findingsCount === 1 ? "issue" : "issues"}, most severe first. Select one for details.`}
      >
        {findingsBody}
      </Card>
    </>
  );
}
