import Link from "next/link";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

// Each variant owns its colors, including the focus ring, so callers never
// need to override colors with className (which Tailwind cannot order reliably).
const ON_LIGHT_FOCUS = "focus-visible:outline-brand-600";
const VARIANTS = {
  primary: `bg-brand-600 text-white shadow-card hover:bg-brand-700 ${ON_LIGHT_FOCUS}`,
  secondary: `border border-slate-300 bg-white text-slate-700 shadow-card hover:bg-slate-50 hover:text-slate-900 ${ON_LIGHT_FOCUS}`,
  ghost: `text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${ON_LIGHT_FOCUS}`,
  danger: `border border-red-200 bg-white text-red-700 shadow-card hover:bg-red-50 ${ON_LIGHT_FOCUS}`,
  // For navy surfaces.
  inverse: "bg-white text-navy-950 shadow-card hover:bg-navy-200 focus-visible:outline-white",
  "inverse-outline": "border border-white/25 text-white hover:bg-white/10 focus-visible:outline-white",
};

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  icon: "size-9",
  "icon-sm": "size-8",
};

export function buttonClasses({ variant = "primary", size = "md", className = "" } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

/** The only button style in the app. Icon-only buttons must pass aria-label. */
export default function Button({ variant, size, className, type = "button", ...props }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

/** A Next.js link styled as a button, for navigation actions. */
export function ButtonLink({ variant, size, className, ...props }) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
