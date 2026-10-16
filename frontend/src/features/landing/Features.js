import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import SectionHeading from "./SectionHeading";

// Status reflects what the application does today. Keep in sync with the README.
const FEATURES = [
  {
    icon: "globe",
    title: "URL scanning",
    status: "available",
    body: "Passive OWASP ZAP baseline scans of web applications you are authorized to test, run in the background with real status, findings, and a baseline score. Targets are checked down to their DNS answers, and the scanner can only reach the submitted host.",
    planned: "Active testing and TLS analysis. Requires Docker with OWASP ZAP on the server.",
  },
  {
    icon: "code",
    title: "Source code analysis",
    status: "partial",
    body: "Record source scan requests by project name.",
    planned: "Code upload, static analysis, secret detection, and dependency audits.",
  },
  {
    icon: "history",
    title: "Scan history",
    status: "available",
    body: "A private, per-account history with filters by type and status, server-side sorting and pagination, and a detail view for every record.",
  },
  {
    icon: "bug",
    title: "Findings",
    status: "available",
    body: "Each completed scan lists its findings, ranked from High to Informational, with affected URLs, safe evidence, CWE references, and remediation guidance.",
    planned: "A combined view across scans with triage states.",
  },
  {
    icon: "report",
    title: "Reports",
    status: "planned",
    body: "Per-scan reports and workspace posture summaries, exportable as PDF or JSON.",
  },
  {
    icon: "shield",
    title: "Baseline score",
    status: "available",
    body: "A 0-100 score per completed scan from a published formula: 100 minus weighted counts of distinct findings by severity.",
  },
];

const STATUS = {
  available: { tone: "success", label: "Available" },
  partial: { tone: "brand", label: "Requests available" },
  planned: { tone: "neutral", label: "Planned" },
};

export default function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="features-title" eyebrow="Features" title="One workspace for application and code security">
          AppCheck is being built in phases. Each capability below is labeled with what works today and what is
          still planned.
        </SectionHeading>

        <ul className="mt-12 grid gap-px overflow-hidden rounded-card border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon, title, status, body, planned }) => (
            <li key={title} className="flex flex-col bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-brand-700">
                  <Icon name={icon} className="size-[18px]" />
                </span>
                <Badge tone={STATUS[status].tone} variant={status === "planned" ? "outline" : "soft"}>
                  {STATUS[status].label}
                </Badge>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold text-navy-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              {planned && (
                <p className="mt-3 text-[13px] leading-5 text-slate-500">
                  <span className="font-medium text-slate-700">Planned:</span> {planned}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
