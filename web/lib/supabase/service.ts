import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The only place the service-role key is read. It bypasses RLS, so every
// caller must scope its own queries: guest chat code scopes everything to the
// conversation resolved from the guest's token (spec §4).
export function createServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
