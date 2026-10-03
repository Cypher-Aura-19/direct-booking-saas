// @vitest-environment node
import { test, expect, beforeEach, afterEach } from "vitest";
import { cleanupSeed, insertDocument, seedPaidBooking } from "@/tests/hotel-eye";
import { GET } from "./route";

const request = (authorization?: string) => new Request("http://localhost/api/cron/retention", { headers: authorization ? { authorization } : {} });

beforeEach(() => { process.env.CRON_SECRET = "test-cron-secret"; });
afterEach(() => { delete process.env.CRON_SECRET; });

// @req CNIC-13
test("the route refuses a missing or wrong secret and does nothing", async () => {
  const seed = await seedPaidBooking();
  const doc = await insertDocument(seed, { stay: { start: "2025-01-01", end: "2025-01-03" }, retention: "2025-01-02T00:00:00.000Z" });

  expect((await GET(request())).status).toBe(401);
  expect((await GET(request("Bearer wrong"))).status).toBe(401);
  delete process.env.CRON_SECRET;
  expect((await GET(request("Bearer undefined"))).status).toBe(401); // no secret configured: always refused

  expect((await seed.service.from("guest_documents").select("id").eq("id", doc.documentId)).data).toHaveLength(1);
  await cleanupSeed(seed);
});

// @req CNIC-13
test("with the right secret the route deletes expired records and their images", async () => {
  const seed = await seedPaidBooking();
  const doc = await insertDocument(seed, { stay: { start: "2025-01-01", end: "2025-01-03" }, retention: "2025-01-02T00:00:00.000Z" });

  const response = await GET(request("Bearer test-cron-secret"));
  expect(response.status).toBe(200);
  expect((await response.json()).rows).toBeGreaterThanOrEqual(1);
  expect((await seed.service.from("guest_documents").select("id").eq("id", doc.documentId)).data).toEqual([]);
  expect((await seed.service.storage.from("guest-ids").download(doc.path)).error).not.toBeNull();
  await cleanupSeed(seed);
});
