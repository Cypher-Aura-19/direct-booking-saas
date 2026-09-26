import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { localToday } from "@/lib/dashboard/analytics";
import { getPublicAvailability, getPublicOrganization, getPublishedProperty } from "@/lib/public/catalogue";
import { formatRupees } from "@/lib/properties/basics";
import { PropertyView } from "./property-view";

export const revalidate = 3600;

type Props = { params: Promise<{ org: string; property: string }> };

const load = cache(async (orgSlug: string, propertySlug: string) => {
  const supabase = createPublicClient();
  const organization = await getPublicOrganization(supabase, orgSlug);
  if (!organization) return null;
  const property = await getPublishedProperty(supabase, organization.id, propertySlug);
  if (!property) return null;
  const today = localToday();
  const availability = await getPublicAvailability(supabase, property.id, today);
  return { organization, property, availability, today };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { org, property } = await params;
  const data = await load(org, property);
  if (!data) return { title: "Place not found" };
  return {
    title: `${data.property.name} · ${data.organization.name}`,
    description: `${formatRupees(data.property.baseRateCents)} a night, up to ${data.property.maxGuests} guests. Book directly with ${data.organization.name}.`,
    openGraph: data.property.cover ? { images: [data.property.cover.src] } : undefined,
  };
}

export default async function PropertyPage({ params }: Props) {
  const { org, property } = await params;
  const data = await load(org, property);
  if (!data) notFound();
  return <PropertyView organization={data.organization} property={data.property} availability={data.availability} today={data.today} />;
}
