// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { seedBookingFixture } from "@/tests/bookings";
import { cleanupSeed, insertDocument, seedPaidBooking } from "@/tests/hotel-eye";
import { recordsToCsv } from "./csv";
import { getBookingIdStatus, getRecord, listRecords, parseRange, recordImageUrl, shortenRetention } from "./records";

// @req CNIC-09
test("the register filters by stay-date overlap, inclusive at both edges", async () => {
  const seed = await seedPaidBooking();
  await insertDocument(seed, { stay: { start: "2026-12-01", end: "2026-12-03" } });
  await insertDocument(seed, { stay: { start: "2026-12-10", end: "2026-12-12" } });
  const names = async (range: { from?: string; to?: string }) => (await listRecords(seed.host.supabase, range)).map((r) => r.stayStart).sort();

  expect(await names({})).toHaveLength(2);
  expect(await names({ from: "2026-12-03", to: "2026-12-10" })).toEqual(["2026-12-01", "2026-12-10"]); // touches both edges
  expect(await names({ from: "2026-12-04", to: "2026-12-09" })).toEqual([]);
  expect(await names({ from: "2026-12-11" })).toEqual(["2026-12-10"]);
  expect(await names({ to: "2026-12-01" })).toEqual(["2026-12-01"]);
  await cleanupSeed(seed);
});

test("parseRange keeps valid ISO dates and drops the rest", () => {
  expect(parseRange("2026-12-01", "2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  expect(parseRange("nope", "")).toEqual({});
  expect(parseRange(null, undefined)).toEqual({});
});

// @req CNIC-10
test("an export is built from the host's own range and never includes another organisation's records", async () => {
  const a = await seedPaidBooking();
  const b = await seedPaidBooking();
  await insertDocument(a, { stay: { start: "2026-12-01", end: "2026-12-03" } });
  await insertDocument(b, { stay: { start: "2026-12-02", end: "2026-12-04" } });

  const rows = await listRecords(a.host.supabase, { from: "2026-12-01", to: "2026-12-31" });
  expect(rows).toHaveLength(1);
  const csv = recordsToCsv(rows);
  expect(csv.trimEnd().split("\r\n")).toHaveLength(2); // header + one row
  await cleanupSeed(a);
  await cleanupSeed(b);
});

// @req CNIC-05
test("the host gets a working short-lived signed URL; another organisation gets none", async () => {
  const a = await seedPaidBooking();
  const b = await seedBookingFixture();
  const { path } = await insertDocument(a);

  const url = await recordImageUrl(a.host.supabase, path);
  expect(url).toContain("token=");
  expect((await fetch(url!)).status).toBe(200);
  expect(await recordImageUrl(b.host.supabase, path)).toBeNull();

  const short = await recordImageUrl(a.host.supabase, path, 1);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  expect((await fetch(short!)).status).not.toBe(200);
  await cleanupSeed(a);
  await b.host.cleanup();
});

// @req CNIC-12
test("shortenRetention accepts an earlier date up to the cap, and refuses the past, beyond-cap, bad input and other orgs", async () => {
  const a = await seedPaidBooking();
  const b = await seedBookingFixture();
  const { documentId } = await insertDocument(a);
  const now = new Date();

  expect(await shortenRetention(a.host.supabase, documentId, addDays(a.end, 10), now)).toMatchObject({ ok: true });
  expect(await shortenRetention(a.host.supabase, documentId, addDays(a.end, 90), now)).toMatchObject({ ok: true }); // the cap day itself
  expect(await shortenRetention(a.host.supabase, documentId, addDays(a.end, 91), now)).toEqual({ ok: false, reason: "beyond_cap" });
  expect(await shortenRetention(a.host.supabase, documentId, addDays(localToday(), -1), now)).toEqual({ ok: false, reason: "in_past" });
  expect(await shortenRetention(a.host.supabase, documentId, "soon", now)).toEqual({ ok: false, reason: "invalid" });
  expect(await shortenRetention(b.host.supabase, documentId, addDays(a.end, 10), now)).toEqual({ ok: false, reason: "not_found" });
  await cleanupSeed(a);
  await b.host.cleanup();
});

// @req CNIC-15
test("another organisation sees no records and cannot fetch one by id", async () => {
  const a = await seedPaidBooking();
  const b = await seedBookingFixture();
  const { documentId } = await insertDocument(a);
  expect(await listRecords(b.host.supabase)).toEqual([]);
  expect(await getRecord(b.host.supabase, documentId)).toBeNull();
  expect(await getRecord(a.host.supabase, documentId)).toMatchObject({ id: documentId, guestName: "Ayesha Khan" });
  expect(await getRecord(a.host.supabase, "not-a-uuid")).toBeNull();
  await cleanupSeed(a);
  await b.host.cleanup();
});

test("a booking's ID status moves none -> open -> received, and shows expired links", async () => {
  const seed = await seedPaidBooking();
  expect(await getBookingIdStatus(seed.host.supabase, seed.bookingId)).toEqual({ state: "open", path: `/id/${seed.uploadToken}` });
  const { documentId } = await insertDocument(seed);
  expect(await getBookingIdStatus(seed.host.supabase, seed.bookingId)).toEqual({ state: "received", recordId: documentId });
  await seed.service.from("guest_documents").delete().eq("id", documentId);
  await seed.service.from("id_upload_links").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("token", seed.uploadToken);
  expect(await getBookingIdStatus(seed.host.supabase, seed.bookingId)).toEqual({ state: "expired" });
  await seed.service.from("id_upload_links").delete().eq("token", seed.uploadToken);
  expect(await getBookingIdStatus(seed.host.supabase, seed.bookingId)).toEqual({ state: "none" });
  await cleanupSeed(seed);
});
