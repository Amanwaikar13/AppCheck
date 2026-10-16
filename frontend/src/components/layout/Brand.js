import Link from "next/link";
import Icon from "@/components/ui/Icon";

/**
 * AppCheck wordmark. `tone="dark"` is for navy surfaces (sidebar, auth
 * panel); `tone="light"` for white surfaces.
 */
export default function Brand({ tone = "dark", href = "/", subtitle = false }) {
  const dark = tone === "dark";
  return (
    <Link
      href={href}
      className={`flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 ${
        dark ? "text-white focus-visible:outline-brand-300" : "text-slate-900 focus-visible:outline-brand-600"
      }`}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-card">
        <Icon name="shield" className="size-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">AppCheck</span>
        {subtitle && (
          <span className={`block text-[11px] ${dark ? "text-navy-400" : "text-slate-500"}`}>
            Security &amp; code quality
          </span>
        )}
      </span>
    </Link>
  );
}
