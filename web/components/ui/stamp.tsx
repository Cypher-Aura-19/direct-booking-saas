export type StampTone = "violet" | "green" | "red" | "amber" | "grey";

const TONES: Record<StampTone, string> = {
  violet: "text-accent",
  green: "text-success",
  red: "text-destructive",
  amber: "text-warning",
  grey: "text-muted",
};

// Compact semantic badges shared across the workspace.
export function Stamp({
  tone = "violet",
  pressed = false,
  className = "",
  children,
}: {
  tone?: StampTone;
  tilt?: number;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-current/15 bg-current/5 px-2.5 py-1 text-[11px] font-medium leading-none ${TONES[tone]} ${pressed ? "animate-rise" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
