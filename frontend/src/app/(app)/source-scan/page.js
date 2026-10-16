import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import ExecutionNotice from "@/features/scans/ExecutionNotice";
import PlannedChecks from "@/features/scans/PlannedChecks";
import SourceScanForm from "@/features/scans/SourceScanForm";

export const metadata = { title: "Source Code Scan" };

const PLANNED_CHECKS = [
  {
    title: "Static analysis",
    body: "Detect risky coding patterns such as injection, unsafe deserialization, and weak cryptography.",
  },
  {
    title: "Secret detection",
    body: "Find API keys, tokens, and credentials committed to source code.",
  },
  {
    title: "Dependency audit",
    body: "Identify third-party packages with known vulnerabilities.",
  },
];

export default function SourceScanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Source Code Scan"
        description="Record a source code scan request for a project you own or are authorized to analyze."
      />

      <ExecutionNotice>
        You can record a source scan request by project name. Uploading code (ZIP archives) and source
        analysis are not available yet, so no code is received or analyzed.
      </ExecutionNotice>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card
          id="new-source-scan"
          className="lg:col-span-2"
          title="New source code scan"
          description="Name the project this request is for. Code upload will be added in a later release."
        >
          <SourceScanForm />
        </Card>
        <PlannedChecks
          icon="code"
          items={PLANNED_CHECKS}
          footer="Only scan code you own or are explicitly authorized to analyze."
        />
      </div>
    </div>
  );
}
