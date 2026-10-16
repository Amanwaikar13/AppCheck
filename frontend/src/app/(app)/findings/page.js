import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import PageHeader from "@/components/ui/PageHeader";
import SeverityBadge from "@/components/ui/SeverityBadge";
import PlannedChecks from "@/features/scans/PlannedChecks";
import { SEVERITIES } from "@/lib/severity";

export const metadata = { title: "Findings" };

// How AppCheck will rank findings. Reference text, not data.
const SEVERITY_GUIDANCE = {
  critical: "Directly exploitable, high impact: remote code execution, authentication bypass, exposed production secrets.",
  high: "Serious weakness that is likely exploitable, such as injection or broken access control.",
  medium: "Exploitable under specific conditions, or a missing defense such as an absent security header.",
  low: "Limited impact or hard to exploit; hardening recommendations.",
  info: "Observations with no direct risk, recorded for context.",
};

// Fields each finding already has today; triage status is the planned addition.
const FINDING_FIELDS = [
  { title: "Severity", body: "Critical to Informational. Triage states (accepted risk, false positive, fixed) are planned." },
  { title: "Location and evidence", body: "URL and parameter, or file and line, with the request or code that triggered it." },
  { title: "Classification", body: "The scanner rule, its confidence, and a CWE reference when available." },
  { title: "Remediation", body: "What to change, and why, with links to guidance." },
];

export default function FindingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        description="Security issues reported by your scans, ranked by severity."
      />

      <Card flush id="findings-list" title="Where to find results">
        <EmptyState
          className="border-t border-slate-200"
          icon="bug"
          title="Findings are listed on each completed scan"
          action={
            <ButtonLink href="/scans" variant="secondary" size="sm">
              Open scan history
            </ButtonLink>
          }
        >
          Open a completed URL scan to see its OWASP ZAP findings with severity, affected URLs, evidence,
          and remediation. A combined view across all scans, with triage, is planned.
        </EmptyState>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card id="severity-scale" title="Severity scale" description="How findings will be ranked." className="lg:col-span-2">
          <dl className="divide-y divide-slate-100">
            {SEVERITIES.map(({ key }) => (
              <div key={key} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt>
                  <SeverityBadge severity={key} />
                </dt>
                <dd className="text-[13px] leading-5 text-slate-600">{SEVERITY_GUIDANCE[key]}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <PlannedChecks title="Each finding includes" badge="Available" icon="bug" items={FINDING_FIELDS} />
      </div>
    </div>
  );
}
