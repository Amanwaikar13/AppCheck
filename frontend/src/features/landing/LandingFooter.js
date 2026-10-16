import Link from "next/link";
import Brand from "@/components/layout/Brand";
import { LANDING_SECTIONS } from "./landingLinks";

const LINK = "rounded text-sm text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600";

const GROUPS = [
  { title: "Product", links: LANDING_SECTIONS.map(({ href, label }) => ({ href, label, anchor: true })) },
  {
    title: "Account",
    links: [
      { href: "/register", label: "Create account" },
      { href: "/login", label: "Sign in" },
      { href: "/dashboard", label: "Dashboard" },
    ],
  },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-sm">
          <Brand tone="light" />
          <p className="mt-4 text-sm leading-6 text-slate-600">
            AppCheck is a web application security and code quality analyzer for teams that test the
            applications and code they own.
          </p>
        </div>
        {GROUPS.map(({ title, links }) => (
          <nav key={title} aria-label={`${title} links`}>
            <h2 className="text-[13px] font-semibold text-navy-950">{title}</h2>
            <ul className="mt-3 space-y-2.5">
              {links.map(({ href, label, anchor }) => (
                <li key={href}>
                  {anchor ? (
                    <a href={href} className={LINK}>
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className={LINK}>
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-slate-100">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          Scan only applications and code you own or are explicitly authorized to test.
        </p>
      </div>
    </footer>
  );
}
