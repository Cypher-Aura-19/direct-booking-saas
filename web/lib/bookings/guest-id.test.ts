// @vitest-environment node
import { test, expect } from "vitest";
import { approveBooking } from "@/lib/bookings/host";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { submitGuestId } from "@/lib/hotel-eye/upload";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { cleanupSeed, PNG_BYTES, seedPaidBooking } from "@/tests/hotel-eye";
import { getGuestBookingView } from "./guest";

// @req CNIC-01
test("the guest's booking view offers the upload link once paid, 'received' after upload, and nothing once it expires", async () => {
  const seed = await seedPaidBooking();
  const view = await getGuestBookingView(seed.service, seed.token!);
  expect(view!.idUpload).toEqual({ status: "open", path: `/id/${seed.uploadToken}` });

  await submitGuestId(seed.service, { token: seed.uploadToken, name: "Sana Malik", cnic: "3520212345671", phone: "03005550123", bytes: PNG_BYTES });
  expect((await getGuestBookingView(seed.service, seed.token!))!.idUpload).toEqual({ status: "received" });
  await cleanupSeed(seed);

  const expired = await seedPaidBooking();
  await expired.service.from("id_upload_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token", expired.uploadToken);
  expect((await getGuestBookingView(expired.service, expired.token!))!.idUpload).toBeNull();
  await cleanupSeed(expired);
});

test("before payment there is no upload prompt", async () => {
  const fixture = await seedBookingFixture();
  const start = addDays(localToday(), 30);
  const booking = await insertRequestedBooking(fixture.service, {
    propertyId: fixture.propertyId, organizationId: fixture.host.organizationId, start, end: addDays(start, 2),
  });
  await approveBooking(fixture.host.supabase, booking.bookingId);
  expect((await getGuestBookingView(fixture.service, booking.token!))!.idUpload).toBeNull();
  await fixture.host.cleanup();
});
