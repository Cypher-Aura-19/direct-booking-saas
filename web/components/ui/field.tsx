import type { ReactNode } from "react";

// Label above, control, then a hint line. The label wraps the control so
// getByLabelText and screen readers resolve it without ids.
export function Field({
  label,
  hint,
  status,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="flex items-baseline justify-between gap-3 text-sm font-medium text-ink">
        {label}
        {status}
      </span>
      {children}
      {hint && <span className="text-[13px] leading-5 text-muted">{hint}</span>}
    </label>
  );
}
