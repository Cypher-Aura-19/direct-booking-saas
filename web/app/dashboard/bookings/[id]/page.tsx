import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@/components/ui/icons";
import { PageHeader, Sheet } from "@/components/ui/page-header";
import { Stamp } from "@/components/ui/stamp";
import { getBooking } from "@/lib/bookings/host";
import { getBookingIdStatus } from "@/lib/hotel-eye/records";
import { formatRupees } from "@/lib/properties/basics";
import { dashboardContext } from "../../_lib/context";
import { CopyField } from "../../guests/[id]/copy-field";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from "../bookings-view";
import { BookingActions } from "./booking-actions";

const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const long = (iso: string) => LONG.format(new Date(`${iso}T00:00:00Z`));

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const booking = await getBooking(supabase, id);
  if (!booking) notFound();
  const idStatus = await getBookingIdStatus(supabase, booking.id);
  const requestHeaders = await headers();
  const origin = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")}`;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/bookings" className="booking-back"><IconArrowLeft /> All bookings</Link>
      <PageHeader title={booking.guestName} description={`${booking.propertyName} · requested ${new Date(booking.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`} />
      <Sheet className="p-5 sm:p-8">
        <dl className="booking-facts">
          <div><dt>Status</dt><dd><Stamp tone={BOOKING_STATUS_TONE[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</Stamp></dd></div>
          <div><dt>Stay</dt><dd>{long(booking.startDate)} → {long(booking.endDate)} ({booking.nights} {booking.nights === 1 ? "night" : "nights"})</dd></div>
          <div><dt>Total</dt><dd>{formatRupees(booking.totalCents)} <small>computed by the server</small></dd></div>
          <div><dt>Phone</dt><dd>{booking.guestPhone ?? "—"}</dd></div>
          {booking.conversationId && (
            <div><dt>Chat</dt><dd><Link href={`/dashboard/inbox/${booking.conversationId}`} className="booking-link">Open the conversation</Link></dd></div>
          )}
          {idStatus.state === "received" && (
            <div><dt>Guest ID</dt><dd><Link href={`/dashboard/guests/${idStatus.recordId}`} className="booking-link">Received — view record</Link></dd></div>
          )}
          {idStatus.state === "open" && <CopyField label="ID upload link" value={`${origin}${idStatus.path}`} />}
          {idStatus.state === "expired" && <div><dt>Guest ID</dt><dd>The upload link expired without an ID.</dd></div>}
        </dl>
        <BookingActions bookingId={booking.id} status={booking.status} />
      </Sheet>
    </div>
  );
}
