import Link from "next/link";
import { PageHeader, Sheet } from "@/components/ui/page-header";
import { retentionLabel } from "@/lib/hotel-eye/dates";
import { listRecords, parseRange } from "@/lib/hotel-eye/records";
import { dashboardContext } from "../_lib/context";

export const dynamic = "force-dynamic";

const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => SHORT.format(new Date(`${iso}T00:00:00Z`));

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const params = await searchParams;
  const { supabase } = await dashboardContext();
  const range = parseRange(params.from, params.to);
  const records = await listRecords(supabase, range);
  const now = new Date();

  const query = new URLSearchParams();
  if (range.from) query.set("from", range.from);
  if (range.to) query.set("to", range.to);
  const exportHref = `/api/guests/export${query.size ? `?${query}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Guest IDs" description="Records for the Hotel Eye portal. Each is deleted automatically when its retention period ends." />
      <Sheet className="p-5 sm:p-8">
        <form method="get" className="guest-filter">
          <label>From <input type="date" name="from" defaultValue={range.from ?? ""} /></label>
          <label>To <input type="date" name="to" defaultValue={range.to ?? ""} /></label>
          <button type="submit">Filter</button>
          <a href={exportHref} className="booking-link">Export CSV</a>
        </form>
        {records.length === 0 ? (
          <p className="record-note">No guest IDs {range.from || range.to ? "in this date range" : "yet"}. They appear here once a guest uploads their ID.</p>
        ) : (
          <div className="booking-table-wrap">
            <table className="booking-table">
              <thead><tr><th>Guest</th><th>Stay</th><th>CNIC</th><th>Retention</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/dashboard/guests/${r.id}`}>{r.guestName}</Link></td>
                    <td>{fmt(r.stayStart)} → {fmt(r.stayEnd)}</td>
                    <td>{r.cnicNumber ?? "—"}</td>
                    <td>{retentionLabel(r.retentionExpiresAt, now)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Sheet>
    </div>
  );
}
