import { IconArrowLeft } from "./icons";

export function PageHeader({
  title,
  description,
  back,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4">
      {back && (
        <a
          href={back.href}
          className="-ms-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-1 text-sm text-muted transition hover:text-ink"
        >
          <IconArrowLeft />
          {back.label}
        </a>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[2rem]">
              {title}
            </h1>
            {meta}
          </div>
          {description && <p className="max-w-[62ch] text-[15px] leading-6 text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

// A white register sheet: the one container for grouped content.
export function Sheet({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={`rounded-card border border-hairline bg-surface shadow-[var(--shadow-sheet)] ${className}`}>
      {children}
    </Tag>
  );
}

export function SheetHeader({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline px-5 py-4 sm:px-6">
      <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">{title}</h2>
      {description && <p className="text-sm leading-5 text-muted">{description}</p>}
    </div>
  );
}
