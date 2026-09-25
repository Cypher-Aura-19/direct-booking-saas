import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public guest pages read with the anon key and no cookies: nothing about
// the visitor changes what they see, so the page can be cached, and a
// signed-in host previewing their own page sees exactly what a guest sees.
export function createPublicClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
