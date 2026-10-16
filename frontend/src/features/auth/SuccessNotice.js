import { Alert, Spinner } from "@/components/ui/Feedback";

/** Shown after a successful sign-in or registration while redirecting. */
export default function SuccessNotice({ children }) {
  return (
    <Alert tone="success">
      <span className="flex items-center justify-between gap-3">
        {children}
        <Spinner className="size-4 shrink-0" />
      </span>
    </Alert>
  );
}
