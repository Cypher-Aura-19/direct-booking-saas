import { PageHeader } from "@/components/ui/page-header";
import { listBookings, type BookingStatus } from "@/lib/bookings/host";
import { dashboardContext } from "../_lib/context";
import { BookingsView } from "./bookings-view";

const STATUSES = new Set<string>(["requested", "approved", "paid", "staying", "checked_out", "rejected"]);

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const { supabase, organization } = await dashboardContext();
  const bookings = await listBookings(supabase, organization.id);
  const active = status && STATUSES.has(status) ? (status as BookingStatus) : "all";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookings" description="Every request, from first ask to checkout." />
      <BookingsView bookings={bookings} status={active} />
    </div>
  );
}
