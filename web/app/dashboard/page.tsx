import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

// Takes its four lists as props (rather than fetching them itself) so this
// component — the actual AUTH-13 requirement — is directly testable. The
// default export below is the thin, unfetched-from-props version Next.js
// renders; the fetching is one straightforward block, not business logic.
export function DashboardHome({
  pendingBookings,
  escalatedConversations,
  unreadMessages,
  todaysArrivalsAndDepartures,
}: {
  pendingBookings: Row[];
  escalatedConversations: Row[];
  unreadMessages: Row[];
  todaysArrivalsAndDepartures: Row[];
}) {
  const nothingToShow =
    pendingBookings.length === 0 &&
    escalatedConversations.length === 0 &&
    unreadMessages.length === 0 &&
    todaysArrivalsAndDepartures.length === 0;

  if (nothingToShow) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-muted">Nothing needs you right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
      {pendingBookings.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Waiting booking requests</h2>
          <p>{pendingBookings.length}</p>
        </section>
      )}
      {escalatedConversations.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Escalated chats</h2>
          <p>{escalatedConversations.length}</p>
        </section>
      )}
      {unreadMessages.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Unread messages</h2>
          <p>{unreadMessages.length}</p>
        </section>
      )}
      {todaysArrivalsAndDepartures.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Today&apos;s arrivals and departures</h2>
          <p>{todaysArrivalsAndDepartures.length}</p>
        </section>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", userData.user.id)
    .maybeSingle();
  if (!organization) redirect("/onboarding");

  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("organization_id", organization.id);
  const propertyIds = properties?.map((p) => p.id) ?? [];

  // messages has no read-tracking column until M9 — unreadMessages is
  // genuinely unexpressible in M3, not stubbed.
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: pendingBookings }, { data: escalatedConversations }, { data: todaysArrivalsAndDepartures }] =
    await Promise.all([
      supabase.from("bookings").select("id").eq("status", "requested").in("property_id", propertyIds),
      supabase.from("conversations").select("id").eq("escalated", true).in("property_id", propertyIds),
      supabase
        .from("bookings")
        .select("id")
        .in("status", ["approved", "staying"])
        .in("property_id", propertyIds)
        .or(`start_date.eq.${today},end_date.eq.${today}`),
    ]);

  return (
    <DashboardHome
      pendingBookings={pendingBookings ?? []}
      escalatedConversations={escalatedConversations ?? []}
      unreadMessages={[]}
      todaysArrivalsAndDepartures={todaysArrivalsAndDepartures ?? []}
    />
  );
}
