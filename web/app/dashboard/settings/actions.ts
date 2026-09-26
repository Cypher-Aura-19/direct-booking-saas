"use server";

import { revalidatePath } from "next/cache";
import { dashboardContext } from "../_lib/context";
import { updateOrganizationSettings } from "@/lib/organizations/settings";
import { revalidatePublicPages } from "@/lib/public/revalidate";
import type { FormState } from "../properties/actions";

export async function updateOrganizationSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, organization } = await dashboardContext();
  const previousSlug = organization.slug;
  const nextSlug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const { error } = await updateOrganizationSettings(supabase, {
    organizationId: organization.id,
    name: String(formData.get("name") ?? "").trim(),
    slug: nextSlug,
    headline: String(formData.get("headline") ?? "").trim(),
  });
  if (error) return { error, success: false };
  revalidatePath("/dashboard", "layout");
  // The slug is the public URL's org segment (/s/<slug>): revalidate the old
  // one so it stops serving stale content, and the new one so it's fresh.
  revalidatePublicPages(previousSlug);
  if (nextSlug !== previousSlug) revalidatePublicPages(nextSlug);
  return { error: null, success: true };
}
