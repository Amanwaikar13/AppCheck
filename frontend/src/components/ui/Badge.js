/*
 * Small labels. Every status pill in the app is a Badge so they share size,
 * weight, and color rules:
 *   tone:    neutral | brand | success | warning | danger | info
 *   variant: soft (tinted, default) | outline | dashed
 *   dot:     leading status dot
 */
const SOFT = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/15",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
};

const OUTLINE = {
  neutral: "border-slate-300 text-slate-600",
  brand: "border-brand-300 text-brand-700",
  success: "border-emerald-300 text-emerald-700",
  warning: "border-amber-400 bg-amber-50/60 text-amber-800",
  danger: "border-red-300 text-red-700",
  info: "border-sky-300 text-sky-700",
};

const DOTS = {
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-sky-500",
};

export default function Badge({ tone = "neutral", variant = "soft", dot = false, pulse = false, title, className = "", children }) {
  const style =
    variant === "soft"
      ? `ring-1 ring-inset ${SOFT[tone]}`
      : `border ${variant === "dashed" ? "border-dashed" : ""} ${OUTLINE[tone]}`;
  return (
    <span
      title={title}
      className={`inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap ${style} ${className}`}
    >
      {dot && (
        <span aria-hidden="true" className={`size-1.5 rounded-full ${DOTS[tone]} ${pulse ? "animate-pulse" : ""}`} />
      )}
      {children}
    </span>
  );
}
