"use client";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Alert, Spinner } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useSignOut } from "@/hooks/useSignOut";
import { formatDateTime } from "@/lib/format";

function Row({ label, children }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className="min-w-0 text-[13px] break-words text-slate-900 sm:col-span-2">{children}</dd>
    </div>
  );
}

/** The signed-in profile as returned by GET /auth/me, read-only, plus sign-out. */
export default function AccountCard() {
  const { user } = useAuth();
  const { signOut, signingOut, error } = useSignOut();
  if (!user) return null;

  return (
    <Card
      id="account"
      className="scroll-mt-24"
      title="Account"
      description="Your profile. Editing profile details is not available yet."
    >
      <dl className="-my-3 divide-y divide-slate-100">
        <Row label="Name">{user.name}</Row>
        <Row label="Email">{user.email}</Row>
        <Row label="Role">
          <Badge tone={user.role === "admin" ? "brand" : "neutral"} className="capitalize">
            {user.role}
          </Badge>
        </Row>
        <Row label="Member since">{formatDateTime(user.createdAt)}</Row>
        <Row label="Last sign-in">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Not recorded"}</Row>
      </dl>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Signing out ends every session for this account, on all devices.
        </p>
        <Button variant="danger" size="sm" onClick={signOut} disabled={signingOut} className="self-start sm:self-auto">
          {signingOut ? (
            <Spinner label="Signing out…" />
          ) : (
            <>
              <Icon name="logout" className="size-3.5" />
              Sign out everywhere
            </>
          )}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}
    </Card>
  );
}
