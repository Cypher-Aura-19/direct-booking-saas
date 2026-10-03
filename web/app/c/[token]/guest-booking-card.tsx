import Link from "next/link";
import { formatRupees } from "@/lib/properties/basics";
import type { GuestBookingView } from "@/lib/bookings/guest";

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmt = (d: string) => SHORT.format(new Date(`${d}T00:00:00Z`));

const HEADLINE: Record<GuestBookingView["status"], string> = {
  requested: "Request sent — waiting for the host",
  approved: "Approved by the host",
  paid: "Payment received",
  staying: "Enjoy your stay",
  checked_out: "Stay completed",
  rejected: "This request wasn't accepted",
};

export function GuestBookingCard({ view }: { view: GuestBookingView }) {
  const pi = view.paymentInstructions;
  const methods = pi
    ? ([
        ["Bank", [pi.bankName, pi.accountTitle].filter(Boolean).join(" · ")],
        ["Account number", pi.accountNumber],
        ["Easypaisa", pi.easypaisa],
        ["JazzCash", pi.jazzcash],
      ] as const).filter(([, value]) => value)
    : [];

  return (
    <section className="guest-booking-card" aria-label="Your booking">
      <p className="guest-booking-status" data-status={view.status}>{HEADLINE[view.status]}</p>
      <p className="guest-booking-stay">
        {fmt(view.startDate)} → {fmt(view.endDate)} · {view.nights} {view.nights === 1 ? "night" : "nights"} · <strong>{formatRupees(view.totalCents)}</strong>
      </p>
      {view.status === "requested" && <p className="guest-booking-help">You&apos;ll get the host&apos;s reply here. Nothing is charged yet.</p>}
      {view.status === "approved" && pi && (
        <div className="guest-booking-pay">
          {view.advancePercent > 0 && (
            <p>
              Pay an advance of <strong>{formatRupees(view.advanceCents)}</strong> ({view.advancePercent}%) to secure the dates. Pay the host directly:
            </p>
          )}
          <dl>
            {methods.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
          {pi.note && <p className="guest-booking-note">{pi.note}</p>}
        </div>
      )}
      {view.idUpload?.status === "open" && (
        <div className="guest-booking-id">
          <p>Please upload your ID before you arrive — your host needs it to register your stay.</p>
          <Link href={view.idUpload.path} className="guest-booking-id-link">Upload your ID</Link>
        </div>
      )}
      {view.idUpload?.status === "received" && <p className="guest-booking-help">ID received — thank you.</p>}
    </section>
  );
}
