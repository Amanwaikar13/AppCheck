import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import PlannedChecks from "@/features/scans/PlannedChecks";
import ScannerStatusNotice from "@/features/scans/ScannerStatusNotice";
import UrlScanForm from "@/features/scans/UrlScanForm";

export const metadata = { title: "URL Scan" };

// What OWASP ZAP's passive baseline rules look for in the responses it sees.
const BASELINE_CHECKS = [
  {
    title: "Security headers",
    body: "Missing or weak Content-Security-Policy, anti-clickjacking, X-Content-Type-Options, and HSTS headers.",
  },
  {
    title: "Cookie configuration",
    body: "Cookies set without the Secure, HttpOnly, or SameSite attributes.",
  },
  {
    title: "Information disclosure",
    body: "Server version banners, debug error messages, private IPs, and timestamps exposed in responses.",
  },
];

export default function UrlScanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="URL Scan"
        description="Run a passive OWASP ZAP baseline scan against a web application you are authorized to test."
      />

      <ScannerStatusNotice />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card
          id="new-url-scan"
          className="lg:col-span-2"
          title="New URL scan"
          description="Only submit applications you own or have explicit written permission to test."
        >
          <UrlScanForm />
        </Card>
        <PlannedChecks
          title="What the baseline scan checks"
          badge="Passive"
          icon="globe"
          items={BASELINE_CHECKS}
          footer="Only the submitted host is contacted; links and redirects to other hosts are not followed. Active attack testing and TLS analysis are not part of this scan."
        />
      </div>
    </div>
  );
}
