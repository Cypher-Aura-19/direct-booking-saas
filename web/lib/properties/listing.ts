import type { SupabaseClient } from "@supabase/supabase-js";

// Must match the properties_amenities_known check in
// supabase/migrations/20260926010000_m5_public_catalogue.sql exactly.
export const AMENITIES = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "parking", label: "Parking" },
  { value: "hot_water", label: "Hot water" },
  { value: "backup_power", label: "Backup power" },
  { value: "heating", label: "Heating" },
  { value: "air_conditioning", label: "Air conditioning" },
  { value: "kitchen", label: "Kitchen" },
  { value: "breakfast", label: "Breakfast available" },
  { value: "mountain_view", label: "Mountain view" },
  { value: "family_friendly", label: "Family friendly" },
  { value: "workspace", label: "Workspace" },
  { value: "garden", label: "Garden or terrace" },
] as const;

export type Amenity = (typeof AMENITIES)[number]["value"];
export type Listing = { description: string; amenities: Amenity[] };

const MAX_DESCRIPTION = 2000;
const ORDER = AMENITIES.map((a) => a.value as string);

export function amenityLabel(value: string): string {
  return AMENITIES.find((a) => a.value === value)?.label ?? value;
}

export function parseListing(input: { description: string; amenities: string[] }): { listing: Listing } | { error: string } {
  const description = input.description.trim();
  if (description.length > MAX_DESCRIPTION) return { error: "The description must be 2,000 characters or fewer." };
  const unknown = input.amenities.find((a) => !ORDER.includes(a));
  if (unknown) return { error: `Unknown amenity: ${unknown}` };
  const amenities = ORDER.filter((a) => input.amenities.includes(a)) as Amenity[];
  return { listing: { description, amenities } };
}

export async function getListing(supabase: SupabaseClient, propertyId: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("description, amenities")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? { description: data.description, amenities: data.amenities as Amenity[] } : null;
}

export async function updateListing(supabase: SupabaseClient, propertyId: string, listing: Listing): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("properties")
    .update({ description: listing.description, amenities: listing.amenities })
    .eq("id", propertyId);
  return { error: error ? error.message : null };
}
