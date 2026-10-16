import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import Icon from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format";
import { ResultValue, SCAN_TYPE_LABELS, ScanStatusCell } from "./scanDisplay";

const helper = createColumnHelper();

// Column ids match the API sort fields; columns without one are not sortable.
export const scanHistoryColumns = helper.columns([
  helper.accessor("target", {
    header: "Target",
    cell: (info) => (
      <Link
        href={`/scans/${info.row.original.id}`}
        className="block max-w-xs truncate rounded font-mono text-[12.5px] text-slate-900 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 lg:max-w-md"
        title={info.getValue()}
      >
        {info.getValue()}
      </Link>
    ),
  }),
  helper.accessor("type", {
    header: "Type",
    cell: (info) => <span className="whitespace-nowrap">{SCAN_TYPE_LABELS[info.getValue()]}</span>,
  }),
  helper.accessor("status", {
    header: "Status",
    cell: (info) => <ScanStatusCell scan={info.row.original} />,
  }),
  helper.accessor("securityScore", {
    header: "Score",
    enableSorting: false,
    cell: (info) => <ResultValue value={info.getValue()} suffix=" / 100" />,
  }),
  helper.accessor("findingsCount", {
    header: "Findings",
    enableSorting: false,
    cell: (info) => <ResultValue value={info.getValue()} />,
  }),
  helper.accessor("createdAt", {
    header: "Requested",
    sortDescFirst: true,
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
        Details
        <Icon name="chevronRight" className="size-3.5" />
      </Link>
    ),
    meta: { className: "text-right" },
  }),
]);

export const getScanRowId = (scan) => scan.id;

/** "-createdAt" <-> [{ id: "createdAt", desc: true }] */
export function sortToSorting(sort) {
  const desc = sort.startsWith("-");
  return [{ id: desc ? sort.slice(1) : sort, desc }];
}

export function sortingToSort(sorting) {
  const [first] = sorting;
  if (!first) return "-createdAt";
  return first.desc ? `-${first.id}` : first.id;
}
