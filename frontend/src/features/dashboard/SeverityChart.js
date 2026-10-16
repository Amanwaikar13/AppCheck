"use client";

import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/components/ui/Card";
import LiveDataBadge from "@/components/ui/LiveDataBadge";
import SampleDataBadge from "@/components/ui/SampleDataBadge";
import { SEVERITIES } from "@/lib/severity";

const AXIS_TICK = { fill: "#64748b", fontSize: 12 }; // slate-500
const GRID_STROKE = "#eef0f3";

function SeverityBar(props) {
  return <Rectangle {...props} fill={props.payload.color} />;
}

function SeverityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { label, count, color, share } = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-popover">
      <p className="flex items-center gap-1.5 font-medium text-slate-900">
        <span aria-hidden="true" className="size-2 rounded-sm" style={{ backgroundColor: color }} />
        {label}
      </p>
      <p className="mt-0.5 text-slate-600">
        <span className="font-semibold text-slate-900 tabular-nums">{count}</span> findings · {share}% of total
      </p>
    </div>
  );
}

/** Open findings per severity: a ranked count list beside a bar chart. */
export default function SeverityChart({ findingCounts, live = false, description }) {
  const total = SEVERITIES.reduce((sum, { key }) => sum + findingCounts[key], 0);
  const data = SEVERITIES.map(({ key, label, shortLabel, color }) => ({
    key,
    label,
    axisLabel: shortLabel ?? label,
    color,
    count: findingCounts[key],
    share: total ? Math.round((findingCounts[key] / total) * 100) : 0,
  }));
  const summary = data.map(({ label, count }) => `${label}: ${count}`).join(", ");

  return (
    <Card
      id="findings-by-severity"
      title="Open findings by severity"
      meta={live ? <LiveDataBadge /> : <SampleDataBadge />}
      description={description ?? `${total} open findings across all projects`}
      className="h-full"
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <dl className="divide-y divide-slate-100">
          {data.map(({ key, label, color, count, share }) => (
            <div key={key} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
              <dt className="flex-1 text-[13px] text-slate-600">{label}</dt>
              <dd className="text-sm font-semibold text-slate-900 tabular-nums">{count}</dd>
              <dd className="w-9 text-right text-xs text-slate-400 tabular-nums">{share}%</dd>
            </div>
          ))}
        </dl>

        <figure className="min-w-0">
          <figcaption className="sr-only">
            Open findings by severity{live ? "" : " (sample data)"}. {summary}.
          </figcaption>
          <div aria-hidden="true" className="h-52">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: 208 }}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                barCategoryGap="30%"
                accessibilityLayer={false}
              >
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                <YAxis
                  type="category"
                  dataKey="axisLabel"
                  width={64}
                  axisLine={false}
                  tickLine={false}
                  tick={AXIS_TICK}
                />
                <Tooltip cursor={{ fill: "#f1f5f9" }} content={<SeverityTooltip />} isAnimationActive={false} />
                <Bar dataKey="count" maxBarSize={18} radius={[0, 3, 3, 0]} shape={SeverityBar} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>
    </Card>
  );
}
