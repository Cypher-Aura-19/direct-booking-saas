import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dashboardContext } from "../../_lib/context";
import { getProperty, publicPropertyPath } from "@/lib/properties/basics";
import { BasicsForm } from "../basics-form";
import { setPublishedAction, updatePropertyAction } from "../actions";

export default async function PropertyBasicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organization } = await dashboardContext();
  const property = await getProperty(supabase, id);
  if (!property) notFound();

  return (
    <div className="flex flex-col gap-12">
      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Visibility</h2>
        {property.published ? (
          <p>
            Published. Guests can see it at{" "}
            <a className="underline" href={publicPropertyPath(organization.slug, property.slug)}>
              {publicPropertyPath(organization.slug, property.slug)}
            </a>
            .
          </p>
        ) : (
          <p className="text-muted">Draft. Only you can see this property.</p>
        )}
        <form action={setPublishedAction.bind(null, id, !property.published)}>
          <Button type="submit" variant={property.published ? "secondary" : "primary"}>
            {property.published ? "Unpublish" : "Publish"}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Basics</h2>
        <BasicsForm action={updatePropertyAction.bind(null, id)} property={property} submitLabel="Save changes" />
      </section>
    </div>
  );
}
