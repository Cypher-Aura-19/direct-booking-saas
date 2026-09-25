// @vitest-environment node
import { test, it, expect } from "vitest";
import {
  parsePropertyBasics,
  slugifyPropertyName,
  formatRupees,
  createProperty,
  listProperties,
  getProperty,
  updatePropertyBasics,
  setPropertyPublished,
  publicPropertyPath,
  publicCatalogueUrl,
  publicPropertyUrl,
  type PropertyBasics,
} from "./basics";
import { anonClient, createTestHostWithOrg } from "../../tests/helpers";

const SUNSET: PropertyBasics = {
  name: "Sunset Villa",
  property_type: "villa",
  address: "Mall Road, Murree",
  base_rate_cents: 1_500_000,
  max_guests: 4,
};

test("parsePropertyBasics converts rupees to paisa and trims text", () => {
  const parsed = parsePropertyBasics({
    name: "  Sunset Villa ",
    propertyType: "villa",
    address: " Mall Road, Murree ",
    baseRate: "15000",
    maxGuests: "4",
  });
  expect(parsed).toEqual({ ok: true, value: SUNSET });
});

test("parsePropertyBasics rejects each invalid field with a readable message", () => {
  const valid = { name: "A", propertyType: "villa", address: "B", baseRate: "100", maxGuests: "2" };
  expect(parsePropertyBasics({ ...valid, name: " " })).toMatchObject({ ok: false, error: expect.stringMatching(/name/i) });
  expect(parsePropertyBasics({ ...valid, propertyType: "castle" })).toMatchObject({ ok: false, error: expect.stringMatching(/type/i) });
  expect(parsePropertyBasics({ ...valid, address: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/address/i) });
  expect(parsePropertyBasics({ ...valid, baseRate: "0" })).toMatchObject({ ok: false, error: expect.stringMatching(/rate/i) });
  expect(parsePropertyBasics({ ...valid, baseRate: "99.5" })).toMatchObject({ ok: false, error: expect.stringMatching(/rate/i) });
  expect(parsePropertyBasics({ ...valid, maxGuests: "51" })).toMatchObject({ ok: false, error: expect.stringMatching(/guests/i) });
});

test("slugifyPropertyName produces URL-safe slugs and gives up cleanly on non-Latin names", () => {
  expect(slugifyPropertyName("Sunset Villa — Murree!")).toBe("sunset-villa-murree");
  expect(slugifyPropertyName("Café Hunza")).toBe("cafe-hunza");
  expect(slugifyPropertyName("سن سیٹ ولا")).toBe("");
  expect(slugifyPropertyName("a".repeat(60)).length).toBeLessThanOrEqual(40);
});

test("formatRupees shows whole rupees with thousands separators", () => {
  expect(formatRupees(1_500_000)).toBe("Rs 15,000");
});

// @req PUB-05
it("public URLs use the stay origin when configured and /s/ otherwise", () => {
  const previous = process.env.NEXT_PUBLIC_STAY_ORIGIN;
  try {
    delete process.env.NEXT_PUBLIC_STAY_ORIGIN;
    expect(publicPropertyUrl("altit", "river-hut")).toBe("/s/altit/river-hut");
    expect(publicCatalogueUrl("altit")).toBe("/s/altit");
    process.env.NEXT_PUBLIC_STAY_ORIGIN = "https://stay.example.pk/";
    expect(publicPropertyUrl("altit", "river-hut")).toBe("https://stay.example.pk/altit/river-hut");
    expect(publicCatalogueUrl("altit")).toBe("https://stay.example.pk/altit");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_STAY_ORIGIN;
    else process.env.NEXT_PUBLIC_STAY_ORIGIN = previous;
  }
});

// @req PROP-01
test("a host can create a property with name, type, address, base rate and max guests", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { error, propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: SUNSET,
    });
    expect(error).toBeNull();
    const property = await getProperty(host.supabase, propertyId!);
    expect(property).toMatchObject({ ...SUNSET, slug: "sunset-villa", published: false });
  } finally {
    await host.cleanup();
  }
});

test("getProperty returns null for a malformed id instead of throwing", async () => {
  const host = await createTestHostWithOrg();
  try {
    expect(await getProperty(host.supabase, "not-a-uuid")).toBeNull();
  } finally {
    await host.cleanup();
  }
});

test("a second property with the same name gets a different slug", async () => {
  const host = await createTestHostWithOrg();
  try {
    const first = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    const second = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    expect(second.error).toBeNull();
    const a = await getProperty(host.supabase, first.propertyId!);
    const b = await getProperty(host.supabase, second.propertyId!);
    expect(b!.slug).not.toBe(a!.slug);
    expect(b!.slug).toMatch(/^sunset-villa-[0-9a-f]{4}$/);
  } finally {
    await host.cleanup();
  }
});

test("a property named only in Urdu still gets a working slug", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { ...SUNSET, name: "سن سیٹ ولا" },
    });
    const property = await getProperty(host.supabase, propertyId!);
    expect(property!.slug).toMatch(/^p-[0-9a-f]{8}$/);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-02
test("a host can edit a property's basics", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    const edited: PropertyBasics = {
      name: "Sunset Cabin",
      property_type: "cabin",
      address: "Nathia Gali",
      base_rate_cents: 2_000_000,
      max_guests: 6,
    };
    const { error } = await updatePropertyBasics(host.supabase, propertyId!, edited);
    expect(error).toBeNull();
    expect(await getProperty(host.supabase, propertyId!)).toMatchObject(edited);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-03
test("a host can publish and unpublish a property", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    expect((await setPropertyPublished(host.supabase, propertyId!, true)).error).toBeNull();
    expect((await getProperty(host.supabase, propertyId!))!.published).toBe(true);
    expect((await setPropertyPublished(host.supabase, propertyId!, false)).error).toBeNull();
    expect((await getProperty(host.supabase, propertyId!))!.published).toBe(false);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-04
test("an unpublished property is not readable by the public; a published one is, minus its knowledge base", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    const anon = anonClient();

    const draft = await anon.from("properties").select("id, name, slug").eq("id", propertyId!);
    expect(draft.error).toBeNull();
    expect(draft.data).toEqual([]);

    await setPropertyPublished(host.supabase, propertyId!, true);
    const published = await anon.from("properties").select("id, name, slug").eq("id", propertyId!);
    expect(published.data).toHaveLength(1);

    const secrets = await anon.from("properties").select("knowledge_base").eq("id", propertyId!);
    expect(secrets.error?.code).toBe("42501");

    await setPropertyPublished(host.supabase, propertyId!, false);
    const unpublished = await anon.from("properties").select("id").eq("id", propertyId!);
    expect(unpublished.data).toEqual([]);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-14
test("a host cannot read, list, edit, publish or add to another organisation's properties", async () => {
  const owner = await createTestHostWithOrg();
  const intruder = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(owner.supabase, { organizationId: owner.organizationId, basics: SUNSET });

    expect(await getProperty(intruder.supabase, propertyId!)).toBeNull();
    expect(await listProperties(intruder.supabase, owner.organizationId)).toEqual([]);
    expect((await updatePropertyBasics(intruder.supabase, propertyId!, { ...SUNSET, name: "Hijacked" })).error).not.toBeNull();
    expect((await setPropertyPublished(intruder.supabase, propertyId!, true)).error).not.toBeNull();
    expect(
      (await createProperty(intruder.supabase, { organizationId: owner.organizationId, basics: SUNSET })).error,
    ).not.toBeNull();

    // Nothing changed, as seen by the owner.
    expect(await getProperty(owner.supabase, propertyId!)).toMatchObject({ name: "Sunset Villa", published: false });
    expect(await listProperties(owner.supabase, owner.organizationId)).toHaveLength(1);
  } finally {
    await owner.cleanup();
    await intruder.cleanup();
  }
});

// @req PROP-15
test("the property list carries each property's published state and slug for its public link", async () => {
  const host = await createTestHostWithOrg();
  try {
    const a = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { ...SUNSET, name: "River Hut" },
    });
    await setPropertyPublished(host.supabase, a.propertyId!, true);

    const list = await listProperties(host.supabase, host.organizationId);
    expect(list.map((p) => [p.name, p.published])).toEqual([
      ["Sunset Villa", true],
      ["River Hut", false],
    ]);
    expect(publicPropertyPath(host.organizationSlug, list[0].slug)).toBe(
      `/s/${host.organizationSlug}/sunset-villa`,
    );
  } finally {
    await host.cleanup();
  }
});
