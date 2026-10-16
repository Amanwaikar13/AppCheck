// Shared loading, empty, error, and notice states.
import Icon from "./Icon";

export function Spinner({ className = "size-4", label }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

/** Centered placeholder for "nothing here yet"; always explains why and what to do. */
export function EmptyState({ icon = "info", title, children, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <span className="grid size-10 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
        <Icon name={icon} className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm leading-6 text-slate-500">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const ALERT_TONES = {
  info: { box: "border-sky-200 bg-sky-50", icon: "info", iconColor: "text-sky-600", title: "text-sky-900", body: "text-sky-800" },
  warning: { box: "border-amber-200 bg-amber-50", icon: "info", iconColor: "text-amber-600", title: "text-amber-900", body: "text-amber-800" },
  success: { box: "border-emerald-200 bg-emerald-50", icon: "checkCircle", iconColor: "text-emerald-600", title: "text-emerald-900", body: "text-emerald-800" },
  danger: { box: "border-red-200 bg-red-50", icon: "alert", iconColor: "text-red-600", title: "text-red-800", body: "text-red-700" },
};

/**
 * Inline notice. Danger alerts are announced (role="alert"); success uses
 * role="status"; info and warning are notes that do not interrupt.
 */
export function Alert({ tone = "info", title, children, action, className = "" }) {
  const style = ALERT_TONES[tone];
  const role = tone === "danger" ? "alert" : tone === "success" ? "status" : "note";
  return (
    <div role={role} className={`flex gap-3 rounded-lg border px-4 py-3 ${style.box} ${className}`}>
      <Icon name={style.icon} className={`mt-0.5 size-[18px] shrink-0 ${style.iconColor}`} />
      <div className="min-w-0 flex-1 text-sm leading-6">
        {title && <p className={`font-semibold ${style.title}`}>{title}</p>}
        {children && <div className={style.body}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

/** A failed request or render, with an optional retry action. */
export function ErrorState({ title = "Something went wrong", children, action }) {
  return (
    <Alert tone="danger" title={title} action={action}>
      {children}
    </Alert>
  );
}
