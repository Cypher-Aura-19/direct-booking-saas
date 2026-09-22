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
