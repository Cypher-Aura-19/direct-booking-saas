import type { SupabaseClient } from "@supabase/supabase-js";
import { createProperty, setPropertyPublished } from "@/lib/properties/basics";
import { getConversation, startConversation } from "@/lib/chat/conversations";
import { createTestHostWithOrg, supabaseAdmin } from "./helpers";

// A signed-in host with an org and one published property, plus the service
// client guest-side code uses.
export async function seedBookingFixture() {
  const host = await createTestHostWithOrg();
  const { propertyId, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Booking Test Cabin", property_type: "cabin", address: "Somewhere", base_rate_cents: 500_000, max_guests: 4 },
  });
  if (error) throw new Error(error);
  await setPropertyPublished(host.supabase, propertyId!, true);
  return { host, service: supabaseAdmin(), propertyId: propertyId! };
}

// Inserts a `requested` booking directly (bypassing the guest request flow),
// optionally on a fresh enquiry conversation.
export async function insertRequestedBooking(
  service: SupabaseClient,
  f: { propertyId: string; organizationId: string; start: string; end: string; totalCents?: number; name?: string; withConversation?: boolean },
) {
  const { data: guest, error: guestError } = await service
    .from("guests")
    .insert({ organization_id: f.organizationId, name: f.name ?? "Ayesha Khan", phone: "03001234567" })
    .select("id")
    .single();
  if (guestError) throw guestError;

  let conversationId: string | null = null;
  let token: string | null = null;
  if (f.withConversation !== false) {
    const started = await startConversation(service, f.propertyId);
    if (!("token" in started)) throw new Error("could not start conversation");
    token = started.token;
    conversationId = (await getConversation(service, token))!.id;
  }

  const { data: booking, error } = await service
    .from("bookings")
    .insert({
      property_id: f.propertyId,
      conversation_id: conversationId,
      guest_id: guest.id,
      start_date: f.start,
      end_date: f.end,
      total_price_cents: f.totalCents ?? 1_500_000,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { bookingId: booking.id as string, conversationId, token };
}
