// @vitest-environment node
import { test, expect } from "vitest";
import { cleanupSeed, PNG_BYTES, seedPaidBooking, type PaidSeed } from "@/tests/hotel-eye";
import { retentionCap } from "./dates";
import { getUploadLink } from "./links";
import { submitGuestId } from "./upload";

const VALID = { name: "Sana Malik", cnic: "35202-1234567-1", phone: "0300 5550123" };
const docs = (seed: PaidSeed) => seed.service.from("guest_documents").select("*").eq("booking_id", seed.bookingId);

// @req CNIC-03
// @req CNIC-11
test("a valid submission stores name, CNIC, phone and the booking's dates, with expiry 90 days after checkout", async () => {
  const seed = await seedPaidBooking();
  expect(await submitGuestId(seed.service, { token: seed.uploadToken, ...VALID, bytes: PNG_BYTES })).toEqual({ ok: true });

  const { data: rows } = await docs(seed);
  expect(rows).toHaveLength(1);
  expect(rows![0]).toMatchObject({
    cnic_number: "35202-1234567-1", stay_start: seed.start, stay_end: seed.end,
    guest_id: seed.guestId, organization_id: seed.host.organizationId,
  });
  expect(Date.parse(rows![0].retention_expires_at)).toBe(Date.parse(retentionCap(seed.end)));
  expect(rows![0].image_path.startsWith(`${seed.host.organizationId}/${seed.bookingId}/`)).toBe(true);
  expect((await seed.service.storage.from("guest-ids").download(rows![0].image_path)).error).toBeNull();

  const { data: guest } = await seed.service.from("guests").select("name, phone").eq("id", seed.guestId).single();
  expect(guest).toEqual({ name: "Sana Malik", phone: "03005550123" });
  await cleanupSeed(seed);
});

// @req CNIC-02
test("an unknown, expired or already-used link is refused and stores nothing", async () => {
  const seed = await seedPaidBooking();
  const submit = (token: string) => submitGuestId(seed.service, { token, ...VALID, bytes: PNG_BYTES });

  expect(await submit("0".repeat(64))).toEqual({ ok: false, reason: "unknown" });
  expect(await submit("not-a-token")).toEqual({ ok: false, reason: "unknown" });

  await seed.service.from("id_upload_links").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("token", seed.uploadToken);
  expect(await submit(seed.uploadToken)).toEqual({ ok: false, reason: "expired" });
  expect((await docs(seed)).data).toHaveLength(0);

  await seed.service.from("id_upload_links").update({ expires_at: new Date(Date.now() + 3_600_000).toISOString() }).eq("token", seed.uploadToken);
  expect(await submit(seed.uploadToken)).toEqual({ ok: true });
  expect(await submit(seed.uploadToken)).toEqual({ ok: false, reason: "used" });
  expect((await docs(seed)).data).toHaveLength(1);
  await cleanupSeed(seed);
});

// @req CNIC-02
test("a link expires exactly at the start of the day after checkout (Karachi)", async () => {
  const seed = await seedPaidBooking();
  const { data } = await seed.service.from("id_upload_links").select("expires_at").eq("token", seed.uploadToken).single();
  const expiresAt = Date.parse(data!.expires_at);
  expect((await getUploadLink(seed.service, seed.uploadToken, new Date(expiresAt - 1))).status).toBe("open");
  expect((await getUploadLink(seed.service, seed.uploadToken, new Date(expiresAt))).status).toBe("expired");
  await cleanupSeed(seed);
});

test("invalid input, a non-image and an oversized file are refused and leave the link open", async () => {
  const seed = await seedPaidBooking();
  const base = { token: seed.uploadToken, ...VALID };
  expect(await submitGuestId(seed.service, { ...base, cnic: "123", bytes: PNG_BYTES })).toMatchObject({ ok: false, reason: "invalid" });
  expect(await submitGuestId(seed.service, { ...base, bytes: new TextEncoder().encode("hello, I am not an image") })).toEqual({ ok: false, reason: "bad_image" });
  const huge = new Uint8Array(4 * 1024 * 1024 + 1);
  huge.set(PNG_BYTES);
  expect(await submitGuestId(seed.service, { ...base, bytes: huge })).toEqual({ ok: false, reason: "too_large" });
  expect((await getUploadLink(seed.service, seed.uploadToken)).status).toBe("open");
  expect((await docs(seed)).data).toHaveLength(0);
  await cleanupSeed(seed);
});

test("two simultaneous submissions produce exactly one record and one stored image", async () => {
  const seed = await seedPaidBooking();
  const results = await Promise.all([
    submitGuestId(seed.service, { token: seed.uploadToken, ...VALID, bytes: PNG_BYTES }),
    submitGuestId(seed.service, { token: seed.uploadToken, ...VALID, bytes: PNG_BYTES }),
  ]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "used" }]);
  expect((await docs(seed)).data).toHaveLength(1);
  const { data: objects } = await seed.service.storage.from("guest-ids").list(`${seed.host.organizationId}/${seed.bookingId}`);
  expect(objects).toHaveLength(1);
  await cleanupSeed(seed);
});
