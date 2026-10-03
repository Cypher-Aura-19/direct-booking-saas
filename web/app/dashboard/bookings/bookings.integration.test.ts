// @vitest-environment node
import { test, expect, beforeAll, afterAll, vi } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { approveBookingAction, rejectBookingAction } from "./actions";

// dashboardContext() needs a real request's cookies; every dashboard Server
// Action test here mocks it with a real signed-in host's own client instead.
let fixture: Awaited<ReturnType<typeof seedBookingFixture>>;
vi.mock("../_lib/context", () => ({
  dashboardContext: async () => ({
    supabase: fixture.host.supabase,
    organization: { id: fixture.host.organizationId, slug: fixture.host.organizationSlug, name: "Test Org" },
  }),
}));
// revalidatePath needs Next's request store, which doesn't exist here.
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const START = addDays(localToday(), 30);
beforeAll(async () => { fixture = await seedBookingFixture(); });
afterAll(async () => { await fixture?.host.cleanup(); });

// @req BOOK-05
test("approve and reject Server Actions decide a host's own bookings end to end", async () => {
  const { host, service, propertyId } = fixture;
  const a = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: addDays(START, 2) });
  const b = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: addDays(START, 10), end: addDays(START, 12) });

  expect(await approveBookingAction(a.bookingId)).toEqual({ error: null });
  expect(await rejectBookingAction(b.bookingId)).toEqual({ error: null });
  const { data } = await service.from("bookings").select("id, status").in("id", [a.bookingId, b.bookingId]);
  expect(Object.fromEntries(data!.map((r) => [r.id, r.status]))).toEqual({ [a.bookingId]: "approved", [b.bookingId]: "rejected" });

  expect((await approveBookingAction(a.bookingId)).error).toMatch(/already/i);
  expect((await approveBookingAction("00000000-0000-0000-0000-000000000000")).error).toMatch(/not found/i);
});
