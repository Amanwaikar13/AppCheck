import { Alert } from "@/components/ui/Feedback";

/** Source code scans are recorded but not executed yet; this says so up front. */
export default function ExecutionNotice({ children }) {
  return (
    <Alert tone="warning" title="Source code analysis is not available yet">
      {children ??
        "Source scan requests are recorded but not executed. They stay queued and have no score, findings, or report."}
    </Alert>
  );
}
