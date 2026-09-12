import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  legend,
  hint,
  value,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  value: T | "unknown" | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? "border-accent-strong bg-accent-strong text-white"
                  : "border-border bg-white text-foreground hover:bg-surface-elevated"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MultiChoiceGroup<T extends string>({
  legend,
  hint,
  values,
  options,
  onChange,
}: {
  legend: string;
  hint?: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange: (values: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (selected) {
                  onChange(values.filter((value) => value !== option.value));
                } else {
                  onChange([...values, option.value]);
                }
              }}
              className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                selected
                  ? "border-accent-strong bg-accent-strong text-white"
                  : "border-border bg-white text-foreground hover:bg-surface-elevated"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TriState({
  legend,
  hint,
  value,
  onChange,
}: {
  legend: string;
  hint?: string;
  value: boolean | "unknown";
  onChange: (value: boolean | "unknown") => void;
}) {
  return (
    <ChoiceGroup
      legend={legend}
      hint={hint}
      value={value === "unknown" ? "unknown" : value ? "yes" : "no"}
      options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "unknown", label: "Not sure" },
      ]}
      onChange={(next) => {
        if (next === "yes") onChange(true);
        else if (next === "no") onChange(false);
        else onChange("unknown");
      }}
    />
  );
}
