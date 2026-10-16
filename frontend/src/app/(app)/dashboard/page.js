import { ButtonLink } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import RecentActivity from "@/features/dashboard/RecentActivity";
import ScanActivityCard from "@/features/dashboard/ScanActivityCard";
import PostureSection from "@/features/dashboard/PostureSection";
import SampleDashboardNotice from "@/features/dashboard/SampleDashboardNotice";
import BackendStatusCard from "@/features/health/BackendStatusCard";

export const metadata = {
  title: "Overview",
};

function SectionHeading({ id, children, hint }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
        {children}
      </h2>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Scans and security posture for the applications you are authorized to test."
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

      <SampleDashboardNotice />

      {/* Live scan records; a labeled sample preview when the account has none. */}
      <section aria-labelledby="activity-heading" className="space-y-3">
        <SectionHeading id="activity-heading">Scans</SectionHeading>
        <ScanActivityCard />
      </section>

      {/* Real data once a scan has completed; labeled sample data until then. */}
      <section aria-labelledby="posture-heading" className="space-y-3">
        <SectionHeading id="posture-heading" hint="From OWASP ZAP baseline scans">
          Security posture
        </SectionHeading>
        <PostureSection />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <RecentActivity />
        <BackendStatusCard id="dashboard-system-status" />
      </div>
    </div>
  );
}
