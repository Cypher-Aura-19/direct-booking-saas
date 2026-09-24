import type { SupabaseClient } from "@supabase/supabase-js";

export const PROPERTY_TYPES = [
  { value: "guesthouse", label: "Guesthouse" },
  { value: "apartment", label: "Serviced apartment" },
  { value: "cabin", label: "Cabin" },
  { value: "villa", label: "Villa" },
  { value: "farmhouse", label: "Farmhouse" },
  { value: "room", label: "Private room" },
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number]["value"];

export type PropertyBasics = {
  name: string;
  property_type: PropertyType;
  address: string;
  base_rate_cents: number;
  max_guests: number;
};

export type PropertySummary = {
  id: string;
  name: string;
  slug: string;
  property_type: string;
  base_rate_cents: number;
  max_guests: number;
  published: boolean;
};

export type Property = PropertySummary & { address: string };

const SUMMARY_COLUMNS = "id, name, slug, property_type, base_rate_cents, max_guests, published";

export function parsePropertyBasics(input: {
  name: unknown;
  propertyType: unknown;
  address: unknown;
  baseRate: unknown;
  maxGuests: unknown;
}): { ok: true; value: PropertyBasics } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim();
  const propertyType = String(input.propertyType ?? "");
  const address = String(input.address ?? "").trim();
  // Number("") is 0, which the range checks below reject — no special case.
  const baseRate = Number(String(input.baseRate ?? "").trim());
  const maxGuests = Number(String(input.maxGuests ?? "").trim());

  if (!name || name.length > 80) return { ok: false, error: "Name is required (up to 80 characters)." };
  if (!PROPERTY_TYPES.some((t) => t.value === propertyType)) return { ok: false, error: "Choose a property type." };
  if (!address || address.length > 200) return { ok: false, error: "Address is required (up to 200 characters)." };
  if (!Number.isInteger(baseRate) || baseRate < 1 || baseRate > 10_000_000) {
    return { ok: false, error: "Nightly rate must be a whole number of rupees, at least Rs 1." };
  }
  if (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 50) {
    return { ok: false, error: "Max guests must be between 1 and 50." };
  }

  return {
    ok: true,
    value: {
      name,
      property_type: propertyType as PropertyType,
      address,
      base_rate_cents: baseRate * 100,
      max_guests: maxGuests,
    },
  };
}

export function slugifyPropertyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function formatRupees(cents: number): string {
  return `Rs ${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function publicPropertyPath(organizationSlug: string, propertySlug: string): string {
  return `/s/${organizationSlug}/${propertySlug}`;
}

export async function createProperty(
  supabase: SupabaseClient,
  { organizationId, basics }: { organizationId: string; basics: PropertyBasics },
): Promise<{ error: string | null; propertyId?: string }> {
  const base = slugifyPropertyName(basics.name);

  for (let attempt = 0; attempt < 4; attempt++) {
    // null lets the database trigger generate p-<hex> for non-Latin names.
    const slug = !base
      ? null
      : attempt === 0
        ? base
        : `${base.slice(0, 35).replace(/-+$/, "")}-${crypto.randomUUID().slice(0, 4)}`;

    const { data, error } = await supabase
      .from("properties")
      .insert({ organization_id: organizationId, ...basics, slug })
      .select("id")
      .single();

    if (!error) return { error: null, propertyId: data.id };
    // 23505 here can only be (organization_id, slug): retry with a suffix.
    if (error.code !== "23505") return { error: error.message };
  }

  return { error: "Could not create a unique link for this property. Try a different name." };
}

export async function listProperties(supabase: SupabaseClient, organizationId: string): Promise<PropertySummary[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(SUMMARY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getProperty(supabase: SupabaseClient, propertyId: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(`${SUMMARY_COLUMNS}, address`)
    .eq("id", propertyId)
    .maybeSingle();
  // An id that isn't a uuid (a mistyped URL) is a 22P02, not a crash.
  if (error) return null;
  return data;
}

// RLS makes another host's row invisible, so an update against it matches
// zero rows without erroring. `.select("id")` is how that is detected.
async function updateOwnProperty(
  supabase: SupabaseClient,
  propertyId: string,
  changes: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from("properties").update(changes).eq("id", propertyId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Property not found." };
  return { error: null };
}

export function updatePropertyBasics(supabase: SupabaseClient, propertyId: string, basics: PropertyBasics) {
  return updateOwnProperty(supabase, propertyId, basics);
}

export function setPropertyPublished(supabase: SupabaseClient, propertyId: string, published: boolean) {
  return updateOwnProperty(supabase, propertyId, { published });
}
