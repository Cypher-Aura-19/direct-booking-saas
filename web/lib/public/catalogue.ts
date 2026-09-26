import type { SupabaseClient } from "@supabase/supabase-js";
import type { Amenity } from "@/lib/properties/listing";
import { PHOTO_BUCKET } from "@/lib/properties/photos";
import { PHOTO_WIDTHS, variantPath } from "@/lib/properties/photo-variants";

export type PublicOrganization = { id: string; slug: string; name: string; headline: string; city: string; phone: string; hostingSince: number };
export type PublicPhoto = { id: string; src: string; srcSet: string };
export type PublicPropertySummary = { id: string; slug: string; name: string; propertyType: string; baseRateCents: number; maxGuests: number; cover: PublicPhoto | null };
export type PublicProperty = PublicPropertySummary & { description: string; amenities: Amenity[]; photos: PublicPhoto[] };

// Must outlive the page cache (revalidate = 3600 on the public routes), or a
// cached page would point at expired image URLs. Kept as short as that
// allows (2h, not 24h): a signed URL for a since-unpublished photo keeps
// working until it expires, so shorter is safer.
export const SIGNED_URL_SECONDS = 7_200;

// Explicit column lists only: anon has column-level grants (20260922090000,
// 20260926010000), so `*` fails with 42501.
const PROPERTY_COLUMNS = "id, slug, name, property_type, base_rate_cents, max_guests";
const PHOTO_COLUMNS = "id, property_id, storage_path, position, is_cover, has_variants, created_at";

type PhotoRow = { id: string; property_id: string; storage_path: string; position: number; is_cover: boolean; has_variants: boolean; created_at: string };
type PropertyRow = { id: string; slug: string; name: string; property_type: string; base_rate_cents: number; max_guests: number };

export async function getPublicOrganization(supabase: SupabaseClient, slug: string): Promise<PublicOrganization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, profile, created_at")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = (data.profile ?? {}) as { city?: string; phone?: string; headline?: string };
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    headline: profile.headline ?? "",
    city: profile.city ?? "",
    phone: profile.phone ?? "",
    hostingSince: new Date(data.created_at).getFullYear(),
  };
}

// One signing round trip for every image on the page. Originals are never
// signed or served here: an original can carry EXIF GPS (the exact address
// the 2026-09-25 decision already revoked from properties.address), and
// anon's storage policy (20260926020000) only grants read on the resized
// .w480/960/1600.webp variants anyway. A photo without variants — an older
// upload, or one whose browser couldn't produce webp (photo-variants.ts) —
// is simply skipped; callers fall back to their placeholder state.
async function toPublicPhotos(supabase: SupabaseClient, rows: PhotoRow[]): Promise<Map<string, PublicPhoto>> {
  const result = new Map<string, PublicPhoto>();
  const withVariants = rows.filter((row) => row.has_variants);
  if (withVariants.length === 0) return result;
  const paths = withVariants.flatMap((row) => PHOTO_WIDTHS.map((w) => variantPath(row.storage_path, w)));
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  for (const row of withVariants) {
    const entries = PHOTO_WIDTHS.map((w) => [w, urls.get(variantPath(row.storage_path, w))] as const).filter(([, url]) => url);
    if (entries.length === 0) continue;
    const middle = entries.find(([w]) => w === 960) ?? entries[entries.length - 1];
    result.set(row.id, { id: row.id, src: middle[1]!, srcSet: entries.map(([w, url]) => `${url} ${w}w`).join(", ") });
  }
  return result;
}

function ordered(rows: PhotoRow[]): PhotoRow[] {
  return [...rows].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function summary(row: PropertyRow, cover: PublicPhoto | null): PublicPropertySummary {
  return { id: row.id, slug: row.slug, name: row.name, propertyType: row.property_type, baseRateCents: row.base_rate_cents, maxGuests: row.max_guests, cover };
}

export async function listPublishedProperties(supabase: SupabaseClient, organizationId: string): Promise<PublicPropertySummary[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("published", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const properties = (data ?? []) as PropertyRow[];
  if (properties.length === 0) return [];

  const { data: photoData, error: photoError } = await supabase
    .from("property_photos")
    .select(PHOTO_COLUMNS)
    .in("property_id", properties.map((p) => p.id))
    .eq("is_cover", true);
  if (photoError) throw photoError;
  const covers = (photoData ?? []) as PhotoRow[];
  const sources = await toPublicPhotos(supabase, covers);
  return properties.map((p) => {
    const cover = covers.find((c) => c.property_id === p.id);
    return summary(p, cover ? sources.get(cover.id) ?? null : null);
  });
}

export async function getPublishedProperty(supabase: SupabaseClient, organizationId: string, propertySlug: string): Promise<PublicProperty | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(`${PROPERTY_COLUMNS}, description, amenities`)
    .eq("organization_id", organizationId)
    .eq("slug", propertySlug.toLowerCase())
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: photoData, error: photoError } = await supabase
    .from("property_photos")
    .select(PHOTO_COLUMNS)
    .eq("property_id", data.id);
  if (photoError) throw photoError;
  const rows = ordered((photoData ?? []) as PhotoRow[]);
  const sources = await toPublicPhotos(supabase, rows);
  const photos = rows.map((r) => sources.get(r.id)).filter((p): p is PublicPhoto => Boolean(p));
  const coverRow = rows.find((r) => r.is_cover);
  const cover = coverRow ? sources.get(coverRow.id) ?? null : photos[0] ?? null;
  return { ...summary(data as PropertyRow, cover), description: data.description, amenities: data.amenities as Amenity[], photos };
}

// Pakistani numbers are written 0300 1234567, +92 300 1234567 or 92300…;
// all become 923001234567. Anything under 10 digits is not a phone number.
function internationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

export function whatsappLink(phone: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

export function telLink(phone: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `tel:+${digits}` : null;
}
