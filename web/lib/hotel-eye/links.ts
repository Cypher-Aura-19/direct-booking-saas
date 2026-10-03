import type { SupabaseClient } from "@supabase/supabase-js";

export const isUploadToken = (value: string): boolean => /^[0-9a-f]{64}$/.test(value);

export type UploadLink = {
  status: "open" | "used" | "expired";
  token: string;
  bookingId: string;
  organizationId: string;
  guestId: string;
  startDate: string;
  endDate: string;
  guestName: string;
  guestPhone: string | null;
  propertyName: string;
  hostName: string;
};
export type UploadLinkLookup = { status: "unknown" } | UploadLink;

type Row = {
  token: string;
  expires_at: string;
  used_at: string | null;
  booking_id: string;
  organization_id: string;
  bookings: BookingPart | BookingPart[] | null;
};
type BookingPart = {
  start_date: string;
  end_date: string;
  guest_id: string;
  guests: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
  properties: { name: string; organizations: { name: string } | { name: string }[] | null } | { name: string; organizations: { name: string } | { name: string }[] | null }[] | null;
};
const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

// Guest side: takes the service client. Possession of the unguessable token is
// the credential; nothing here returns data for any other booking.
export async function getUploadLink(service: SupabaseClient, token: string, now: Date = new Date()): Promise<UploadLinkLookup> {
  if (!isUploadToken(token)) return { status: "unknown" };
  const { data, error } = await service
    .from("id_upload_links")
    .select("token, expires_at, used_at, booking_id, organization_id, bookings(start_date, end_date, guest_id, guests(name, phone), properties(name, organizations(name)))")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { status: "unknown" };

  const row = data as unknown as Row;
  const booking = one(row.bookings);
  if (!booking) return { status: "unknown" };
  const guest = one(booking.guests);
  const property = one(booking.properties);
  const organization = property ? one(property.organizations) : null;

  return {
    status: row.used_at ? "used" : Date.parse(row.expires_at) <= now.getTime() ? "expired" : "open",
    token: row.token,
    bookingId: row.booking_id,
    organizationId: row.organization_id,
    guestId: booking.guest_id,
    startDate: booking.start_date,
    endDate: booking.end_date,
    guestName: guest?.name ?? "",
    guestPhone: guest?.phone ?? null,
    propertyName: property?.name ?? "",
    hostName: organization?.name ?? "",
  };
}
