import Link from "next/link";
import { IconCalendar } from "@/components/ui/icons";
import { Stamp, type StampTone } from "@/components/ui/stamp";
import { PIPELINE, type BookingStatus, type HostBooking } from "@/lib/bookings/host";
import { formatRupees } from "@/lib/properties/basics";

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "Requested", approved: "Approved", paid: "Paid", staying: "Staying", checked_out: "Checked out", rejected: "Declined",
};
export const BOOKING_STATUS_TONE: Record<BookingStatus, StampTone> = {
  requested: "amber", approved: "violet", paid: "green", staying: "green", checked_out: "grey", rejected: "red",
};

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const range = (b: HostBooking) => `${SHORT.format(new Date(`${b.startDate}T00:00:00Z`))} → ${SHORT.format(new Date(`${b.endDate}T00:00:00Z`))}`;

export function BookingsView({ bookings, status }: { bookings: HostBooking[]; status: BookingStatus | "all" }) {
  const count = (s: BookingStatus) => bookings.filter((b) => b.status === s).length;
  const visible = status === "all" ? bookings : bookings.filter((b) => b.status === status);
  const tabs: { key: BookingStatus | "all"; label: string; n: number }[] = [
    { key: "all", label: "All", n: bookings.length },
    ...PIPELINE.map((s) => ({ key: s, label: BOOKING_STATUS_LABEL[s], n: count(s) })),
    ...(count("rejected") ? [{ key: "rejected" as const, label: BOOKING_STATUS_LABEL.rejected, n: count("rejected") }] : []),
  ];

  return (
    <div className="bookings-view">
      <nav aria-label="Booking pipeline" className="bookings-pipeline">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? "/dashboard/bookings" : `/dashboard/bookings?status=${t.key}`}
            aria-current={status === t.key ? "page" : undefined}
            className={`bookings-stage ${status === t.key ? "is-active" : ""}`}
          >
            {t.label} <span>{t.n}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="panel-empty">
          <span><IconCalendar className="size-5" /></span>
          <h3>{bookings.length === 0 ? "No bookings yet" : "Nothing in this stage"}</h3>
          <p>{bookings.length === 0 ? "When a guest requests a stay from your public page, it appears here for you to approve." : "Try another stage."}</p>
        </div>
      ) : (
        <ul className="bookings-list divide-y divide-hairline">
          {visible.map((b) => (
            <li key={b.id} className="bookings-row">
              <Link href={`/dashboard/bookings/${b.id}`} aria-label={`${b.guestName}, ${b.propertyName}`}>
                <div className="bookings-row-main">
                  <strong>{b.guestName}</strong>
                  <span>{b.propertyName}</span>
                </div>
                <div className="bookings-row-dates">{range(b)} · {b.nights} {b.nights === 1 ? "night" : "nights"}</div>
                <div className="bookings-row-end">
                  <b>{formatRupees(b.totalCents)}</b>
                  <Stamp tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Stamp>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
