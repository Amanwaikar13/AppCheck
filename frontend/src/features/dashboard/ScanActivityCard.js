"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { createColumnHelper } from "@tanstack/react-table";
import Button, { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import { ErrorState } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";
import LiveDataBadge from "@/components/ui/LiveDataBadge";
import SampleDataBadge from "@/components/ui/SampleDataBadge";
import StatTile, { StatGroup } from "@/components/ui/StatTile";
import { formatDateTime } from "@/lib/format";
import { SCAN_TYPE_LABELS, ScanStatusCell } from "@/features/scans/scanDisplay";
import { fetchScanSummary, selectRecentScans } from "@/features/scans/scansSlice";
import { SAMPLE_RECENT_SCANS, SAMPLE_SCAN_COUNTS } from "./mockDashboardData";

const helper = createColumnHelper();

// Rows arrive newest first from the API; this table does not re-sort them.
const columns = helper.columns([
  helper.accessor("target", {
    header: "Target",
    enableSorting: false,
    cell: (info) => (
      <span title={info.getValue()} className="block max-w-xs truncate font-mono text-[12.5px] text-slate-900">
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor("type", {
    header: "Type",
    enableSorting: false,
    cell: (info) => <span className="whitespace-nowrap">{SCAN_TYPE_LABELS[info.getValue()]}</span>,
  }),
  helper.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: (info) => <ScanStatusCell scan={info.row.original} />,
  }),
  helper.accessor("createdAt", {
    header: "Requested",
    enableSorting: false,
    cell: (info) => (
      <time dateTime={info.getValue()} className="whitespace-nowrap text-slate-500 tabular-nums">
        {formatDateTime(info.getValue())}
      </time>
    ),
  }),
  helper.display({
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: (info) => (
      <Link
        href={`/scans/${info.row.original.id}`}
        aria-label={`View details for ${info.row.original.target}`}
        className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        View
        <Icon name="chevronRight" className="size-3.5" />
      </Link>
    ),
    meta: { className: "text-right" },
  }),
]);

// Sample rows have no detail pages, so the sample table has no actions column
// and no links: only the columns that describe the scan.
const sampleColumns = columns.filter((column) => column.id !== "actions");

const getRowId = (scan) => scan.id;

/**
 * The account's scan counts and five newest scans (live). With no scan records
 * at all it shows the labeled sample dataset instead, never both at once.
 */
export default function ScanActivityCard() {
  const dispatch = useDispatch();
  const { status, items, counts, error } = useSelector(selectRecentScans);
  const loading = counts === null && status !== "failed";
  // No scan records at all: show the labeled sample preview instead of an empty card.
  const sample = !loading && status !== "failed" && counts?.total === 0;
  const shown = sample ? SAMPLE_SCAN_COUNTS : counts;

  useEffect(() => {
    dispatch(fetchScanSummary());
  }, [dispatch]);

  let body;
  if (status === "failed") {
    body = (
      <div className="border-t border-slate-200 p-5">
        <ErrorState
          title="Could not load scan activity"
          action={
            <Button variant="secondary" size="sm" onClick={() => dispatch(fetchScanSummary())}>
              Try again
            </Button>
          }
        >
          {error?.message}
        </ErrorState>
      </div>
    );
  } else if (sample) {
    body = (
      <DataTable
        columns={sampleColumns}
        data={SAMPLE_RECENT_SCANS}
        getRowId={getRowId}
        caption="Five example scans (sample data, not your account)"
      />
    );
  } else if (!loading) {
    body = (
      <DataTable columns={columns} data={items} getRowId={getRowId} caption="Your five most recent scan requests" />
    );
  }

  return (
    <Card
      flush
      id="scan-activity"
      title="Scan activity"
      meta={sample ? <SampleDataBadge /> : <LiveDataBadge />}
      description={
        sample
          ? "Example scans showing what this card looks like. Your own scans replace them after your first scan."
          : "Scan requests recorded by your account."
      }
      action={
        sample ? (
          <ButtonLink href="/url-scan" size="sm">
            <Icon name="plus" className="size-3.5" />
            New URL scan
          </ButtonLink>
        ) : (
          <ButtonLink href="/scans" variant="secondary" size="sm">
            View all
          </ButtonLink>
        )
      }
    >
      {status !== "failed" && (
        <StatGroup className="border-t border-slate-200" columns="sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Scan requests" value={shown?.total} loading={loading} hint="URL and source code" />
          <StatTile
            label="Queued or running"
            value={shown ? shown.queued + shown.running : null}
            loading={loading}
            hint="Waiting for or being scanned"
          />
          <StatTile label="Completed" value={shown?.completed} loading={loading} hint="Executed by OWASP ZAP" />
          <StatTile label="Failed" value={shown?.failed} loading={loading} hint="Did not complete" />
        </StatGroup>
      )}
      {body}
    </Card>
  );
}
