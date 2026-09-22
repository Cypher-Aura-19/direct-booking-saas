"use server";

import { createClient } from "@/lib/supabase/server";
import { requestPasswordReset } from "@/lib/auth/actions";

export async function forgotPasswordAction(
  _prevState: { error: string | null; sent: boolean },
  formData: FormData,
): Promise<{ error: string | null; sent: boolean }> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

  const { error } = await requestPasswordReset(supabase, {
    email,
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error, sent: false };
  return { error: null, sent: true };
}
