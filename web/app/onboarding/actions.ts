"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrganization, isSlugAvailable } from "@/lib/organizations/actions";

export async function checkSlugAction(slug: string): Promise<{ available: boolean }> {
  const supabase = await createClient();
  const available = await isSlugAvailable(supabase, slug);
  return { available };
}

// Explicit return type: without it, TS infers the return type from the
// function's only `return` statement (`{ error }` narrowed to `string`,
// since `redirect()` never returns), producing `Promise<{ error: string }>`.
// useActionState's initial state of `{ error: null }` then no longer
// matches that inferred state type, and `next build`'s type check fails.
// Same fix as signUpAction / loginAction / resetPasswordAction.
export async function onboardingAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const city = String(formData.get("city") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { error } = await createOrganization(supabase, {
    ownerId: userData.user.id,
    name,
    slug,
    city,
    phone,
  });

  if (error) return { error };
  redirect("/dashboard");
}
