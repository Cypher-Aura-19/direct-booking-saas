import type { SupabaseClient } from "@supabase/supabase-js";
import { isReservedSlug, isValidSlugFormat } from "./actions";

export type OrganizationSettings = { id: string; name: string; slug: string; headline: string };

export async function getCurrentOrganization(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<OrganizationSettings | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, profile")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, slug: data.slug, headline: data.profile?.headline ?? "" };
}

export async function updateOrganizationSettings(
  supabase: SupabaseClient,
  { organizationId, name, slug, headline }: { organizationId: string; name: string; slug: string; headline: string },
): Promise<{ error: string | null }> {
  if (!name.trim() || name.length > 80) return { error: "Business name is required (up to 80 characters)." };
  if (!isValidSlugFormat(slug)) return { error: "Slug must be 3-40 lowercase letters, digits and hyphens." };
  if (isReservedSlug(slug)) return { error: "That slug is reserved. Please choose another." };
  if (headline.length > 120) return { error: "The headline can be up to 120 characters." };

  // profile also holds onboarding's city and phone; merge, don't replace.
  const { data: current, error: readError } = await supabase
    .from("organizations")
    .select("profile")
    .eq("id", organizationId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!current) return { error: "Organisation not found." };

  const { error } = await supabase
    .from("organizations")
    .update({ name: name.trim(), slug, profile: { ...current.profile, headline } })
    .eq("id", organizationId);
  if (error) {
    if (error.code === "23505") return { error: "That slug is already taken." };
    return { error: error.message };
  }
  return { error: null };
}
