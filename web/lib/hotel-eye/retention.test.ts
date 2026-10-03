// @vitest-environment node
import { test, expect } from "vitest";
import { cleanupSeed, insertDocument, seedPaidBooking } from "@/tests/hotel-eye";
import { deleteExpired } from "./retention";

// @req CNIC-13
test("the retention job deletes expired records and their images, keeps the rest, and a rerun is a no-op", async () => {
  const seed = await seedPaidBooking();
  const expired = await insertDocument(seed, { stay: { start: "2026-01-01", end: "2026-01-03" }, retention: "2026-01-02T00:00:00.000Z" });
  const kept = await insertDocument(seed);

  const result = await deleteExpired(seed.service, new Date("2026-06-01T00:00:00.000Z"));
  expect(result.rows).toBeGreaterThanOrEqual(1);
  expect(result.failed).toBe(0);

  const { data: gone } = await seed.service.from("guest_documents").select("id").eq("id", expired.documentId);
  expect(gone).toEqual([]);
  expect((await seed.service.storage.from("guest-ids").download(expired.path)).error).not.toBeNull();

  const { data: still } = await seed.service.from("guest_documents").select("id").eq("id", kept.documentId);
  expect(still).toHaveLength(1);
  expect((await seed.service.storage.from("guest-ids").download(kept.path)).error).toBeNull();

  expect(await deleteExpired(seed.service, new Date("2026-06-01T00:00:00.000Z"))).toEqual({ rows: 0, images: 0, failed: 0 });
  await cleanupSeed(seed);
});

// @req CNIC-13
test("a record whose image is already gone is still deleted", async () => {
  const seed = await seedPaidBooking();
  const doc = await insertDocument(seed, { stay: { start: "2026-01-01", end: "2026-01-03" }, retention: "2026-01-02T00:00:00.000Z" });
  await seed.service.storage.from("guest-ids").remove([doc.path]);
  const result = await deleteExpired(seed.service, new Date("2026-06-01T00:00:00.000Z"));
  expect(result.failed).toBe(0);
  expect((await seed.service.from("guest_documents").select("id").eq("id", doc.documentId)).data).toEqual([]);
  await cleanupSeed(seed);
});
