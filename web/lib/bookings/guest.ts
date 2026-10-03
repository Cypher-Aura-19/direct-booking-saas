import type { SupabaseClient } from "@supabase/supabase-js";
import { nightsBetween } from "../availability/dates";
import { getConversation, isToken } from "../chat/conversations";
import type { BookingStatus } from "./host";
import { readPaymentInstructions, type PaymentInstructions } from "./payment-instructions";

export type GuestBookingView = {
  status: BookingStatus;
  startDate: string;
  endDate: string;
  nights: number;
  totalCents: number;
  advancePercent: number;
  advanceCents: number;
  paymentInstructions: PaymentInstructions | null;
};

// Resolved strictly through the guest's own conversation token. The org's
// payment instructions are read only for an `approved` booking — never for a
// pending or declined one (BOOK-12).
export async function getGuestBookingView(service: SupabaseClient, token: string): Promise<GuestBookingView | null> {
  if (!isToken(token)) return null;
  const conversation = await getConversation(service, token);
  if (!conversation) return null;

  const { data: booking, error } = await service
    .from("bookings")
    .select("status, start_date, end_date, total_price_cents, properties(advance_percent, organizations(payment_instructions))")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!booking) return null;

  const property = (Array.isArray(booking.properties) ? booking.properties[0] : booking.properties) as
    | { advance_percent: number; organizations: { payment_instructions: unknown } | { payment_instructions: unknown }[] | null }
    | null;
  const organization = property ? (Array.isArray(property.organizations) ? property.organizations[0] : property.organizations) : null;
  const advancePercent = property?.advance_percent ?? 0;

  return {
    status: booking.status as BookingStatus,
    startDate: booking.start_date,
    endDate: booking.end_date,
    nights: nightsBetween(booking.start_date, booking.end_date),
    totalCents: booking.total_price_cents,
    advancePercent,
    advanceCents: Math.round((booking.total_price_cents * advancePercent) / 100),
    paymentInstructions: booking.status === "approved" ? readPaymentInstructions(organization?.payment_instructions) : null,
  };
}
