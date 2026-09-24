"use server";

import { revalidatePath } from "next/cache";
import { dashboardContext } from "../_lib/context";
import { updateOrganizationSettings } from "@/lib/organizations/settings";
import type { FormState } from "../properties/actions";

export async function updateOrganizationSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, organization } = await dashboardContext();
  const { error } = await updateOrganizationSettings(supabase, {
    organizationId: organization.id,
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    headline: String(formData.get("headline") ?? "").trim(),
  });
  if (error) return { error, success: false };
  revalidatePath("/dashboard", "layout");
  return { error: null, success: true };
}
