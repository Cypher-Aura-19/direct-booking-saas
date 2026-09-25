import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicOrganization, listPublishedProperties } from "@/lib/public/catalogue";
import { CatalogueView } from "./catalogue-view";

// Cached per organisation; signed image URLs last 24h (SIGNED_URL_SECONDS).
export const revalidate = 3600;

type Props = { params: Promise<{ org: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { org } = await params;
  const organization = await getPublicOrganization(createPublicClient(), org);
  if (!organization) return { title: "Host not found" };
  return { title: organization.name, description: organization.headline || `Book a stay with ${organization.name}.` };
}

export default async function CataloguePage({ params }: Props) {
  const { org } = await params;
  const supabase = createPublicClient();
  const organization = await getPublicOrganization(supabase, org);
  if (!organization) notFound();
  const properties = await listPublishedProperties(supabase, organization.id);
  return <CatalogueView organization={organization} properties={properties} />;
}
