"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUpHost } from "@/lib/auth/actions";

// Explicit return type: without it, TS infers the return type from the
// function's only `return` statement (`{ error }` narrowed to `string`,
// since `redirect()` never returns), producing `Promise<{ error: string }>`.
// useActionState's initial state of `{ error: null }` then no longer
// matches that inferred state type, and `next build`'s type check fails.
export async function signUpAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const { error } = await signUpHost(supabase, {
    email,
    password,
    name,
    emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
  });

  if (error) return { error };
  redirect("/verify-email");
}
