import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import SampleDataBadge from "@/components/ui/SampleDataBadge";
import { SEVERITIES } from "@/lib/severity";

// Illustrative only. Rows mirror what the product records today (queued scan
// requests that no scanner has run); the severity counts are sample values.
const ROWS = [
  { target: "https://app.example.com/", type: "URL", when: "Oct 15, 09:42" },
  { target: "acme/payments-api", type: "Source code", when: "Oct 15, 09:31" },
  { target: "https://docs.example.org/", type: "URL", when: "Oct 14, 17:05" },
];
const SAMPLE_COUNTS = { critical: 2, high: 7, medium: 15, low: 23, info: 9 };
const MAX = Math.max(...Object.values(SAMPLE_COUNTS));
const NAV = ["overview", "globe", "code", "history", "bug", "report"];

/**
 * Static picture of the dashboard, built from the app's own components and
 * tokens. Hidden from assistive tech (it is decorative); the caption says
 * what it is.
 */
export default function ProductPreview() {
  return (
    <figure className="mx-auto w-full max-w-5xl">
      <div className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgb(15_23_42/0.35)]">
        <div aria-hidden="true" className="flex">
          <div className="hidden w-14 shrink-0 flex-col items-center gap-3 bg-navy-950 py-4 sm:flex">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">
              <Icon name="shield" className="size-4" />
            </span>
            {NAV.map((name, i) => (
              <span
                key={name}
                className={`grid size-8 place-items-center rounded-md ${i === 0 ? "bg-white/10 text-brand-300" : "text-navy-400"}`}
              >
                <Icon name={name} className="size-4" />
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1 bg-canvas">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <p className="truncate text-xs text-slate-500">
                AppCheck <span className="text-slate-300">/</span>{" "}
                <span className="font-medium text-slate-900">Overview</span>
              </p>
              <SampleDataBadge />
            </div>

            <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-5">
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white lg:col-span-3">
                <dl className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                  {[
                    ["Scan requests", "12"],
                    ["Awaiting scanner", "12"],
                    ["Completed", "0"],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 px-3 py-2.5">
                      <dt className="truncate text-[11px] text-slate-500">{label}</dt>
                      <dd className="text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="divide-y divide-slate-100">
                  {ROWS.map((row) => (
                    <li key={row.target} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[12px] text-slate-900">{row.target}</p>
                        <p className="text-[11px] text-slate-500">
                          {row.type} · {row.when} UTC
                        </p>
                      </div>
                      <div className="hidden shrink-0 gap-1.5 sm:flex">
                        <Badge dot>Queued</Badge>
                        <Badge tone="warning" variant="dashed">
                          Not executed
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 lg:col-span-2">
                <p className="text-xs font-semibold text-slate-900">Open findings by severity</p>
                <ul className="mt-3 space-y-2">
                  {SEVERITIES.map(({ key, label, color }) => (
                    <li key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-[11px]">
                      <span className="truncate text-slate-600">{label}</span>
                      <span className="h-2 rounded-sm bg-slate-100">
                        <span
                          className="block h-2 rounded-sm"
                          style={{ width: `${(SAMPLE_COUNTS[key] / MAX) * 100}%`, backgroundColor: color }}
                        />
                      </span>
                      <span className="text-right font-medium text-slate-900 tabular-nums">{SAMPLE_COUNTS[key]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-500">
        Illustrative preview with sample data. It does not show results from a real scan.
      </figcaption>
    </figure>
  );
}
