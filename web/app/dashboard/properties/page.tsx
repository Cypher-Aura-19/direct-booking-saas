import { dashboardContext } from "../_lib/context";
import { listProperties } from "@/lib/properties/basics";
import { PropertyList } from "./property-list";

export default async function PropertiesPage() {
  const { supabase, organization } = await dashboardContext();
  const properties = await listProperties(supabase, organization.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">Properties</h1>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plugin bug: see the same
            disable in properties/[id]/layout.tsx for why this literal internal href is flagged here
            but not for equivalent links elsewhere in this codebase. */}
        <a
          href="/dashboard/properties/new"
          className="inline-flex min-h-11 items-center rounded-pill bg-accent px-6 text-sm font-medium text-accent-contrast hover:opacity-90"
        >
          Add property
        </a>
      </div>
      <PropertyList organizationSlug={organization.slug} properties={properties} />
    </div>
  );
}
