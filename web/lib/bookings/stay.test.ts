// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { anonClient } from "@/tests/helpers";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { approveBooking, checkInBooking, checkOutBooking, markBookingPaid } from "./host";

const START = addDays(localToday(), 30);
const END = addDays(START, 3);

async function approvedBooking(withConversation = true) {
  const fixture = await seedBookingFixture();
  const booking = await insertRequestedBooking(fixture.service, {
    propertyId: fixture.propertyId, organizationId: fixture.host.organizationId, start: START, end: END, withConversation,
  });
  expect(await approveBooking(fixture.host.supabase, booking.bookingId)).toEqual({ ok: true });
  return { ...fixture, ...booking };
}

const statusOf = async (service: Awaited<ReturnType<typeof approvedBooking>>["service"], id: string) =>
  (await service.from("bookings").select("status").eq("id", id).single()).data!.status;

// @req PAY-01
// @req PAY-02
// @req PAY-03
test("marking payment received makes the booking paid, moves the conversation to stay and sends exactly one acknowledgement", async () => {
  const { host, service, bookingId, conversationId } = await approvedBooking();

  expect(await markBookingPaid(host.supabase, bookingId)).toEqual({ ok: true });

  expect(await statusOf(service, bookingId)).toBe("paid");
  const { data: conversation } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(conversation!.ai_state).toBe("stay");

  const { data: messages } = await service.from("messages").select("sender, body").eq("conversation_id", conversationId!).order("created_at");
  expect(messages!.map((m) => m.sender)).toEqual(["ai", "ai"]); // M10's approval ack, then this one
  expect(messages![1].body).toMatch(/Payment received/);

  // A second call is a typed no-op: no second message.
  expect(await markBookingPaid(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  const { data: after } = await service.from("messages").select("id").eq("conversation_id", conversationId!);
  expect(after).toHaveLength(2);
  await host.cleanup();
});

// @req PAY-03
test("in stay state an AI message can be written again (the payment-state block has lifted)", async () => {
  const { host, service, bookingId, conversationId } = await approvedBooking();
  await markBookingPaid(host.supabase, bookingId);
  const { error } = await service.from("messages").insert({ conversation_id: conversationId, sender: "ai", body: "Check-in is from 2pm." });
  expect(error).toBeNull();
  await host.cleanup();
});

// @req PAY-01
test("only an approved booking can be marked paid", async () => {
  const fixture = await seedBookingFixture();
  const { bookingId, conversationId } = await insertRequestedBooking(fixture.service, {
    propertyId: fixture.propertyId, organizationId: fixture.host.organizationId, start: START, end: END,
  });
  expect(await markBookingPaid(fixture.host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  expect(await statusOf(fixture.service, bookingId)).toBe("requested");
  const { data } = await fixture.service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(data!.ai_state).toBe("enquiry");
  await fixture.host.cleanup();
});

// @req PAY-01
test("another organisation cannot mark, check in or check out a booking, and anon cannot call any of them", async () => {
  const a = await approvedBooking();
  const b = await seedBookingFixture();
  expect(await markBookingPaid(b.host.supabase, a.bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await checkInBooking(b.host.supabase, a.bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await checkOutBooking(b.host.supabase, a.bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await statusOf(a.service, a.bookingId)).toBe("approved");

  const anon = anonClient();
  for (const fn of ["mark_booking_paid", "check_in_booking", "check_out_booking"]) {
    expect((await anon.rpc(fn, { booking_id: a.bookingId })).error).not.toBeNull();
  }
  await a.host.cleanup();
  await b.host.cleanup();
});

// @req PAY-06
test("check-in then check-out move the booking paid -> staying -> checked_out, in that order only", async () => {
  const { host, service, bookingId, conversationId } = await approvedBooking();

  // Not yet paid: neither step is available.
  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  await markBookingPaid(host.supabase, bookingId);
  // Paid but not checked in: check-out is premature.
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await statusOf(service, bookingId)).toBe("staying");
  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await statusOf(service, bookingId)).toBe("checked_out");
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  const { data } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(data!.ai_state).toBe("stay"); // terminal; check-in/out never touch it
  await host.cleanup();
});

test("a booking without a conversation still moves through the whole pipeline", async () => {
  const { host, service, bookingId } = await approvedBooking(false);
  expect(await markBookingPaid(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await statusOf(service, bookingId)).toBe("checked_out");
  await host.cleanup();
});
