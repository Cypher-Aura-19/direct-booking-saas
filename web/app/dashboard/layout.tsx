import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";
import { getCurrentOrganization } from "@/lib/organizations/settings";

const SIDEBAR_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/properties", label: "Properties" },
  { href: "/dashboard/settings", label: "Settings" },
];

// Spec §9: exactly four tabs on mobile. "More" is the settings area, which
// also links to Properties on small screens (settings/layout.tsx).
const TAB_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/settings", label: "More" },
];

export function DashboardNav() {
  return (
    <>
      <nav
        data-testid="dashboard-sidebar"
        className="hidden md:flex md:w-56 md:flex-col md:gap-1 md:border-e md:border-hairline md:p-4"
      >
        {SIDEBAR_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-card px-4 py-2 text-sm text-ink hover:bg-surface-muted"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <nav
        data-testid="dashboard-tabbar"
        className="fixed inset-x-0 bottom-0 flex justify-around border-t border-hairline bg-surface py-2 md:hidden"
      >
        {TAB_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex min-h-11 min-w-11 items-center justify-center px-3 text-xs text-ink"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // getCurrentOrganization throws on a real database error instead of
  // returning null, so an outage surfaces as an error page (dashboard/
  // error.tsx) rather than silently redirecting a real host to /onboarding.
  const organization: { id: string } | null = userData.user
    ? await getCurrentOrganization(supabase, userData.user.id)
    : null;

  const access = resolveDashboardAccess({ user: userData.user, organization });
  if (access === "login") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");

  return (
    <div className="flex min-h-dvh">
      <DashboardNav />
      <main className="flex-1 p-6 pb-20 md:pb-6">{children}</main>
    </div>
  );
}
