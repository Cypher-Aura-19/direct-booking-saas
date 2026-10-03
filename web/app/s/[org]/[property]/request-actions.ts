"use server";

import { createBookingRequest, parseBookingRequest } from "@/lib/bookings/requests";
import { localToday } from "@/lib/dashboard/analytics";
import { createServiceClient } from "@/lib/supabase/service";

export type RequestResult =
  | { ok: true; token: string; nights: number; totalCents: number }
  | { ok: false; message: string };

const GENERIC = "Something went wrong. Please try again in a moment.";

// The guest-facing entry point. Everything arrives as untrusted strings: the
// price is never among them — it is recomputed server-side by quoteStay.
export async function requestBookingAction(input: {
  propertyId: string; token: string | null; checkIn: string; checkOut: string; name: string; phone: string;
}): Promise<RequestResult> {
  const parsed = parseBookingRequest({ name: String(input?.name ?? ""), phone: String(input?.phone ?? "") });
  if ("error" in parsed) return { ok: false, message: parsed.error };
  try {
    const result = await createBookingRequest(createServiceClient(), {
      propertyId: String(input.propertyId ?? ""),
      token: typeof input.token === "string" ? input.token : null,
      name: parsed.name,
      phone: parsed.phone,
      checkIn: String(input.checkIn ?? ""),
      checkOut: String(input.checkOut ?? ""),
      today: localToday(),
    });
    if (result.ok) return { ok: true, token: result.token, nights: result.nights, totalCents: result.totalCents };
    switch (result.reason) {
      case "unavailable": return { ok: false, message: "Those dates aren't available. Try others." };
      case "minimum_stay": return { ok: false, message: `This stay needs at least ${result.minimumStay} nights.` };
      case "past": return { ok: false, message: "That check-in date has already passed." };
      case "duplicate": return { ok: false, message: "You already have a request waiting for this host. Open your chat to follow it." };
      case "rate_limited": return { ok: false, message: "This property is receiving a lot of requests right now. Please message the host directly." };
      case "not_found": return { ok: false, message: "This property isn't taking requests right now." };
      default: return { ok: false, message: "Those dates can't be requested. Pick them again." };
    }
  } catch {
    return { ok: false, message: GENERIC };
  }
}
