import { CONTROL_CLASSES, controlState } from "./FormField";
import Icon from "./Icon";

/** Native select with a visible label, styled like the other form controls. */
export default function Select({ id, label, value, options, onChange, className = "" }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${CONTROL_CLASSES} ${controlState()} h-9 appearance-none pr-8 pl-3`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  );
}
