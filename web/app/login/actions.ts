"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInHost } from "@/lib/auth/actions";

// Explicit return type: without it, TS infers the return type from the
// function's only `return` statement (`{ error }` narrowed to `string`,
// since `redirect()` never returns), producing `Promise<{ error: string }>`.
// useActionState's initial state of `{ error: null }` then no longer
// matches that inferred state type, and `next build`'s type check fails.
export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await signInHost(supabase, { email, password });

  if (error) return { error };
  redirect("/dashboard");
}
