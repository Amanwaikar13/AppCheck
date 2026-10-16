"use client";

import {
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import Icon from "./Icon";

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

const ARIA_SORT = { asc: "ascending", desc: "descending" };

/**
 * Accessible, sortable table. `columns` and `data` must be stable references
 * (module scope or memoized). Column `meta.className` styles both th and td.
 *
 * Sorting is client-side by default (`initialSorting`). Pass `sorting` and
 * `onSortingChange` to control it instead, e.g. when the server sorts: the
 * table then shows the given order and leaves `data` as it is.
 */
export default function DataTable({
  columns,
  data,
  caption,
  initialSorting,
  emptyState,
  sorting,
  onSortingChange,
  getRowId,
}) {
  // Table state lives behind builder methods the React Compiler can't track.
  "use no memo";

  const controlled = sorting !== undefined;
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    ...(getRowId ? { getRowId } : {}),
    ...(controlled
      ? {
          state: { sorting },
          onSortingChange,
          manualSorting: true,
          enableMultiSort: false,
          enableSortingRemoval: false,
        }
      : { initialState: initialSorting ? { sorting: initialSorting } : undefined }),
  });

  const rows = table.getRowModel().rows;

  return (
    // `relative` makes this the containing block for visually hidden (absolutely
    // positioned) header text, so it is clipped here instead of widening the page.
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-y border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const { column } = header;
                const sorted = column.getIsSorted();
                const className = column.columnDef.meta?.className ?? "";
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted ? ARIA_SORT[sorted] : undefined}
                    className={`h-9 px-5 font-medium whitespace-nowrap ${className}`}
                  >
                    {header.isPlaceholder ? null : column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={column.getToggleSortingHandler()}
                        className={`-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 ${sorted ? "text-slate-900" : ""}`}
                      >
                        <table.FlexRender header={header} />
                        <Icon
                          name={sorted === "asc" ? "chevronUp" : sorted === "desc" ? "chevronDown" : "sort"}
                          className={`size-3.5 ${sorted ? "text-brand-600" : "text-slate-400"}`}
                        />
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={table.getAllLeafColumns().length}>{emptyState}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50">
                {row.getAllCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-5 py-3 align-middle text-[13px] text-slate-700 ${cell.column.columnDef.meta?.className ?? ""}`}
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
