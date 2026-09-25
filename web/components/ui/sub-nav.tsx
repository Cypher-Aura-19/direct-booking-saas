"use client";

import { usePathname } from "next/navigation";

// Secondary navigation inside a section (property tabs, settings tabs).
export function SubNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Section" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-pill border border-hairline bg-surface p-1 shadow-[0_1px_2px_rgb(20_24_36/0.04)]">
        {items.map((item) => {
          const active = item.href === pathname;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center whitespace-nowrap rounded-pill px-4 text-sm transition ${
                active ? "bg-ink font-medium text-white" : "text-muted hover:bg-surface-muted hover:text-ink"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
