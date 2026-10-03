import Link from "next/link";
import { Stamp } from "@/components/ui/stamp";
import type { HostBooking } from "@/lib/bookings/host";
import { formatRupees } from "@/lib/properties/basics";
import { BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE } from "../../bookings/bookings-view";

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (d: string) => SHORT.format(new Date(`${d}T00:00:00Z`));

export function InboxBookingCard({ booking }: { booking: HostBooking }) {
  return (
    <div className="inbox-booking-card">
      <div>
        <Stamp tone={BOOKING_STATUS_TONE[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</Stamp>
        <p>{fmt(booking.startDate)} → {fmt(booking.endDate)} · {booking.nights} {booking.nights === 1 ? "night" : "nights"} · <strong>{formatRupees(booking.totalCents)}</strong></p>
      </div>
      <Link href={`/dashboard/bookings/${booking.id}`} className="booking-link">
        {booking.status === "requested" ? "Review request" : "View booking"}
      </Link>
    </div>
  );
}
