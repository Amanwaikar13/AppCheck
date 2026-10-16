"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ErrorState, Spinner } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";

function FullScreen({ children }) {
  return <div className="grid min-h-screen place-items-center bg-canvas px-4">{children}</div>;
}

/**
 * Renders protected content only after the API has confirmed the session.
 * Signed-out visitors are sent to /login with a return path. This guards the
 * UI only; the API enforces authorization on every protected request.
 */
export default function AuthGate({ children }) {
  const { status, error, errorDetail, retry } = useAuth();
  const rateLimited = errorDetail?.code === "RATE_LIMITED";
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  if (status === "authenticated") return children;

  if (status === "error") {
    return (
      <FullScreen>
        <div className="w-full max-w-md">
          <ErrorState
            title={rateLimited ? "Temporarily rate limited" : "Could not verify your session"}
            action={
              <Button variant="secondary" size="sm" onClick={retry}>
                Try again
              </Button>
            }
          >
            {error}
          </ErrorState>
        </div>
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <div className="text-slate-500">
        <Spinner className="size-5" label={status === "unauthenticated" ? "Redirecting to sign in…" : "Checking your session…"} />
      </div>
    </FullScreen>
  );
}
