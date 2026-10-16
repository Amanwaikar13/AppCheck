import Select from "@/components/ui/Select";
import { SCAN_SORT_OPTIONS, SCAN_STATUS_OPTIONS, SCAN_TYPE_OPTIONS } from "./scanDisplay";

const PAGE_SIZES = [10, 20, 50].map((size) => ({ value: String(size), label: `${size} per page` }));

/**
 * Filters and sorting supported by GET /scans. Every change is sent to the
 * API; nothing is filtered in the browser.
 */
export default function ScanFilters({ query, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Select
        id="scan-filter-type"
        label="Type"
        value={query.type}
        options={SCAN_TYPE_OPTIONS}
        onChange={(type) => onChange({ type })}
      />
      <Select
        id="scan-filter-status"
        label="Status"
        value={query.status}
        options={SCAN_STATUS_OPTIONS}
        onChange={(status) => onChange({ status })}
      />
      <Select
        id="scan-sort"
        label="Sort by"
        value={query.sort}
        options={SCAN_SORT_OPTIONS}
        onChange={(sort) => onChange({ sort })}
      />
      <Select
        id="scan-page-size"
        label="Rows"
        value={String(query.limit)}
        options={PAGE_SIZES}
        onChange={(limit) => onChange({ limit: Number(limit) })}
      />
    </div>
  );
}
