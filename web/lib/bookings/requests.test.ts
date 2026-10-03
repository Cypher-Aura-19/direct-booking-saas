// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { getConversation } from "@/lib/chat/conversations";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { createBookingRequest, MAX_REQUESTS_PER_PROPERTY_PER_DAY, parseBookingRequest } from "./requests";

const today = localToday();
const START = addDays(today, 30);
const END = addDays(START, 3);
const input = (propertyId: string, over: Record<string, unknown> = {}) => ({
  propertyId, token: null as string | null, name: "Ayesha Khan", phone: "0300 1234567", checkIn: START, checkOut: END, today, ...over,
});

test("parseBookingRequest trims and validates name and phone", () => {
  expect(parseBookingRequest({ name: "  Ayesha Khan ", phone: " +92 300 1234567 " })).toEqual({ name: "Ayesha Khan", phone: "+923001234567" });
  expect(parseBookingRequest({ name: "", phone: "03001234567" })).toMatchObject({ error: expect.any(String) });
  expect(parseBookingRequest({ name: "x".repeat(81), phone: "03001234567" })).toMatchObject({ error: expect.any(String) });
  expect(parseBookingRequest({ name: "Ayesha", phone: "12" })).toMatchObject({ error: expect.any(String) });
  expect(parseBookingRequest({ name: "Ayesha", phone: "call me maybe" })).toMatchObject({ error: expect.any(String) });
});

// @req BOOK-01
test("a valid request creates a guest, a conversation, a request message and a 'requested' booking", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const result = await createBookingRequest(service, input(propertyId));
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  expect(result).toMatchObject({ nights: 3, totalCents: 1_500_000 });

  const { data: booking } = await service.from("bookings").select("status, start_date, end_date, conversation_id, guest_id").eq("id", result.bookingId).single();
  expect(booking).toMatchObject({ status: "requested", start_date: START, end_date: END });
  const { data: guest } = await service.from("guests").select("name, phone, organization_id").eq("id", booking!.guest_id).single();
  expect(guest).toMatchObject({ name: "Ayesha Khan", phone: "03001234567", organization_id: host.organizationId });
  const conversation = await getConversation(service, result.token);
  expect(conversation).toMatchObject({ id: booking!.conversation_id, aiState: "enquiry" });
  const { data: messages } = await service.from("messages").select("sender, body").eq("conversation_id", conversation!.id);
  expect(messages).toHaveLength(1);
  expect(messages![0].sender).toBe("guest");
  expect(messages![0].body).toMatch(/Booking request/);
  await host.cleanup();
});

test("a request reuses the guest's existing enquiry conversation for this property", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const first = await createBookingRequest(service, input(propertyId));
  if (!first.ok) throw new Error("expected ok");
  await service.from("bookings").update({ status: "rejected" }).eq("id", first.bookingId);
  const second = await createBookingRequest(service, input(propertyId, { token: first.token, checkIn: addDays(START, 10), checkOut: addDays(START, 12) }));
  if (!second.ok) throw new Error("expected ok");
  expect(second.token).toBe(first.token);
  await host.cleanup();
});

test("a conversation already in payment gets a fresh conversation instead of reusing it", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const first = await createBookingRequest(service, input(propertyId));
  if (!first.ok) throw new Error("expected ok");
  await service.from("conversations").update({ ai_state: "payment" }).eq("guest_token", first.token);
  const second = await createBookingRequest(service, input(propertyId, { token: first.token, checkIn: addDays(START, 10), checkOut: addDays(START, 12) }));
  if (!second.ok) throw new Error("expected ok");
  expect(second.token).not.toBe(first.token);
  await host.cleanup();
});

// @req BOOK-02
test("a request is rejected when any night is already blocked, and nothing is written", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  await service.from("availability_blocks").insert({ property_id: propertyId, start_date: addDays(START, 1), end_date: addDays(START, 2), reason: "manual_block" });
  expect(await createBookingRequest(service, input(propertyId))).toEqual({ ok: false, reason: "unavailable", minimumStay: 1 });
  const { data } = await service.from("bookings").select("id").eq("property_id", propertyId);
  expect(data).toEqual([]);
  const { data: guests } = await service.from("guests").select("id").eq("organization_id", host.organizationId);
  expect(guests).toEqual([]);
  await host.cleanup();
});

// @req BOOK-03
test("a request below the minimum stay is rejected, including a seasonal override", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  await service.from("properties").update({ minimum_stay: 4 }).eq("id", propertyId);
  expect(await createBookingRequest(service, input(propertyId))).toEqual({ ok: false, reason: "minimum_stay", minimumStay: 4 });

  await service.from("properties").update({ minimum_stay: 1 }).eq("id", propertyId);
  await service.from("seasonal_pricing_rules").insert({ property_id: propertyId, start_date: START, end_date: addDays(START, 20), rate_cents: 700_000, minimum_stay: 5 });
  expect(await createBookingRequest(service, input(propertyId))).toEqual({ ok: false, reason: "minimum_stay", minimumStay: 5 });
  await host.cleanup();
});

// @req BOOK-04
test("the stored total is the server-computed quote; no client price can influence it", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  await service.from("seasonal_pricing_rules").insert({ property_id: propertyId, start_date: START, end_date: addDays(START, 2), rate_cents: 900_000, minimum_stay: 1 });
  // START, START+1 at the seasonal 900_000; START+2 at the base 500_000.
  const tampered = { ...input(propertyId), totalCents: 1, total_price_cents: 1 } as ReturnType<typeof input>;
  const result = await createBookingRequest(service, tampered);
  if (!result.ok) throw new Error("expected ok");
  expect(result.totalCents).toBe(2_300_000);
  const { data } = await service.from("bookings").select("total_price_cents").eq("id", result.bookingId).single();
  expect(data!.total_price_cents).toBe(2_300_000);
  await host.cleanup();
});

test("invalid, past and unknown-property requests are typed rejections, never throws", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  expect(await createBookingRequest(service, input(propertyId, { checkOut: START }))).toMatchObject({ ok: false, reason: "invalid" });
  expect(await createBookingRequest(service, input(propertyId, { checkIn: "not-a-date" }))).toMatchObject({ ok: false, reason: "invalid" });
  expect(await createBookingRequest(service, input(propertyId, { checkIn: addDays(today, -3), checkOut: addDays(today, -1) }))).toMatchObject({ ok: false, reason: "past" });
  expect(await createBookingRequest(service, input(propertyId, { checkIn: addDays(today, 400), checkOut: addDays(today, 402) }))).toMatchObject({ ok: false, reason: "invalid" });
  expect(await createBookingRequest(service, input("00000000-0000-0000-0000-000000000000"))).toMatchObject({ ok: false, reason: "not_found" });
  expect(await createBookingRequest(service, input("not-a-uuid"))).toMatchObject({ ok: false, reason: "not_found" });
  await host.cleanup();
});

test("an unpublished property takes no requests", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  await service.from("properties").update({ published: false }).eq("id", propertyId);
  expect(await createBookingRequest(service, input(propertyId))).toMatchObject({ ok: false, reason: "not_found" });
  await host.cleanup();
});

test("a second open request on the same conversation is a duplicate, and leaves no orphan guest", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const first = await createBookingRequest(service, input(propertyId));
  if (!first.ok) throw new Error("expected ok");
  const second = await createBookingRequest(service, input(propertyId, { token: first.token, checkIn: addDays(START, 10), checkOut: addDays(START, 12) }));
  expect(second).toEqual({ ok: false, reason: "duplicate" });
  const { data: guests } = await service.from("guests").select("id").eq("organization_id", host.organizationId);
  expect(guests).toHaveLength(1);
  await host.cleanup();
});

test("a property is rate-limited after MAX_REQUESTS_PER_PROPERTY_PER_DAY requests in 24h", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  for (let i = 0; i < MAX_REQUESTS_PER_PROPERTY_PER_DAY; i++) {
    await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: addDays(START, i * 4), end: addDays(START, i * 4 + 2), withConversation: false });
  }
  expect(await createBookingRequest(service, input(propertyId, { checkIn: addDays(START, 200), checkOut: addDays(START, 202) }))).toEqual({ ok: false, reason: "rate_limited" });
  await host.cleanup();
}, 120_000);
