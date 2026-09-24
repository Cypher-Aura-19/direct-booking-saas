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
        className="flex min-h-11 items-center justify-between rounded-card border border-hairline px-4 text-sm md:hidden"
      >
        Properties
        <span aria-hidden className="rtl:-scale-x-100">→</span>
      </a>
      <nav className="flex gap-2 border-b border-hairline">
        {SETTINGS_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="flex min-h-11 items-center px-3 text-sm text-ink hover:bg-surface-muted">
            {link.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
