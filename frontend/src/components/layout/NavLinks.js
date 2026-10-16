"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { NAV_GROUPS, isActivePath } from "@/lib/navigation";

/** Grouped primary navigation, shared by the desktop sidebar and the mobile drawer. */
export default function NavLinks({ onNavigate }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wider text-navy-400 uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-300 ${
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-navy-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-400" />
                    )}
                    <Icon name={icon} className={`size-[18px] shrink-0 ${active ? "text-brand-300" : "text-navy-400"}`} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
