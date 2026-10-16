/**
 * Surface for a page section. `meta` sits beside the title (e.g. a badge),
 * `action` on the right. `flush` removes body padding for edge-to-edge tables.
 */
export default function Card({
  title,
  description,
  meta,
  action,
  flush = false,
  id,
  className = "",
  children,
}) {
  const hasHeader = title || action;
  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={`rounded-card border border-slate-200 bg-white shadow-card ${flush ? "" : "p-5"} ${className}`}
    >
      {hasHeader && (
        <header
          className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${flush ? "px-5 pt-4 pb-3.5" : "mb-4"}`}
        >
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex flex-wrap items-center gap-2">
              {title && (
                <h2 id={id ? `${id}-title` : undefined} className="text-sm font-semibold text-slate-900">
                  {title}
                </h2>
              )}
              {meta}
            </div>
            {description && <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
