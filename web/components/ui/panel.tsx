type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

/** A plain, quiet card: white surface, hairline border, soft shadow. No motif — the restraint is the point. */
export function Panel({ children, className = "" }: PanelProps) {
  return (
    <div className={`rounded-xl border border-border bg-surface p-8 shadow-sm sm:p-10 ${className}`}>
      {children}
    </div>
  );
}
