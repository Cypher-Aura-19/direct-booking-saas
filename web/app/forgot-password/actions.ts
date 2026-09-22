"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requestPasswordReset } from "@/lib/auth/actions";

export async function forgotPasswordAction(
  _prevState: { error: string | null; sent: boolean },
  formData: FormData,
): Promise<{ error: string | null; sent: boolean }> {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`;

  const { error } = await requestPasswordReset(supabase, {
    email,
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error, sent: false };
  return { error: null, sent: true };
}
