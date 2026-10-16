"use client";

import Button from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/Feedback";

export default function AppError({ retry }) {
  return (
    <ErrorState
      title="This page failed to load"
      action={
        <Button variant="secondary" size="sm" onClick={() => retry()}>
          Try again
        </Button>
      }
    >
      An unexpected error occurred while rendering this page. The rest of AppCheck is still available
      from the navigation.
    </ErrorState>
  );
}
