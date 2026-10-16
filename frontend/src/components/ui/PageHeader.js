/**
 * Title row at the top of every app page: the page h1, a one-line
 * description, optional badges beside the title, and page-level actions.
 * Breadcrumbs live in the app header (components/layout/Header.js).
 */
export default function PageHeader({ title, description, meta, actions }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
