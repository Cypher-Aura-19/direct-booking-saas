import { notFound } from "next/navigation";
import { dashboardContext } from "../../_lib/context";
import { getProperty } from "@/lib/properties/basics";
import { PageHeader } from "@/components/ui/page-header";
import { Stamp } from "@/components/ui/stamp";
import { SubNav } from "@/components/ui/sub-nav";

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
      <PageHeader
        back={{ href: "/dashboard/properties", label: "Properties" }}
        title={property.name}
        meta={
          property.published ? (
            <Stamp tone="green" tilt={-3}>
              Published
            </Stamp>
          ) : (
            <Stamp tone="grey" tilt={2}>
              Draft
            </Stamp>
          )
        }
        description={property.address}
      />
      <SubNav items={tabs} />
      {children}
    </div>
  );
}
