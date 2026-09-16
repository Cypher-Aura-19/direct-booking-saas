import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/organizations";
import { listPropertiesForOrganization } from "@/lib/properties";
import { ButtonLink } from "@/components/ui/button";
import { PropertyCard } from "@/components/property-card";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const org = await getOrganizationForUser(supabase, userData.user.id);
  if (!org) redirect("/dashboard/onboarding");

  const properties = await listPropertiesForOrganization(supabase, org.id);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-foreground">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {properties.length === 0
              ? "Nothing here yet."
              : `${properties.length} ${properties.length === 1 ? "property" : "properties"}`}
          </p>
        </div>
        <ButtonLink href="/dashboard/properties/new">New property</ButtonLink>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-8 py-16 text-center">
          <p className="font-display text-lg italic text-muted-foreground">
            Add your first property to start building its guest page.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}
