// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { anonClient, createTestHostWithOrg, supabaseAdmin } from "@/tests/helpers";
import { createProperty } from "@/lib/properties/basics";
import { PHOTO_WIDTHS } from "@/lib/properties/photo-variants";
import { uploadPropertyPhoto } from "@/lib/properties/photos";
import { updateListing } from "@/lib/properties/listing";
import { getPublicOrganization, getPublishedProperty, listPublishedProperties, telLink, whatsappLink } from "./catalogue";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

// Same 1x1 PNG the M4 photo tests use: the bucket only checks MIME type, but a real image keeps this honest.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const image = () => new Blob([PNG], { type: "image/png" });
const webp = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

async function hostWithCatalogue() {
  const host = await createTestHostWithOrg();
  cleanups.unshift(host.cleanup); // runs last: objects are removed before the user
  await host.supabase
    .from("organizations")
    .update({ profile: { city: "Hunza", phone: "0300 1234567", headline: "Cabins above the river" } })
    .eq("id", host.organizationId);
  const make = async (name: string, published: boolean) => {
    const { propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { name, property_type: "cabin", address: "Secret lane 4", base_rate_cents: 1_500_000, max_guests: 4 },
    });
    if (published) await host.supabase.from("properties").update({ published: true }).eq("id", propertyId!);
    // Deleting the user cascades rows but not storage objects.
    cleanups.push(async () => {
      const admin = supabaseAdmin();
      const { data } = await admin.storage.from("property-photos").list(propertyId!);
      if (data?.length) await admin.storage.from("property-photos").remove(data.map((o) => `${propertyId}/${o.name}`));
    });
    return propertyId!;
  };
  const publishedId = await make("River Hut", true);
  const draftId = await make("Unfinished Loft", false);
  await updateListing(host.supabase, publishedId, { description: "Wake up to Rakaposhi.", amenities: ["wifi", "hot_water"] });
  await uploadPropertyPhoto(host.supabase, {
    propertyId: publishedId, file: image(), variants: PHOTO_WIDTHS.map((width) => ({ width, blob: webp() })),
  });
  return { host, publishedId, draftId };
}

// @req PUB-04
// @req PUB-03
it("anyone, signed out, can read an organisation's public profile by slug", async () => {
  const { host } = await hostWithCatalogue();
  const org = await getPublicOrganization(anonClient(), host.organizationSlug);
  expect(org).toMatchObject({ slug: host.organizationSlug, name: "Test Org", city: "Hunza", phone: "0300 1234567", headline: "Cabins above the river" });
  expect(org!.hostingSince).toBe(new Date().getFullYear());
});

// @req PUB-06
it("an unknown organisation slug reads as null, not an error", async () => {
  expect(await getPublicOrganization(anonClient(), "no-such-host-anywhere")).toBeNull();
});

// @req PUB-01
it("the catalogue lists only the organisation's published properties, with a cover", async () => {
  const { host, publishedId } = await hostWithCatalogue();
  const list = await listPublishedProperties(anonClient(), host.organizationId);
  expect(list.map((p) => p.id)).toEqual([publishedId]);
  expect(list[0]).toMatchObject({ name: "River Hut", baseRateCents: 1_500_000, maxGuests: 4, propertyType: "cabin" });
  expect(list[0].cover?.src).toMatch(/^http/);
});

// @req PUB-02
it("a published property page carries its description, amenities and photos", async () => {
  const { host, publishedId } = await hostWithCatalogue();
  const slug = (await listPublishedProperties(anonClient(), host.organizationId))[0].slug;
  const property = await getPublishedProperty(anonClient(), host.organizationId, slug);
  expect(property).toMatchObject({ id: publishedId, description: "Wake up to Rakaposhi.", amenities: ["wifi", "hot_water"] });
  expect(property!.photos).toHaveLength(1);
});

// @req PUB-07
it("photos with variants are served as a width-described srcset of signed URLs", async () => {
  const { host } = await hostWithCatalogue();
  const [summary] = await listPublishedProperties(anonClient(), host.organizationId);
  const srcSet = summary.cover!.srcSet;
  for (const width of PHOTO_WIDTHS) expect(srcSet).toMatch(new RegExp(`\\.w${width}\\.webp\\S* ${width}w`));
  const response = await fetch(summary.cover!.src);
  expect(response.status).toBe(200);
});

// @req PUB-07
it("a photo uploaded without variants is skipped on the public page", async () => {
  const { host, publishedId } = await hostWithCatalogue();
  // No `variants` argument: this photo never gets .w480/960/1600.webp
  // siblings, so it must not show up publicly even though its row is
  // published (has_variants defaults to false — 20260926010000).
  await uploadPropertyPhoto(host.supabase, { propertyId: publishedId, file: image() });
  const slug = (await listPublishedProperties(anonClient(), host.organizationId))[0].slug;
  const property = await getPublishedProperty(anonClient(), host.organizationId, slug);
  expect(property!.photos).toHaveLength(1);
  expect(property!.photos.every((p) => p.srcSet)).toBe(true);
});

it("a draft property is not readable by slug, even with the right organisation", async () => {
  const { host, draftId } = await hostWithCatalogue();
  const { data } = await host.supabase.from("properties").select("slug").eq("id", draftId).single();
  expect(await getPublishedProperty(anonClient(), host.organizationId, data!.slug)).toBeNull();
});

describe("contact links", () => {
  it("turns a Pakistani number into WhatsApp and tel links", () => {
    expect(whatsappLink("0300 1234567")).toBe("https://wa.me/923001234567");
    expect(whatsappLink("+92 300-1234567")).toBe("https://wa.me/923001234567");
    expect(telLink("0300 1234567")).toBe("tel:+923001234567");
  });
  it("returns null for something that isn't a phone number", () => {
    expect(whatsappLink("")).toBeNull();
    expect(telLink("12")).toBeNull();
  });
});
