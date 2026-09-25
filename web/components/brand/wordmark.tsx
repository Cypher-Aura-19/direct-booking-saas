import { PRODUCT_NAME } from "@/lib/brand";

/*
  The seal: a double-ringed register stamp around the Urdu letter qaf (ق),
  the first letter of قیام. Drawn as SVG so the Nastaliq glyph can't
  disturb line-height the way live Urdu text would.
*/
export function Seal({ className = "size-8", tone = "accent" }: { className?: string; tone?: "accent" | "light" }) {
  const ring = tone === "light" ? "var(--cloth-ink)" : "var(--accent)";
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18.5" fill={ring} />
      <circle cx="20" cy="20" r="15.25" fill="none" stroke={tone === "light" ? "var(--cloth)" : "#fff"} strokeOpacity="0.55" strokeWidth="1" />
      <text
        x="20"
        y="17"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontFamily: "var(--font-noto-nastaliq), serif" }}
        fontWeight="700"
        fontSize="17"
        fill={tone === "light" ? "var(--cloth)" : "#fff"}
      >
        ق
      </text>
    </svg>
  );
}

export function Wordmark({ tone = "ink", className = "" }: { tone?: "ink" | "light"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Seal tone={tone === "light" ? "light" : "accent"} />
      <span
        className={`text-[19px] font-semibold tracking-[-0.02em] ${tone === "light" ? "text-cloth-ink" : "text-ink"}`}
      >
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
