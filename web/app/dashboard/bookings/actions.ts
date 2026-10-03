"use server";

import { revalidatePath } from "next/cache";
import {
  approveBooking, checkInBooking, checkOutBooking, markBookingPaid, rejectBooking, type DecisionResult,
} from "@/lib/bookings/host";
import { revalidatePublicPages } from "@/lib/public/revalidate";
import { dashboardContext } from "../_lib/context";

const MESSAGE: Record<Exclude<DecisionResult, { ok: true }>["reason"], string> = {
  not_found: "Booking not found.",
  already_handled: "This booking has already moved on. Refresh to see where it is now.",
  dates_taken: "Those dates were just taken by another booking. You can reject this request instead.",
};

type Result = { error: string | null };

// Every action re-derives the host from the request (dashboardContext) and
// runs through the caller's own RLS client — the functions are security
// invoker, so a booking in another organisation resolves to "not found".
async function decide(
  run: (supabase: Awaited<ReturnType<typeof dashboardContext>>["supabase"]) => Promise<DecisionResult>,
  after?: (organizationSlug: string) => void,
): Promise<Result> {
  const { supabase, organization } = await dashboardContext();
  const result = await run(supabase);
  if (!result.ok) return { error: MESSAGE[result.reason] };
  revalidatePath("/dashboard", "layout");
  after?.(organization.slug);
  return { error: null };
}

export async function approveBookingAction(bookingId: string): Promise<Result> {
  // Approval locks dates: the public stay picker's cached availability (1h)
  // must reflect the new block immediately.
  return decide((s) => approveBooking(s, String(bookingId)), revalidatePublicPages);
}

export async function rejectBookingAction(bookingId: string): Promise<Result> {
  return decide((s) => rejectBooking(s, String(bookingId)));
}

export async function markPaidAction(bookingId: string): Promise<Result> {
  return decide((s) => markBookingPaid(s, String(bookingId)));
}

export async function checkInAction(bookingId: string): Promise<Result> {
  return decide((s) => checkInBooking(s, String(bookingId)));
}

export async function checkOutAction(bookingId: string): Promise<Result> {
  return decide((s) => checkOutBooking(s, String(bookingId)));
}
