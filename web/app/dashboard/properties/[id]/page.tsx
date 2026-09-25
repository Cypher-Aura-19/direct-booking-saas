import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconArrowUpRight, IconEye } from "@/components/ui/icons";
import { Sheet, SheetHeader } from "@/components/ui/page-header";
import { dashboardContext } from "../../_lib/context";
import { getProperty, publicPropertyPath } from "@/lib/properties/basics";
import { getListing } from "@/lib/properties/listing";
import { BasicsForm } from "../basics-form";
import { ListingForm } from "../listing-form";
import { setPublishedAction, updateListingAction, updatePropertyAction } from "../actions";

export default async function PropertyBasicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organization } = await dashboardContext();
  const property = await getProperty(supabase, id);
  if (!property) notFound();
  const publicPath = publicPropertyPath(organization.slug, property.slug);
  const listing = (await getListing(supabase, id)) ?? { description: "", amenities: [] };

  return (
    <div className="flex flex-col gap-6">
      <Sheet
        className={`flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${
          property.published ? "" : "bg-[linear-gradient(to_right,var(--accent-soft),var(--surface)_70%)]"
        }`}
      >
        <div className="flex items-start gap-4">
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-xl ${
              property.published ? "bg-success/10 text-success" : "bg-surface text-accent shadow-[var(--shadow-sheet)]"
            }`}
          >
            <IconEye className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-base font-semibold text-ink">Visibility</h2>
            {property.published ? (
              <p className="text-sm leading-6 text-muted">
                Published. Guests can see it at{" "}
                <a
                  className="inline-flex items-center gap-0.5 break-all font-mono text-[13px] text-accent underline-offset-4 hover:underline"
                  href={publicPath}
                >
                  {publicPath}
                  <IconArrowUpRight className="size-3.5" />
                </a>
              </p>
            ) : (
              <p className="text-sm leading-6 text-muted">Draft. Only you can see this property.</p>
            )}
          </div>
        </div>
        <form action={setPublishedAction.bind(null, id, !property.published)} className="shrink-0">
          <Button type="submit" variant={property.published ? "secondary" : "primary"} className="w-full sm:w-auto">
            {property.published ? "Unpublish" : "Publish"}
          </Button>
        </form>
      </Sheet>

      <Sheet>
        <SheetHeader title="Basics" description="What guests see first: the name, the kind of place, the rate and the size." />
        <div className="p-5 sm:p-6">
          <BasicsForm action={updatePropertyAction.bind(null, id)} property={property} submitLabel="Save changes" />
        </div>
      </Sheet>

      <Sheet>
        <SheetHeader title="Guest-facing details" description="Shown on your public page." />
        <div className="p-5 sm:p-6">
          <ListingForm action={updateListingAction.bind(null, id)} listing={listing} />
        </div>
      </Sheet>
    </div>
  );
}
