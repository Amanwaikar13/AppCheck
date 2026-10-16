"use client";

import { useSelector } from "react-redux";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import SampleDataBadge from "@/components/ui/SampleDataBadge";
import { selectRecentScans } from "@/features/scans/scansSlice";

/** Shown only while the account has no scan records and the dashboard displays sample data. */
export default function SampleDashboardNotice() {
  const { counts } = useSelector(selectRecentScans);
  if (counts?.total !== 0) return null;
  return (
    <Alert
      tone="info"
      title="You are viewing a sample dashboard"
      action={
        <ButtonLink href="/url-scan" size="sm">
          Run your first URL scan
        </ButtonLink>
      }
    >
      Your account has no scans yet, so every section below shows illustrative data marked{" "}
      <SampleDataBadge />. None of it comes from your account or a real scan. Your own results replace it
      after your first scan.
    </Alert>
  );
}
