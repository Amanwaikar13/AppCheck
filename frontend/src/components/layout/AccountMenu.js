"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useSignOut } from "@/hooks/useSignOut";

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

const ITEM =
  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 disabled:opacity-60";

/**
 * Reflects the real session: sign-in links when signed out, the signed-in
 * user with settings and sign-out when signed in, nothing while unknown.
 */
export default function AccountMenu() {
  const { user, status } = useAuth();
  const { signOut: requestSignOut, signingOut, error } = useSignOut();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/login" variant="ghost" size="sm">
          Sign in
        </ButtonLink>
        <ButtonLink href="/register" size="sm">
          Create account
        </ButtonLink>
      </div>
    );
  }

  if (!user) return null;

  const signOut = async () => {
    if (await requestSignOut()) setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account menu for ${user.name}`}
        className="flex items-center gap-2 rounded-md p-1 text-left hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full bg-navy-800 text-[11px] font-semibold text-white"
        >
          {initials(user.name) || <Icon name="user" className="size-4" />}
        </span>
        <span className="hidden max-w-36 truncate text-sm font-medium text-slate-800 md:block">{user.name}</span>
        <Icon name="chevronDown" className="hidden size-4 text-slate-400 md:block" />
      </button>

      {open && (
        <div
          id="account-menu"
          className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-1 shadow-popover"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1.5 text-[11px] font-medium tracking-wide text-slate-500 uppercase">Role: {user.role}</p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link href="/settings#account" onClick={() => setOpen(false)} className={ITEM}>
            <Icon name="settings" className="size-4 text-slate-400" />
            Account settings
          </Link>
          {error && (
            <p role="alert" className="px-2.5 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <button type="button" onClick={signOut} disabled={signingOut} className={ITEM}>
            {signingOut ? (
              <Spinner label="Signing out…" />
            ) : (
              <>
                <Icon name="logout" className="size-4 text-slate-400" />
                Sign out
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
