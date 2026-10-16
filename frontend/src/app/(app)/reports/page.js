import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import PageHeader from "@/components/ui/PageHeader";
import PlannedChecks from "@/features/scans/PlannedChecks";

export const metadata = { title: "Reports" };

const REPORT_TYPES = [
  { title: "Scan report", body: "One scan: summary, every finding with evidence, and remediation guidance." },
  { title: "Posture summary", body: "Workspace-wide trends in findings and project security scores over time." },
  { title: "Export formats", body: "PDF for stakeholders and JSON for tooling and record-keeping." },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Shareable summaries of scan results for teams, stakeholders, and audits."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card flush id="reports-list" title="Generated reports" meta={<Badge variant="outline">0 reports</Badge>} className="lg:col-span-2">
          <EmptyState
            className="border-t border-slate-200"
            icon="report"
            title="No reports yet"
            action={
              <ButtonLink href="/scans" variant="secondary" size="sm">
                View scan history
              </ButtonLink>
            }
          >
            Report generation is not available yet, so there is nothing to export. Results of completed
            URL scans are on each scan&apos;s page in Scan History.
          </EmptyState>
        </Card>
        <PlannedChecks title="Report types" icon="file" items={REPORT_TYPES} />
      </div>
    </div>
  );
}
