import type { ComponentProps } from "react";

export function AuthButton(props: ComponentProps<"button">) {
  return (
    <button
      className="w-full rounded-xl bg-[#2547c9] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1e3aa8] disabled:opacity-50"
      {...props}
    />
  );
}
