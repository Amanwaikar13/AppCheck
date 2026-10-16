import { FieldMessage, describedBy } from "./FormField";

/** Checkbox with its label to the right. Pass React Hook Form register() via `inputProps`. */
export default function Checkbox({ id, label, error, hint, inputProps }) {
  return (
    <div>
      <div className="flex gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy(id, { error, hint })}
          className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          {...inputProps}
        />
        <label htmlFor={id} className="text-sm leading-5 text-slate-700">
          {label}
        </label>
      </div>
      <div className="pl-7">
        <FieldMessage id={id} error={error} hint={hint} />
      </div>
    </div>
  );
}
