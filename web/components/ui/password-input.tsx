"use client";

import { useState, type InputHTMLAttributes } from "react";
import { INPUT_CLASSES } from "./input";

// A password field with a Show/Hide toggle. The toggle's name comes from
// its visible text only — an aria-label mentioning "password" would make
// getByLabelText(/password/i) ambiguous for the field itself.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative flex">
      <input {...props} type={visible ? "text" : "password"} className={`${INPUT_CLASSES} pe-20`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        className="absolute inset-y-1.5 end-1.5 rounded-lg px-3 text-[13px] font-medium text-muted transition hover:bg-surface-muted hover:text-ink"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
