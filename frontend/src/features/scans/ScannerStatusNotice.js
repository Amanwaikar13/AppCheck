"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert, Skeleton } from "@/components/ui/Feedback";
import { fetchScannerStatus, selectScannerStatus } from "./scansSlice";

/**
 * Tells the user whether URL scans will actually run, from GET /scanner/status.
 * It never implies a scan will run when the server has no scanner.
 */
export default function ScannerStatusNotice({ onlyWhenUnavailable = false }) {
  const dispatch = useDispatch();
  const { status, data, error } = useSelector(selectScannerStatus);

  useEffect(() => {
    dispatch(fetchScannerStatus());
  }, [dispatch]);

  if (status === "failed") {
    return (
      <Alert tone="warning" title="Scanner status unknown">
        {error?.message ?? "Could not check whether the URL scanner is available."}
      </Alert>
    );
  }
  if (!data) return onlyWhenUnavailable ? null : <Skeleton className="h-16 rounded-lg" />;

  const { url } = data;
  if (url.available) {
    if (onlyWhenUnavailable) return null;
    return (
      <Alert tone="info" title="OWASP ZAP baseline scanner is available">
        Scans run in the background with passive checks only: ZAP crawls the target for up to two
        minutes and reports issues in the responses it sees. No attacks are sent. A scan usually
        finishes within 15 minutes; its status updates on the scan page.
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title="The URL scanner is not available right now">
      {url.reason}. You can still record a scan request; it stays queued and runs automatically once
      the scanner is available. Nothing will be reported as scanned until it actually runs.
    </Alert>
  );
}
