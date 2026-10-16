import Button from "./Button";
import Icon from "./Icon";

/**
 * Previous/next paging for server-paginated lists. `pagination` is the API
 * shape: { page, limit, totalItems, totalPages, hasNextPage, hasPreviousPage }.
 */
export default function Pagination({ pagination, onPage, busy = false, label = "Pagination", noun = "items" }) {
  const { page, limit, totalItems, totalPages, hasNextPage, hasPreviousPage } = pagination;
  const first = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, totalItems);
  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3 text-[13px] text-slate-600 sm:flex-row sm:items-center sm:justify-between"
    >
      <p aria-live="polite" className="tabular-nums">
        {totalItems === 0 ? (
          `No ${noun}`
        ) : (
          <>
            <span className="font-medium text-slate-900">{first}</span>–
            <span className="font-medium text-slate-900">{last}</span> of{" "}
            <span className="font-medium text-slate-900">{totalItems}</span> {noun}
            <span className="text-slate-400"> · </span>Page {page} of {Math.max(totalPages, 1)}
          </>
        )}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={!hasPreviousPage || busy} onClick={() => onPage(page - 1)}>
          <Icon name="chevronLeft" className="-ml-1 size-4" />
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={!hasNextPage || busy} onClick={() => onPage(page + 1)}>
          Next
          <Icon name="chevronRight" className="-mr-1 size-4" />
        </Button>
      </div>
    </nav>
  );
}
