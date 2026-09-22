import type { SupabaseClient } from "@supabase/supabase-js";

// Every one of these collides with a real top-level route in this app (see
// docs/superpowers/specs/2026-09-20-phase-1-design.md §9's routing tables)
// or is a generic platform reservation. An org slug matching any of these
// would make /s/<slug> or a future subdomain ambiguous with a real route.
export const RESERVED_SLUGS = [
  "www", "api", "admin", "dashboard", "onboarding", "login", "signup",
  "logout", "verify-email", "forgot-password", "reset-password", "auth",
  "s", "c", "id", "pricing", "privacy", "terms", "contact",
  "static", "public", "assets", "app", "mail", "ftp", "blog",
  "help", "support", "status", "_next",
];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

export async function isSlugAvailable(supabase: SupabaseClient, slug: string): Promise<boolean> {
  // A plain `select` against organizations is scoped by RLS to the
  // caller's own row (or nothing, for a host with no org yet) — this RPC
  // is the only way to check another host's slug without exposing their row.
  const { data, error } = await supabase.rpc("organization_slug_taken", { check_slug: slug });
  if (error) throw error;
  return data === false;
}

export async function createOrganization(
  supabase: SupabaseClient,
  { ownerId, name, slug, city, phone }: { ownerId: string; name: string; slug: string; city: string; phone: string },
): Promise<{ error: string | null; organizationId?: string }> {
  if (!isValidSlugFormat(slug)) {
    return { error: "Slug must be 3-40 lowercase letters, digits and hyphens." };
  }
  if (isReservedSlug(slug)) {
    return { error: "That slug is reserved. Please choose another." };
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({ owner_id: ownerId, name, slug, profile: { city, phone } })
    .select("id")
    .single();

  if (error) {
    // Postgres unique_violation on the slug column.
    if (error.code === "23505") return { error: "That slug is already taken." };
    return { error: error.message };
  }

  return { error: null, organizationId: data.id };
}
