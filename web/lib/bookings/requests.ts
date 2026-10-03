import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isIsoDate } from "../availability/dates";
import { quoteStay } from "../availability/quote";
import { addMessage, getConversation, isToken, startConversation, type Conversation } from "../chat/conversations";
import { formatRupees } from "../properties/basics";

export const MAX_REQUESTS_PER_PROPERTY_PER_DAY = 30;

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const shortDate = (iso: string) => SHORT_DATE.format(new Date(`${iso}T00:00:00Z`));
// The public picker offers the next 12 months only (stay-picker.tsx).
const HORIZON_DAYS = 366;

export function parseBookingRequest(input: { name: string; phone: string }): { name: string; phone: string } | { error: string } {
  const name = String(input.name ?? "").trim();
  if (!name) return { error: "Enter your name." };
  if (name.length > 80) return { error: "Your name can be up to 80 characters." };
  const phone = String(input.phone ?? "").replace(/[\s-]/g, "");
  if (!/^\+?\d{7,15}$/.test(phone)) return { error: "Enter a phone number the host can reach, e.g. 0300 1234567." };
  return { name, phone };
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; token: string; nights: number; totalCents: number }
  | { ok: false; reason: "not_found" | "invalid" | "past" | "unavailable" | "minimum_stay" | "duplicate" | "rate_limited"; minimumStay?: number };

type Input = { propertyId: string; token: string | null; name: string; phone: string; checkIn: string; checkOut: string; today: string };

// Guest-side: takes the service client (anon has no grant on bookings/guests).
// There is deliberately no price parameter: the total is quoteStay's, computed
// here against live blocks and seasonal rules (BOOK-04).
export async function createBookingRequest(service: SupabaseClient, input: Input): Promise<CreateBookingResult> {
  const { propertyId, checkIn, checkOut, today } = input;

  // Never trust the caller to have normalised the contact details.
  const contact = parseBookingRequest({ name: input.name, phone: input.phone });
  if ("error" in contact) return { ok: false, reason: "invalid" };

  const { data: property, error: propertyError } = await service
    .from("properties")
    .select("id, organization_id, name, base_rate_cents, minimum_stay")
    .eq("id", propertyId)
    .eq("published", true)
    .maybeSingle();
  if (propertyError) {
    if (propertyError.code === "22P02") return { ok: false, reason: "not_found" };
    throw propertyError;
  }
  if (!property) return { ok: false, reason: "not_found" };

  if (!isIsoDate(checkIn) || !isIsoDate(checkOut) || checkOut <= checkIn || checkOut > addDays(today, HORIZON_DAYS)) {
    return { ok: false, reason: "invalid" };
  }

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count, error: countError } = await service
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .gte("created_at", dayAgo);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_REQUESTS_PER_PROPERTY_PER_DAY) return { ok: false, reason: "rate_limited" };

  const [blocks, rules] = await Promise.all([
    service.from("availability_blocks").select("start_date, end_date").eq("property_id", propertyId).lt("start_date", checkOut).gt("end_date", checkIn),
    service.from("seasonal_pricing_rules").select("start_date, end_date, rate_cents, minimum_stay").eq("property_id", propertyId).lt("start_date", checkOut).gt("end_date", checkIn),
  ]);
  if (blocks.error) throw blocks.error;
  if (rules.error) throw rules.error;

  const quote = quoteStay(checkIn, checkOut, {
    baseRateCents: property.base_rate_cents,
    minimumStay: property.minimum_stay,
    rules: (rules.data ?? []).map((r) => ({ start: r.start_date, end: r.end_date, rateCents: r.rate_cents, minimumStay: r.minimum_stay })),
    blocks: (blocks.data ?? []).map((b) => ({ start: b.start_date, end: b.end_date })),
    today,
  });
  if (!quote.ok) return { ok: false, reason: quote.reason, minimumStay: quote.minimumStay };

  // Reuse this browser's enquiry conversation for this property if it has one;
  // a conversation already in payment/stay can't go back (forward-only state
  // machine), so those get a fresh conversation.
  let conversation: Conversation | null = null;
  let token = input.token;
  if (token && isToken(token)) {
    const existing = await getConversation(service, token);
    if (existing && existing.propertyId === propertyId && existing.aiState === "enquiry") conversation = existing;
  }
  if (!conversation) {
    const started = await startConversation(service, propertyId);
    if (!("token" in started)) return { ok: false, reason: "not_found" };
    token = started.token;
    conversation = await getConversation(service, token);
    if (!conversation) return { ok: false, reason: "not_found" };
  }

  const { data: guest, error: guestError } = await service
    .from("guests")
    .insert({ organization_id: property.organization_id, name: contact.name, phone: contact.phone })
    .select("id")
    .single();
  if (guestError) throw guestError;

  const { data: booking, error: bookingError } = await service
    .from("bookings")
    .insert({
      property_id: propertyId,
      conversation_id: conversation.id,
      guest_id: guest.id,
      start_date: checkIn,
      end_date: checkOut,
      total_price_cents: quote.totalCents,
    })
    .select("id")
    .single();
  if (bookingError) {
    await service.from("guests").delete().eq("id", guest.id); // no orphan guest
    if (bookingError.code === "23505") return { ok: false, reason: "duplicate" }; // one open booking per conversation
    throw bookingError;
  }

  // Surfaces the request in the host's inbox (and its unread count).
  await addMessage(
    service,
    conversation.id,
    "guest",
    `Booking request: ${shortDate(checkIn)} to ${shortDate(checkOut)} (${quote.nights} ${quote.nights === 1 ? "night" : "nights"}, ${formatRupees(quote.totalCents)}).`,
  );

  return { ok: true, bookingId: booking.id as string, token: token as string, nights: quote.nights, totalCents: quote.totalCents };
}
