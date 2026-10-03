import { addDays } from "@/lib/availability/dates";
import { approveBooking, markBookingPaid } from "@/lib/bookings/host";
import { localToday } from "@/lib/dashboard/analytics";
import { retentionCap } from "@/lib/hotel-eye/dates";
import { insertRequestedBooking, seedBookingFixture } from "./bookings";

// A real 1x1 PNG (only its magic bytes matter to the app, but keep it valid).
export const PNG_BYTES = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

// A host, a published property, and a booking taken all the way to `paid`,
// so its upload link exists. `token` is the guest CHAT token; `uploadToken`
// is the ID-upload link token.
export async function seedPaidBooking(opts: { startOffset?: number; nights?: number } = {}) {
  const fixture = await seedBookingFixture();
  const start = addDays(localToday(), opts.startOffset ?? 30);
  const end = addDays(start, opts.nights ?? 3);
  const booking = await insertRequestedBooking(fixture.service, {
    propertyId: fixture.propertyId, organizationId: fixture.host.organizationId, start, end,
  });
  if (!(await approveBooking(fixture.host.supabase, booking.bookingId)).ok) throw new Error("could not approve");
  if (!(await markBookingPaid(fixture.host.supabase, booking.bookingId)).ok) throw new Error("could not mark paid");

  const { data: link, error: linkError } = await fixture.service
    .from("id_upload_links").select("token").eq("booking_id", booking.bookingId).single();
  if (linkError) throw linkError;
  const { data: row, error: rowError } = await fixture.service
    .from("bookings").select("guest_id").eq("id", booking.bookingId).single();
  if (rowError) throw rowError;
  return { ...fixture, ...booking, start, end, uploadToken: link.token as string, guestId: row.guest_id as string };
}
export type PaidSeed = Awaited<ReturnType<typeof seedPaidBooking>>;

// Writes an image object and a guest_documents row for a seeded booking. With
// `stay` the row is a standalone extra record (no booking_id) for date-range
// tests.
export async function insertDocument(
  seed: PaidSeed,
  over: { retention?: string; stay?: { start: string; end: string } } = {},
) {
  const stay = over.stay ?? { start: seed.start, end: seed.end };
  const folder = over.stay ? "extra" : seed.bookingId;
  const path = `${seed.host.organizationId}/${folder}/${crypto.randomUUID()}.png`;
  const upload = await seed.service.storage.from("guest-ids").upload(path, PNG_BYTES, { contentType: "image/png" });
  if (upload.error) throw upload.error;
  const { data, error } = await seed.service
    .from("guest_documents")
    .insert({
      guest_id: seed.guestId,
      organization_id: seed.host.organizationId,
      booking_id: over.stay ? null : seed.bookingId,
      image_path: path,
      cnic_number: "35202-1234567-1",
      stay_start: stay.start,
      stay_end: stay.end,
      retention_expires_at: over.retention ?? retentionCap(stay.end),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { documentId: data.id as string, path };
}

// Removes the seed's stored images (deleting the user cascades the rows but
// not storage objects), then the host.
export async function cleanupSeed(seed: PaidSeed) {
  const bucket = seed.service.storage.from("guest-ids");
  for (const folder of [seed.bookingId, "extra"]) {
    const { data } = await bucket.list(`${seed.host.organizationId}/${folder}`);
    if (data?.length) await bucket.remove(data.map((o) => `${seed.host.organizationId}/${folder}/${o.name}`));
  }
  await seed.host.cleanup();
}
