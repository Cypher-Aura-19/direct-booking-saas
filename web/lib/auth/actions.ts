import type { SupabaseClient } from "@supabase/supabase-js";

export async function signUpHost(
  supabase: SupabaseClient,
  { email, password, name, emailRedirectTo }: { email: string; password: string; name: string; emailRedirectTo: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo,
    },
  });
  return { error: error?.message ?? null };
}

export async function signInHost(
  supabase: SupabaseClient,
  { email, password }: { email: string; password: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOutHost(supabase: SupabaseClient): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

export async function requestPasswordReset(
  supabase: SupabaseClient,
  { email, redirectTo }: { email: string; redirectTo: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error: error?.message ?? null };
}

export async function updatePassword(
  supabase: SupabaseClient,
  { password }: { password: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}
