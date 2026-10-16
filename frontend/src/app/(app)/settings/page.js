import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import PlannedChecks from "@/features/scans/PlannedChecks";
import AccountCard from "@/features/settings/AccountCard";
import BackendStatusCard from "@/features/health/BackendStatusCard";

export const metadata = { title: "Settings" };

const PLANNED = [
  { title: "Profile and password", body: "Update your name, email, and password." },
  { title: "Authorized targets", body: "Register the domains and repositories you are permitted to scan." },
  { title: "Scan defaults", body: "Choose default scan depth, timeouts, and which checks run." },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account, display conventions, and the health of AppCheck services." />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AccountCard />
          <BackendStatusCard />
        </div>
        <div className="space-y-6">
          <Card id="display" title="Display" description="Fixed conventions; not configurable yet.">
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Time zone</dt>
                <dd className="font-medium text-slate-900">UTC</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Time format</dt>
                <dd className="font-medium text-slate-900">24-hour</dd>
              </div>
            </dl>
          </Card>
          <PlannedChecks title="Coming later" icon="settings" items={PLANNED} />
        </div>
      </div>
    </div>
  );
}
