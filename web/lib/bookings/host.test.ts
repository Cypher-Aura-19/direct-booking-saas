// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { anonClient } from "@/tests/helpers";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { approveBooking, getBooking, getBookingForConversation, listBookings, rejectBooking } from "./host";

const START = addDays(localToday(), 30);
const END = addDays(START, 3);

// @req BOOK-05
test("a host lists pending requests with guest, property and price, newest first, and fetches one by id", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const a = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END, name: "First Guest" });
  const b = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: addDays(START, 10), end: addDays(START, 12), name: "Second Guest" });

  const rows = await listBookings(host.supabase, host.organizationId);
  expect(rows.map((r) => r.id)).toEqual([b.bookingId, a.bookingId]);
  expect(rows[1]).toMatchObject({
    propertyId, propertyName: "Booking Test Cabin", guestName: "First Guest", guestPhone: "03001234567",
    startDate: START, endDate: END, nights: 3, status: "requested", totalCents: 1_500_000, conversationId: a.conversationId,
  });
  expect(await getBooking(host.supabase, a.bookingId)).toMatchObject({ id: a.bookingId, guestName: "First Guest" });
  expect(await getBookingForConversation(host.supabase, a.conversationId!)).toMatchObject({ id: a.bookingId });
  await host.cleanup();
});

test("another organisation can neither see nor decide a booking", async () => {
  const a = await seedBookingFixture();
  const b = await seedBookingFixture();
  const { bookingId } = await insertRequestedBooking(a.service, { propertyId: a.propertyId, organizationId: a.host.organizationId, start: START, end: END });
  expect(await getBooking(b.host.supabase, bookingId)).toBeNull();
  expect(await listBookings(b.host.supabase, b.host.organizationId)).toEqual([]);
  expect(await approveBooking(b.host.supabase, bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await rejectBooking(b.host.supabase, bookingId)).toEqual({ ok: false, reason: "not_found" });
  const { data } = await a.service.from("bookings").select("status").eq("id", bookingId).single();
  expect(data!.status).toBe("requested");
  await a.host.cleanup();
  await b.host.cleanup();
});

// @req BOOK-06
// @req BOOK-07
test("approving locks exactly [start,end) as a 'booking' block, links it, and moves the conversation to payment", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { bookingId, conversationId } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });

  expect(await approveBooking(host.supabase, bookingId)).toEqual({ ok: true });

  const { data: blocks } = await service.from("availability_blocks").select("id, start_date, end_date, reason").eq("property_id", propertyId);
  expect(blocks).toHaveLength(1);
  expect(blocks![0]).toMatchObject({ start_date: START, end_date: END, reason: "booking" });
  const { data: booking } = await service.from("bookings").select("status, block_id").eq("id", bookingId).single();
  expect(booking).toMatchObject({ status: "approved", block_id: blocks![0].id });
  const { data: conversation } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(conversation!.ai_state).toBe("payment");
  await host.cleanup();
});

// @req BOOK-08
test("entering payment sends exactly one acknowledgement, and a second approve adds none", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { bookingId, conversationId } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });

  await approveBooking(host.supabase, bookingId);
  expect(await approveBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  const { data: messages } = await service.from("messages").select("sender, body").eq("conversation_id", conversationId!);
  expect(messages).toHaveLength(1);
  expect(messages![0].sender).toBe("ai");
  expect(messages![0].body).toMatch(/approved by the host/);
  await host.cleanup();
});

// @req BOOK-09
test("after approval no AI message can be written to the conversation", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { bookingId, conversationId } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });
  await approveBooking(host.supabase, bookingId);

  const { error } = await service.from("messages").insert({ conversation_id: conversationId, sender: "ai", body: "Sure, I can help with payment!" });
  expect(error?.code).toBe("23514"); // check_violation from messages_forbid_ai_during_payment
  await host.cleanup();
});

// @req BOOK-10
test("rejecting leaves the calendar, the conversation state and the messages untouched", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { bookingId, conversationId } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });

  expect(await rejectBooking(host.supabase, bookingId)).toEqual({ ok: true });

  const { data: blocks } = await service.from("availability_blocks").select("id").eq("property_id", propertyId);
  expect(blocks).toEqual([]);
  const { data: booking } = await service.from("bookings").select("status, block_id").eq("id", bookingId).single();
  expect(booking).toMatchObject({ status: "rejected", block_id: null });
  const { data: conversation } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(conversation!.ai_state).toBe("enquiry");
  const { data: messages } = await service.from("messages").select("id").eq("conversation_id", conversationId!);
  expect(messages).toEqual([]);
  expect(await rejectBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  await host.cleanup();
});

test("two overlapping requests: the first approval wins, the second fails cleanly and stays pending", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const first = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });
  const second = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: addDays(START, 1), end: addDays(END, 1) });

  expect(await approveBooking(host.supabase, first.bookingId)).toEqual({ ok: true });
  expect(await approveBooking(host.supabase, second.bookingId)).toEqual({ ok: false, reason: "dates_taken" });

  const { data: booking } = await service.from("bookings").select("status, block_id").eq("id", second.bookingId).single();
  expect(booking).toMatchObject({ status: "requested", block_id: null });
  const { data: conversation } = await service.from("conversations").select("ai_state").eq("id", second.conversationId!).single();
  expect(conversation!.ai_state).toBe("enquiry");
  const { data: messages } = await service.from("messages").select("id").eq("conversation_id", second.conversationId!);
  expect(messages).toEqual([]); // the aborted transaction left no acknowledgement behind
  await host.cleanup();
});

test("a booking without a conversation can still be approved (block locks, nothing else happens)", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { bookingId } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END, withConversation: false });
  expect(await approveBooking(host.supabase, bookingId)).toEqual({ ok: true });
  await host.cleanup();
});

test("anon cannot call approve_booking or reject_booking, and cannot read bookings or guests", async () => {
  const { host, service, propertyId } = await seedBookingFixture();
  const { bookingId } = await insertRequestedBooking(service, { propertyId, organizationId: host.organizationId, start: START, end: END });
  const anon = anonClient();
  expect((await anon.rpc("approve_booking", { booking_id: bookingId })).error).not.toBeNull();
  expect((await anon.rpc("reject_booking", { booking_id: bookingId })).error).not.toBeNull();
  expect((await anon.from("bookings").select("id")).error).not.toBeNull();
  expect((await anon.from("guests").select("id")).error).not.toBeNull();
  await host.cleanup();
});
