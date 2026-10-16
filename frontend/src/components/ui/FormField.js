export const CONTROL_CLASSES =
  "block w-full rounded-md border bg-white text-sm text-slate-900 shadow-card placeholder:text-slate-500 focus:outline-2 focus:outline-offset-[-1px] disabled:bg-slate-50 disabled:text-slate-500";

export function controlState(error) {
  return error ? "border-red-400 focus:outline-red-600" : "border-slate-300 focus:outline-brand-600";
}

/** Hint or error text below a control, wired up via aria-describedby. */
export function FieldMessage({ id, error, hint }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-700">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-slate-500">
        {hint}
      </p>
    );
  }
  return null;
}

export function describedBy(id, { error, hint }) {
  return [hint && !error && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

/**
 * Labeled input with hint and error text wired up for assistive tech.
 * Pass React Hook Form register() result via `inputProps`.
 */
export default function FormField({ id, label, error, hint, trailing, inputProps, ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy(id, { error, hint })}
          className={`${CONTROL_CLASSES} h-9 px-3 ${controlState(error)} ${trailing ? "pr-16" : ""}`}
          {...rest}
          {...inputProps}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</div>}
      </div>
      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  );
}
