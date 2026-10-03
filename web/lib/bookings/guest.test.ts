// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { approveBooking } from "./host";
import { getGuestBookingView } from "./guest";

const START = addDays(localToday(), 30);
const END = addDays(START, 3);

test("an unknown or malformed token has no booking view", async () => {
  const { host, service } = await seedBookingFixture();
  expect(await getGuestBookingView(service, "nope")).toBeNull();
  expect(await getGuestBookingView(service, "a".repeat(64))).toBeNull();
  await host.cleanup();
});

test("a conversation without a booking has no view", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { token } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });
  await service.from("bookings").delete().eq("property_id", propertyId);
  expect(await getGuestBookingView(service, token!)).toBeNull();
  await host.cleanup();
});

// @req BOOK-12
test("payment instructions reach the guest only once the booking is approved", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  await service.from("organizations").update({ payment_instructions: { easypaisa: "03001234567", note: "Send the receipt here." } }).eq("id", host.organizationId);
  await service.from("properties").update({ advance_percent: 30 }).eq("id", propertyId);
  const { bookingId, token } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END, totalCents: 1_500_000 });

  const pending = await getGuestBookingView(service, token!);
  expect(pending).toMatchObject({ status: "requested", nights: 3, totalCents: 1_500_000, paymentInstructions: null });

  await approveBooking(host.supabase, bookingId);
  const approved = await getGuestBookingView(service, token!);
  expect(approved).toMatchObject({ status: "approved", advancePercent: 30, advanceCents: 450_000 });
  expect(approved!.paymentInstructions).toMatchObject({ easypaisa: "03001234567", note: "Send the receipt here." });

  await service.from("bookings").update({ status: "rejected" }).eq("id", bookingId);
  expect((await getGuestBookingView(service, token!))!.paymentInstructions).toBeNull();
  await host.cleanup();
});

test("a token only ever resolves its own conversation's booking", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const one = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END, totalCents: 111_100 });
  const two = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: addDays(START, 10), end: addDays(START, 12), totalCents: 222_200 });
  expect((await getGuestBookingView(service, one.token!))!.totalCents).toBe(111_100);
  expect((await getGuestBookingView(service, two.token!))!.totalCents).toBe(222_200);
  await host.cleanup();
});
