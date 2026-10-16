import Card from "@/components/ui/Card";
import LiveDataBadge from "@/components/ui/LiveDataBadge";
import SampleDataBadge from "@/components/ui/SampleDataBadge";

const BANDS = [
  { min: 80, label: "Good", bar: "bg-emerald-600", track: "bg-emerald-100", text: "text-emerald-700" },
  { min: 50, label: "Needs attention", bar: "bg-amber-500", track: "bg-amber-100", text: "text-amber-800" },
  { min: 0, label: "At risk", bar: "bg-red-600", track: "bg-red-100", text: "text-red-700" },
];

/**
 * Baseline score (0-100) of the latest completed scan when `live`, otherwise
 * illustrative sample data; the card says which.
 */
export default function SecurityScoreCard({ score, project, live = false }) {
  const band = BANDS.find(({ min }) => score >= min);

  return (
    <Card
      id="security-score"
      title={live ? "Baseline score" : "Project security score"}
      meta={live ? <LiveDataBadge /> : <SampleDataBadge />}
      description={live ? `Latest completed scan: ${project}` : `Project: ${project}`}
      className="flex flex-col"
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">{score}</span>
        <span className="text-sm text-slate-500">/ 100</span>
        <span className={`ml-auto text-[13px] font-medium ${band.text}`}>{band.label}</span>
      </div>

      <div
        role="meter"
        aria-label={live ? "Baseline score of the latest completed scan" : "Project security score (sample data)"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-valuetext={`${score} out of 100, ${band.label.toLowerCase()}${live ? "" : ", sample data"}`}
        className={`mt-3 h-1.5 overflow-hidden rounded-full ${band.track}`}
      >
        <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${score}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-3 text-[11px] text-slate-500">
        <div>
          <dt>At risk</dt>
          <dd className="tabular-nums">0-49</dd>
        </div>
        <div className="text-center">
          <dt>Needs attention</dt>
          <dd className="tabular-nums">50-79</dd>
        </div>
        <div className="text-right">
          <dt>Good</dt>
          <dd className="tabular-nums">80-100</dd>
        </div>
      </dl>

      <p className="mt-auto border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        {live
          ? "100 − (25 × critical + 10 × high + 4 × medium + 1 × low) from one passive OWASP ZAP baseline scan. It is not a measure of overall application security."
          : "Sample value. Scores are calculated from real scan findings once a URL scan completes."}
      </p>
    </Card>
  );
}
