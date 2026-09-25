import { dashboardContext } from "../_lib/context";
import { listProperties } from "@/lib/properties/basics";
import { buttonClasses } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { PropertyList } from "./property-list";

export default async function PropertiesPage() {
  const { supabase, organization } = await dashboardContext();
  const properties = await listProperties(supabase, organization.id);
  const published = properties.filter((p) => p.published).length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Properties"
        description={
          properties.length === 0
            ? "Every place you rent out, each with its own public page."
            : `${properties.length} in your register · ${published} published`
        }
        actions={
          properties.length > 0 && (
            /* eslint-disable-next-line @next/next/no-html-link-for-pages -- plugin bug: see the same
               disable in properties/[id]/layout.tsx for why this literal internal href is flagged here
               but not for equivalent links elsewhere in this codebase. */
            <a href="/dashboard/properties/new" className={buttonClasses("primary")}>
              <IconPlus className="size-4" />
              Add property
            </a>
          )
        }
      />
      <dl className="property-summary-strip"><div><dt>Total properties</dt><dd>{properties.length}</dd></div><div><dt>Published</dt><dd>{published}</dd></div><div><dt>Drafts</dt><dd>{properties.length - published}</dd></div></dl>
      <PropertyList organizationSlug={organization.slug} properties={properties} />
    </div>
  );
}
