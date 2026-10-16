"use client";

import { useEffect, useRef, useState } from "react";
import Brand from "@/components/layout/Brand";
import PublicNav from "@/components/layout/PublicNav";
import Button, { ButtonLink } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/hooks/useAuth";
import { LANDING_SECTIONS } from "./landingLinks";

const LINK =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600";

/** Sticky public header: section links, real session state, and a mobile menu. */
export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const toggleRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector("a")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Brand tone="light" />

        <nav aria-label="Homepage sections" className="hidden flex-1 items-center gap-1 md:flex">
          {LANDING_SECTIONS.map(({ href, label }) => (
            <a key={href} href={href} className={LINK}>
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden md:block">
          <PublicNav />
        </div>

        <Button
          ref={toggleRef}
          variant="ghost"
          size="icon"
          className="-mr-2 ml-auto md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="landing-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? "close" : "menu"} />
        </Button>
      </div>

      {open && (
        <div id="landing-menu" ref={panelRef} className="border-t border-slate-200 bg-white md:hidden">
          <nav aria-label="Homepage sections" className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {LANDING_SECTIONS.map(({ href, label }) => (
              <a key={href} href={href} onClick={close} className={`${LINK} py-2.5`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-slate-100 px-4 py-4">
            {isAuthenticated ? (
              <ButtonLink href="/dashboard" onClick={close}>
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/register" onClick={close}>
                  Create account
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" onClick={close}>
                  Sign in
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
