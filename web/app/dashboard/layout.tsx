import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getCurrentOrganization } from "@/lib/organizations/settings";
import "./workspace.css";
import { DashboardNav, WorkspaceHeader } from "./dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // getCurrentOrganization throws on a real database error instead of
  // returning null, so an outage surfaces as an error page (dashboard/
  // error.tsx) rather than silently redirecting a real host to /onboarding.
  const organization: { id: string; name: string } | null = userData.user
    ? await getCurrentOrganization(supabase, userData.user.id)
    : null;

  const access = resolveDashboardAccess({ user: userData.user, organization });
  if (access === "login") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");

  return (
    <div className="workspace flex min-h-dvh">
      <DashboardNav organizationName={organization?.name} userEmail={userData.user?.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WorkspaceHeader organizationName={organization?.name ?? "Your workspace"} />
        <main className="workspace-main">
          {children}
        </main>
      </div>
    </div>
  );
}
