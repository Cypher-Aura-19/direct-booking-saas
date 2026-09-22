export type DashboardAccess = "login" | "onboarding" | "allow";

// Pure decision, deliberately taking already-fetched data rather than
// fetching it itself — the fetching (a real Supabase call, needing
// cookies()) lives in dashboard/layout.tsx, which is trusted glue around
// this function. This split is what makes the guard chain testable at all.
export function resolveDashboardAccess({
  user,
  organization,
}: {
  user: { id: string } | null;
  organization: { id: string } | null;
}): DashboardAccess {
  if (!user) return "login";
  if (!organization) return "onboarding";
  return "allow";
}
