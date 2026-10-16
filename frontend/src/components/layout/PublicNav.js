"use client";

import { ButtonLink } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import AccountMenu from "./AccountMenu";

/** Top-right of public pages: dashboard link and account menu, or sign-in links. */
export default function PublicNav() {
  const { isAuthenticated } = useAuth();
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      {isAuthenticated && (
        <ButtonLink href="/dashboard" variant="secondary" size="sm">
          Open dashboard
        </ButtonLink>
      )}
      <AccountMenu />
    </nav>
  );
}
