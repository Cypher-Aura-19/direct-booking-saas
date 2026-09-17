type BadgeTone = "draft" | "published";

const DOT_CLASS: Record<BadgeTone, string> = {
  draft: "bg-muted-foreground/50",
  published: "bg-primary",
};

const LABEL: Record<BadgeTone, string> = {
  draft: "Draft",
  published: "Published",
};

/** A quiet status indicator — a dot, not a tinted pill fighting for attention against other color. */
export function StatusBadge({ status }: { status: BadgeTone }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[status]}`} aria-hidden />
      {LABEL[status]}
    </span>
  );
}
