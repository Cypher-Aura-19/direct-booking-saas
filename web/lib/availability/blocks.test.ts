// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { createProperty } from "@/lib/properties/basics";
import { createBlock, deleteBlock, listBlocks, parseBlockInput } from "./blocks";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()!(); });

async function hostWithProperty() {
  const host = await createTestHostWithOrg();
  cleanups.push(host.cleanup);
  const { propertyId } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "River Hut", property_type: "cabin", address: "Karimabad", base_rate_cents: 900_000, max_guests: 2 },
  });
  return { host, propertyId: propertyId! };
}

describe("parseBlockInput", () => {
  it("turns an inclusive first/last night into an exclusive range", () => {
    expect(parseBlockInput({ firstNight: "2027-03-01", lastNight: "2027-03-07", today: "2026-10-01" })).toEqual({ range: { start: "2027-03-01", end: "2027-03-08" } });
  });
  it("rejects missing, reversed, past and over-long ranges", () => {
    expect(parseBlockInput({ firstNight: "", lastNight: "2027-03-07", today: "2026-10-01" })).toEqual({ error: "Enter both dates." });
    expect(parseBlockInput({ firstNight: "2027-03-07", lastNight: "2027-03-01", today: "2026-10-01" })).toEqual({ error: "The last night can't be before the first." });
    expect(parseBlockInput({ firstNight: "2026-09-01", lastNight: "2026-09-03", today: "2026-10-01" })).toEqual({ error: "You can't block dates in the past." });
    expect(parseBlockInput({ firstNight: "2027-01-01", lastNight: "2028-06-01", today: "2026-10-01" })).toEqual({ error: "Block at most 366 nights at a time." });
  });
});

// @req CAL-01
it("a host can block a date range on a property", async () => {
  const { host, propertyId } = await hostWithProperty();
  expect(await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" })).toEqual({ error: null });
  expect(await listBlocks(host.supabase, propertyId)).toMatchObject([{ start: "2027-03-01", end: "2027-03-08", reason: "manual_block" }]);
});

// @req CAL-10
it("overlapping blocks are rejected with a readable message", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" });
  expect(await createBlock(host.supabase, propertyId, { start: "2027-03-07", end: "2027-03-10" })).toEqual({ error: "Those dates overlap a block you already have." });
  expect(await createBlock(host.supabase, propertyId, { start: "2027-03-08", end: "2027-03-10" })).toEqual({ error: null });
});

// @req CAL-02
it("a host can remove a block", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" });
  const [block] = await listBlocks(host.supabase, propertyId);
  expect(await deleteBlock(host.supabase, block.id)).toEqual({ error: null });
  expect(await listBlocks(host.supabase, propertyId)).toEqual([]);
});

// @req PROP-14
it("another host cannot block, list or remove this property's dates", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" });
  const other = await createTestHostWithOrg();
  cleanups.push(other.cleanup);
  expect((await createBlock(other.supabase, propertyId, { start: "2027-05-01", end: "2027-05-02" })).error).not.toBeNull();
  expect(await listBlocks(other.supabase, propertyId)).toEqual([]);
  const [block] = await listBlocks(host.supabase, propertyId);
  expect(await deleteBlock(other.supabase, block.id)).toEqual({ error: "Block not found." });
  expect(await listBlocks(host.supabase, propertyId)).toHaveLength(1);
});
