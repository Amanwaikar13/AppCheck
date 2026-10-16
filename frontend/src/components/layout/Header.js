"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import BackendStatusIndicator from "@/features/health/BackendStatusIndicator";
import { getBreadcrumbs } from "@/lib/navigation";
import AccountMenu from "./AccountMenu";
import MobileNav from "./MobileNav";

function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden shrink-0 text-slate-500 sm:block">AppCheck</li>
        {items.map((item, index) => (
          <li key={item.label} className="flex min-w-0 items-center gap-1.5">
            <Icon
              name="chevronRight"
              className={`size-3.5 shrink-0 text-slate-400 ${index === 0 ? "hidden sm:block" : ""}`}
            />
            {item.href ? (
              <Link
                href={item.href}
                className="truncate rounded text-slate-500 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-slate-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function Header() {
  const crumbs = getBreadcrumbs(usePathname());

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav />
        <Breadcrumbs items={crumbs} />
        <BackendStatusIndicator />
        <span aria-hidden="true" className="hidden h-5 w-px bg-slate-200 sm:block" />
        <AccountMenu />
      </div>
    </header>
  );
}
