// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { createProperty } from "@/lib/properties/basics";
import { createBlock } from "./blocks";
import { listCalendar } from "./calendar";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()!(); });

async function hostWithTwoProperties() {
  const host = await createTestHostWithOrg();
  cleanups.push(host.cleanup);
  const a = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "River Hut", property_type: "cabin", address: "Karimabad", base_rate_cents: 900_000, max_guests: 2 },
  });
  const b = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Valley View", property_type: "cabin", address: "Hunza", base_rate_cents: 900_000, max_guests: 2 },
  });
  return { host, propertyA: a.propertyId!, propertyB: b.propertyId! };
}

// @req CAL-03
it("lists every property with the blocks and confirmed bookings inside the window, excluding entries outside it", async () => {
  const { host, propertyA, propertyB } = await hostWithTwoProperties();

  expect(await createBlock(host.supabase, propertyA, { start: "2027-03-01", end: "2027-03-04" })).toEqual({ error: null });
  const { error: bookingError } = await host.supabase.from("bookings").insert({
    property_id: propertyB,
    start_date: "2027-03-05",
    end_date: "2027-03-07",
    status: "approved",
    total_price_cents: 1_800_000,
  });
  expect(bookingError).toBeNull();
  // Entirely outside the 30-night window below: must not show up.
  expect(await createBlock(host.supabase, propertyA, { start: "2028-01-01", end: "2028-01-03" })).toEqual({ error: null });

  const rows = await listCalendar(host.supabase, host.organizationId, "2027-03-01", 30);

  expect(rows).toHaveLength(2);
  expect(rows).toMatchObject([
    {
      propertyId: propertyA,
      propertyName: "River Hut",
      entries: [{ start: "2027-03-01", end: "2027-03-04", kind: "blocked", label: "Blocked" }],
    },
    {
      propertyId: propertyB,
      propertyName: "Valley View",
      entries: [{ start: "2027-03-05", end: "2027-03-07", kind: "booking", label: "Booked" }],
    },
  ]);
});
