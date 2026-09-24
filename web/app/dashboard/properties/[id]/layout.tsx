import { notFound } from "next/navigation";
import { dashboardContext } from "../../_lib/context";
import { getProperty } from "@/lib/properties/basics";

export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const property = await getProperty(supabase, id);
  if (!property) notFound();

  const tabs = [
    { href: `/dashboard/properties/${id}`, label: "Basics" },
    { href: `/dashboard/properties/${id}/photos`, label: "Photos" },
    { href: `/dashboard/properties/${id}/knowledge`, label: "Knowledge base" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plugin bug: getUrlFromAppDirectory
            recurses into subdirectories via the pages-router parser, so this exact literal href is flagged
            here (two levels under app/) but not for the identical link in DashboardNav one level up; kept as
            <a> to match every other internal link in this codebase (see AGENTS.md / brief step 5). */}
        <a
          href="/dashboard/properties"
          className="inline-flex min-h-11 items-center text-sm text-muted hover:text-ink"
        >
          Properties
        </a>
        <h1 className="text-2xl font-medium tracking-tight">{property.name}</h1>
      </div>
      <nav className="flex gap-2 border-b border-hairline">
        {tabs.map((tab) => (
          <a key={tab.href} href={tab.href} className="flex min-h-11 items-center px-3 text-sm text-ink hover:bg-surface-muted">
            {tab.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
