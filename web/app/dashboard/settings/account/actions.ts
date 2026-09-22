"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword, signOutHost } from "@/lib/auth/actions";

export async function changePasswordAction(
  _prevState: { error: string | null; success: boolean },
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await updatePassword(supabase, { password });
  if (error) return { error, success: false };
  return { error: null, success: true };
}

// Explicit return type: without it, TS infers the return type from the
// function's body, but since `redirect()` never returns and there is no
// other return statement, the inferred type is unrelated to the `void`
// callers expect from a <form action={...}> handler — this pattern has
// tripped up `next build`'s type check for every other redirecting action
// in this plan (signUpAction, loginAction, resetPasswordAction,
// onboardingAction).
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await signOutHost(supabase);
  redirect("/login");
}
