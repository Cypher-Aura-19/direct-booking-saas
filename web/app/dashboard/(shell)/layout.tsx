import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrganizationForUser } from "@/lib/organizations";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login");

  const org = await getOrganizationForUser(supabase, userData.user.id);

  return (
    <div className="min-h-dvh bg-background">
      <DashboardHeader orgName={org?.name ?? "Host Dashboard"} />
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
