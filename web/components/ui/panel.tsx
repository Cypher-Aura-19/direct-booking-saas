type PanelProps = {
  children: React.ReactNode;
  accent?: "lake" | "lantern";
  className?: string;
};

const ACCENT_CLASS: Record<NonNullable<PanelProps["accent"]>, string> = {
  lake: "bg-primary",
  lantern: "bg-accent",
};

/**
 * The app's signature surface: a card with a colored "ledger spine" on its
 * left edge, echoing a guesthouse guestbook. The spine color carries
 * meaning — lake for a normal panel, lantern for one that needs attention.
 */
export function Panel({ children, accent = "lake", className = "" }: PanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-surface shadow-sm shadow-pine/5 ${className}`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${ACCENT_CLASS[accent]}`} aria-hidden />
      <div className="p-8 pl-9 sm:p-10 sm:pl-11">{children}</div>
    </div>
  );
}
