"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Sidebar from "./Sidebar";

/** Menu button plus slide-in navigation drawer, shown below the lg breakpoint. */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  // Portalled to <body>: the header's backdrop-blur would otherwise become the
  // containing block for this fixed overlay and clip it to the header's height.
  const drawer = (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-navy-950/60"
        onClick={() => setOpen(false)}
      />
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl"
      >
        <Sidebar onNavigate={() => setOpen(false)} />
        <button
          ref={closeRef}
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="absolute top-4 right-3 grid size-8 place-items-center rounded-md text-navy-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-brand-300"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="-ml-2 shrink-0 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" />
      </Button>

      {open && createPortal(drawer, document.body)}
    </>
  );
}
