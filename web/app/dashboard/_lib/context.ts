import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/organizations/settings";

// Every dashboard page and action calls this instead of trusting the layout
// to have run: layouts don't re-run on client-side navigation, and Server
// Actions never run the layout at all. RLS would still protect the data;
// this makes the redirect correct too.
export async function dashboardContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const organization = await getCurrentOrganization(supabase, data.user.id);
  if (!organization) redirect("/onboarding");
  return { supabase, user: data.user, organization };
}
