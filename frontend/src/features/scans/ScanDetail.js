"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Button, { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Alert, EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { formatDateTime } from "@/lib/format";
import ExecutionNotice from "./ExecutionNotice";
import ScanResults from "./ScanResults";
import ScannerStatusNotice from "./ScannerStatusNotice";
import { SCAN_TYPE_LABELS, ScanStatusCell, isInProgress } from "./scanDisplay";
import { fetchScan, selectScanDetail } from "./scansSlice";

// While a scan can still change, re-read it this often (well within rate limits).
const POLL_MS = 10_000;

// Both mean "there is no scan with this ID that you can see".
const NOT_FOUND_CODES = new Set(["SCAN_NOT_FOUND", "VALIDATION_ERROR"]);

function Row({ label, children }) {
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className="min-w-0 text-[13px] text-slate-900 sm:col-span-2">{children}</dd>
    </div>
  );
}

function Timestamp({ value, empty }) {
  if (!value) return <span className="text-slate-500">{empty}</span>;
  return (
    <time dateTime={value} className="tabular-nums">
      {formatDateTime(value)}
    </time>
  );
}

const backAction = (
  <ButtonLink href="/scans" variant="secondary">
    <Icon name="arrowLeft" className="size-4" />
    Scan history
  </ButtonLink>
);

function Shell({ description, meta, children }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Scan details" description={description} meta={meta} actions={backAction} />
      {children}
    </div>
  );
}

export default function ScanDetail({ id }) {
  const dispatch = useDispatch();
  const detail = useSelector(selectScanDetail);
  // Ignore state left over from a previously viewed scan.
  const current = detail.id === id;
  const status = current ? detail.status : "idle";
  const error = current ? detail.error : null;
  const scan = current && detail.scan?.id === id ? detail.scan : null;

  useEffect(() => {
    dispatch(fetchScan(id));
  }, [dispatch, id]);

  // Poll only while the scan is queued or running; stop at completed/failed.
  const polling = Boolean(scan && isInProgress(scan));
  useEffect(() => {
    if (!polling) return undefined;
    const timer = setInterval(() => dispatch(fetchScan(id)), POLL_MS);
    return () => clearInterval(timer);
  }, [polling, dispatch, id]);

  if (status === "failed" && NOT_FOUND_CODES.has(error?.code)) {
    return (
      <Shell>
        <Card>
          <EmptyState
            icon="history"
            title="Scan not found"
            action={
              <ButtonLink href="/scans" variant="secondary" size="sm">
                Back to scan history
              </ButtonLink>
            }
          >
            This scan does not exist, or it belongs to another account.
          </EmptyState>
        </Card>
      </Shell>
    );
  }

  if (status === "failed") {
    return (
      <Shell>
        <ErrorState
          title="Could not load this scan"
          action={
            <Button variant="secondary" size="sm" onClick={() => dispatch(fetchScan(id))}>
              Try again
            </Button>
          }
        >
          {error?.message}
        </ErrorState>
      </Shell>
    );
  }

  if (!scan) {
    return (
      <Shell>
        <div role="status" aria-label="Loading scan" className="space-y-4">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-80 rounded-card" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      description={<span className="font-mono text-[13px] break-all">{scan.target}</span>}
      meta={<ScanStatusCell scan={scan} />}
    >
      <StatusAlert scan={scan} />
      {scan.status === "completed" && <ScanResults scan={scan} />}

      <Card flush id="scan-detail" title="Scan record">
        <dl className="grid divide-y divide-slate-100 border-t border-slate-200 lg:grid-cols-2 lg:divide-y-0">
          <div className="divide-y divide-slate-100">
            <Row label="Target">
              <span className="font-mono text-[12.5px] break-all">{scan.target}</span>
            </Row>
            <Row label="Type">{SCAN_TYPE_LABELS[scan.type]}</Row>
            <Row label="Engine">{scan.engine ?? <span className="text-slate-500">Not started</span>}</Row>
            <Row label="Scan ID">
              <span className="font-mono text-[12.5px] break-all text-slate-600">{scan.id}</span>
            </Row>
          </div>
          <div className="divide-y divide-slate-100 lg:border-l lg:border-slate-100">
            <Row label="Requested">
              <Timestamp value={scan.createdAt} />
            </Row>
            <Row label="Started">
              <Timestamp value={scan.startedAt} empty="Not started" />
            </Row>
            <Row label="Finished">
              <Timestamp value={scan.completedAt} empty="Not finished" />
            </Row>
            <Row label="Updated">
              <Timestamp value={scan.updatedAt} />
            </Row>
          </div>
        </dl>
      </Card>
    </Shell>
  );
}

/** What is happening with this scan right now, stated plainly. */
function StatusAlert({ scan }) {
  if (scan.type === "source") return <ExecutionNotice />;
  if (scan.status === "queued") {
    return (
      <>
        <ScannerStatusNotice onlyWhenUnavailable />
        <Alert tone="info" title="Waiting for the scanner">
          This scan is queued and has not started. This page refreshes automatically.
        </Alert>
      </>
    );
  }
  if (scan.status === "running") {
    return (
      <Alert tone="info" title="Scan in progress">
        OWASP ZAP is crawling the target and running passive checks. Results appear here when it
        finishes; this page refreshes automatically.
      </Alert>
    );
  }
  if (scan.status === "failed") {
    return (
      <Alert tone="danger" title="The scan failed">
        {scan.error?.message ?? "The scan did not complete."} No results were recorded.
      </Alert>
    );
  }
  return null;
}