"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import Button, { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Feedback";
import LiveDataBadge from "@/components/ui/LiveDataBadge";
import Pagination from "@/components/ui/Pagination";
import ScanFilters from "./ScanFilters";
import { getScanRowId, scanHistoryColumns, sortToSorting, sortingToSort } from "./scanColumns";
import {
  fetchScans,
  resetScanQuery,
  selectScanList,
  selectScanQuery,
  updateScanQuery,
} from "./scansSlice";

function LoadingRows() {
  return (
    <div role="status" aria-label="Loading scans" className="space-y-3 border-t border-slate-200 p-5">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}

export default function ScanHistory() {
  const dispatch = useDispatch();
  const query = useSelector(selectScanQuery);
  const { status, items, pagination, error } = useSelector(selectScanList);

  // Refetch whenever the query changes, and on every visit to the page.
  useEffect(() => {
    dispatch(fetchScans(query));
  }, [dispatch, query]);

  const setQuery = (changes) => dispatch(updateScanQuery(changes));
  const retry = () => dispatch(fetchScans(query));
  const hasFilters = Boolean(query.type || query.status);
  const busy = status === "loading" || status === "idle";

  let body;
  if (status === "failed") {
    body = (
      <div className="border-t border-slate-200 p-5">
        <ErrorState
          title="Could not load scan history"
          action={
            <Button variant="secondary" size="sm" onClick={retry}>
              Try again
            </Button>
          }
        >
          {error?.message}
        </ErrorState>
      </div>
    );
  } else if (!pagination) {
    body = <LoadingRows />;
  } else if (pagination.totalItems === 0) {
    body = hasFilters ? (
      <EmptyState
        icon="history"
        title="No scans match these filters"
        action={
          <Button variant="secondary" size="sm" onClick={() => dispatch(resetScanQuery())}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon="history"
        title="No scans yet"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/url-scan" size="sm">
              Record a URL scan
            </ButtonLink>
            <ButtonLink href="/source-scan" variant="secondary" size="sm">
              Record a source scan
            </ButtonLink>
          </div>
        }
      >
        Scan requests you record will appear here.
      </EmptyState>
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon="history"
        title="This page is empty"
        action={
          <Button variant="secondary" size="sm" onClick={() => setQuery({ page: 1 })}>
            Go to the first page
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <div aria-busy={busy} className={busy ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <DataTable
            columns={scanHistoryColumns}
            data={items}
            getRowId={getScanRowId}
            caption="Your scan requests"
            sorting={sortToSorting(query.sort)}
            onSortingChange={(updater) => {
              const current = sortToSorting(query.sort);
              const next = typeof updater === "function" ? updater(current) : updater;
              setQuery({ sort: sortingToSort(next) });
            }}
          />
        </div>
        <Pagination
          label="Scan history pages"
          noun="scans"
          pagination={pagination}
          busy={busy}
          onPage={(page) => setQuery({ page })}
        />
      </>
    );
  }

  return (
    <Card
      flush
      id="scan-history"
      title="Scan requests"
      meta={<LiveDataBadge />}
      description="Recorded by your account. Records marked Not executed have never been run by a scanner."
      action={
        hasFilters ? (
          <Button variant="ghost" size="sm" onClick={() => dispatch(resetScanQuery())}>
            Clear filters
          </Button>
        ) : null
      }
    >
      <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-3.5">
        <ScanFilters query={query} onChange={setQuery} />
      </div>
      {body}
    </Card>
  );
}
