import Button, { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { SCAN_TYPE_LABELS, ScanStatusCell } from "./scanDisplay";

/**
 * Confirms that a scan request was stored. It deliberately shows no report:
 * the scanner has not run, so there are no results to show.
 */
export default function ScanCreatedNotice({ scan, notice, onCreateAnother, anotherLabel }) {
  return (
    <div className="space-y-4">
      <Alert tone="success" title="Scan request recorded">
        {notice}
      </Alert>

      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-[13px]">
        <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-4">
          <dt className="text-slate-500">Target</dt>
          <dd className="min-w-0 font-mono text-[12.5px] break-all text-slate-900 sm:col-span-3">{scan.target}</dd>
        </div>
        <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-4">
          <dt className="text-slate-500">Type</dt>
          <dd className="text-slate-900 sm:col-span-3">{SCAN_TYPE_LABELS[scan.type]}</dd>
        </div>
        <div className="grid gap-1 px-4 py-2.5 sm:grid-cols-4">
          <dt className="text-slate-500">Status</dt>
          <dd className="sm:col-span-3">
            <ScanStatusCell scan={scan} />
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/scans/${scan.id}`} variant="secondary" size="sm">
          View record
        </ButtonLink>
        <ButtonLink href="/scans" variant="secondary" size="sm">
          Scan history
        </ButtonLink>
        <Button variant="ghost" size="sm" onClick={onCreateAnother}>
          {anotherLabel}
        </Button>
      </div>
    </div>
  );
}
