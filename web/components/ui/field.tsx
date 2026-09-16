import type { ComponentProps } from "react";

const CONTROL_CLASS =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-lake focus:outline-none";

type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
};

/** A labeled form field wrapper — label, control, and an optional hint line, consistently spaced. */
export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input className={CONTROL_CLASS} {...props} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea className={`${CONTROL_CLASS} min-h-24 resize-y`} {...props} />;
}
