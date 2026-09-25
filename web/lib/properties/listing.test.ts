// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { createProperty } from "./basics";
import { AMENITIES, amenityLabel, getListing, parseListing, updateListing } from "./listing";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function hostWithProperty() {
  const host = await createTestHostWithOrg();
  cleanups.push(host.cleanup);
  const { propertyId } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "River Hut", property_type: "cabin", address: "Karimabad", base_rate_cents: 900_000, max_guests: 2 },
  });
  return { host, propertyId: propertyId! };
}

describe("parseListing", () => {
  it("trims the description and keeps only known amenities, deduplicated and in catalogue order", () => {
    const result = parseListing({ description: "  Quiet rooms  ", amenities: ["parking", "wifi", "wifi"] });
    expect(result).toEqual({ listing: { description: "Quiet rooms", amenities: ["wifi", "parking"] } });
  });

  it("rejects an unknown amenity and an over-long description", () => {
    expect(parseListing({ description: "", amenities: ["jacuzzi"] })).toEqual({ error: "Unknown amenity: jacuzzi" });
    expect(parseListing({ description: "a".repeat(2001), amenities: [] })).toEqual({
      error: "The description must be 2,000 characters or fewer.",
    });
  });

  it("labels every amenity", () => {
    for (const { value, label } of AMENITIES) expect(amenityLabel(value)).toBe(label);
  });
});

// @req PUB-02
it("a host can save a description and amenities, and read them back", async () => {
  const { host, propertyId } = await hostWithProperty();
  const result = await updateListing(host.supabase, propertyId, { description: "Views of Rakaposhi", amenities: ["wifi", "hot_water"] });
  expect(result).toEqual({ error: null });
  expect(await getListing(host.supabase, propertyId)).toEqual({ description: "Views of Rakaposhi", amenities: ["wifi", "hot_water"] });
});

// @req PUB-02
it("every amenity in the catalogue is accepted by the database", async () => {
  const { host, propertyId } = await hostWithProperty();
  const all = AMENITIES.map((a) => a.value);
  expect(await updateListing(host.supabase, propertyId, { description: "", amenities: all })).toEqual({ error: null });
  expect((await getListing(host.supabase, propertyId))?.amenities).toEqual(all);
});

// @req PROP-14
it("a host cannot change another organisation's listing", async () => {
  const { host: owner, propertyId } = await hostWithProperty();
  const other = await createTestHostWithOrg();
  cleanups.push(other.cleanup);
  await updateListing(other.supabase, propertyId, { description: "Hijacked", amenities: [] });
  expect((await getListing(owner.supabase, propertyId))?.description).toBe("");
});
