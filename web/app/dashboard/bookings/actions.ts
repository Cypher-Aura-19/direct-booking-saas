"use server";

import { revalidatePath } from "next/cache";
import { approveBooking, rejectBooking, type DecisionResult } from "@/lib/bookings/host";
import { revalidatePublicPages } from "@/lib/public/revalidate";
import { dashboardContext } from "../_lib/context";

const MESSAGE: Record<Exclude<DecisionResult, { ok: true }>["reason"], string> = {
  not_found: "Booking not found.",
  already_handled: "This request was already handled.",
  dates_taken: "Those dates were just taken by another booking. You can reject this request instead.",
};

export async function approveBookingAction(bookingId: string): Promise<{ error: string | null }> {
  const { supabase, organization } = await dashboardContext();
  const result = await approveBooking(supabase, String(bookingId));
  if (!result.ok) return { error: MESSAGE[result.reason] };
  revalidatePath("/dashboard", "layout");
  // Approval locks dates: the public stay picker's cached availability (1h)
  // must reflect the new block immediately.
  revalidatePublicPages(organization.slug);
  return { error: null };
}

export async function rejectBookingAction(bookingId: string): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await rejectBooking(supabase, String(bookingId));
  if (!result.ok) return { error: MESSAGE[result.reason] };
  revalidatePath("/dashboard", "layout");
  return { error: null };
}
