import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, type DateRange } from "./dates";

export type CalendarEntry = DateRange & { kind: "blocked" | "booking"; label: string };
export type CalendarRow = { propertyId: string; propertyName: string; entries: CalendarEntry[] };

const CONFIRMED_STATUSES = ["approved", "paid", "staying"];

// CAL-03: every property in the org, including drafts, with the blocks and
// confirmed bookings that overlap the [from, from+nights) window. Booking
// rows in availability_blocks are skipped: the matching bookings row already
// represents that reservation, so counting both would double it up.
export async function listCalendar(
  supabase: SupabaseClient,
  organizationId: string,
  from: string,
  nights: number,
): Promise<CalendarRow[]> {
  const to = addDays(from, nights);

  const { data: properties, error: propertiesError } = await supabase
    .from("properties")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });
  if (propertiesError) throw propertiesError;

  const rows: CalendarRow[] = (properties ?? []).map((p) => ({ propertyId: p.id, propertyName: p.name, entries: [] }));
  if (rows.length === 0) return rows;
  const byProperty = new Map(rows.map((row) => [row.propertyId, row]));
  const ids = rows.map((row) => row.propertyId);

  const { data: blocks, error: blocksError } = await supabase
    .from("availability_blocks")
    .select("property_id, start_date, end_date, reason")
    .in("property_id", ids)
    .lt("start_date", to)
    .gt("end_date", from);
  if (blocksError) throw blocksError;

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("property_id, start_date, end_date, status")
    .in("property_id", ids)
    .lt("start_date", to)
    .gt("end_date", from)
    .in("status", CONFIRMED_STATUSES);
  if (bookingsError) throw bookingsError;

  for (const block of blocks ?? []) {
    if (block.reason !== "manual_block") continue;
    byProperty.get(block.property_id)?.entries.push({
      start: block.start_date,
      end: block.end_date,
      kind: "blocked",
      label: "Blocked",
    });
  }

  for (const booking of bookings ?? []) {
    byProperty.get(booking.property_id)?.entries.push({
      start: booking.start_date,
      end: booking.end_date,
      kind: "booking",
      label: "Booked",
    });
  }

  return rows;
}
