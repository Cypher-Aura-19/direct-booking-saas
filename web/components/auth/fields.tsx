import type { ComponentProps } from "react";

const CONTROL_CLASS =
  "w-full rounded-xl border-0 bg-[#F1F1F4] px-4 py-3 text-sm text-[#111114] placeholder:text-[#9AA0AC] transition-shadow focus:outline-none focus:ring-2 focus:ring-[#2547c9]";

export function AuthField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#111114]">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[#9AA0AC]">{hint}</p>}
    </div>
  );
}

export function AuthInput(props: ComponentProps<"input">) {
  return <input className={CONTROL_CLASS} {...props} />;
}
