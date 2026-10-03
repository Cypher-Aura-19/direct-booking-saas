"use client";

import { useState } from "react";

// The host retypes these into the government portal by hand (parent spec), so
// each value gets its own copy button.
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // clipboard blocked: the value is still visible to select
    }
  }

  return (
    <div className="copy-field">
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}>{copied ? "Copied" : "Copy"}</button>
      </dd>
    </div>
  );
}
