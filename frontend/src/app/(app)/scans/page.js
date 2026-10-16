import { ButtonLink } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import ScannerStatusNotice from "@/features/scans/ScannerStatusNotice";
import ScanHistory from "@/features/scans/ScanHistory";

export const metadata = { title: "Scan History" };

export default function ScanHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan History"
        description="Every URL and source code scan request recorded by your account."
        actions={
          <>
            <ButtonLink href="/source-scan" variant="secondary">
              <Icon name="code" className="size-4" />
              Source code scan
            </ButtonLink>
            <ButtonLink href="/url-scan">
              <Icon name="plus" className="size-4" />
              New URL scan
            </ButtonLink>
          </>
        }
      />
      <ScannerStatusNotice onlyWhenUnavailable />
      <ScanHistory />
    </div>
  );
}
