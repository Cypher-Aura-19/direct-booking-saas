import { IconArrowRight, IconBuilding } from "@/components/ui/icons";
import { SubNav } from "@/components/ui/sub-nav";

const SETTINGS_LINKS = [
  { href: "/dashboard/settings", label: "Organisation" },
  { href: "/dashboard/settings/account", label: "Account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      {/* On mobile the tab bar has no Properties tab; "More" lands here. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plugin bug: see the same
          disable in properties/[id]/layout.tsx for why this literal internal href is flagged here
          but not for equivalent links elsewhere in this codebase. */}
      <a
        href="/dashboard/properties"
        className="flex min-h-16 items-center gap-4 rounded-card border border-hairline bg-surface px-4 shadow-[var(--shadow-sheet)] md:hidden"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-cloth/[0.07] text-cloth">
          <IconBuilding className="size-5" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-medium text-ink">Properties</span>
          <span className="text-sm text-muted">Photos, rates and knowledge base</span>
        </span>
        <IconArrowRight className="size-4 text-muted" />
      </a>
      <SubNav items={SETTINGS_LINKS} />
      {children}
    </div>
  );
}
