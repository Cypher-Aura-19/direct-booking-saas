type BadgeTone = "draft" | "published";

const TONE_CLASS: Record<BadgeTone, string> = {
  draft: "bg-lantern/15 text-lantern-ink",
  published: "bg-lake/12 text-primary",
};

const TONE_LABEL: Record<BadgeTone, string> = {
  draft: "Draft",
  published: "Published",
};

export function StatusBadge({ status }: { status: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${TONE_CLASS[status]}`}
    >
      {TONE_LABEL[status]}
    </span>
  );
}
