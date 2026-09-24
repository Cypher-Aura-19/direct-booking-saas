// @vitest-environment node
import { test, expect } from "vitest";
import { createProperty, type PropertyBasics } from "./basics";
import { moveItem } from "./photo-order";
import {
  PHOTO_BUCKET,
  validatePhotoFile,
  uploadPropertyPhoto,
  listPropertyPhotos,
  signedPhotoUrls,
  reorderPropertyPhotos,
  setCoverPhoto,
  deletePropertyPhoto,
} from "./photos";
import { createTestHostWithOrg, supabaseAdmin } from "../../tests/helpers";

// A real 1x1 PNG, so the bytes are a valid image, not just a labelled blob.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const png = () => new Blob([PNG], { type: "image/png" });

const BASICS: PropertyBasics = {
  name: "Photo Villa",
  property_type: "villa",
  address: "Hunza",
  base_rate_cents: 900_000,
  max_guests: 2,
};

// Deleting the test user cascades the rows but not the storage objects.
async function removeObjects(propertyId: string) {
  const admin = supabaseAdmin();
  const { data } = await admin.storage.from(PHOTO_BUCKET).list(propertyId);
  if (data?.length) {
    await admin.storage.from(PHOTO_BUCKET).remove(data.map((o) => `${propertyId}/${o.name}`));
  }
}

async function hostWithPhotos(count: number) {
  const host = await createTestHostWithOrg();
  const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { error, photo } = await uploadPropertyPhoto(host.supabase, { propertyId: propertyId!, file: png() });
    expect(error).toBeNull();
    ids.push(photo!.id);
  }
  return {
    host,
    propertyId: propertyId!,
    ids,
    async cleanup() {
      await removeObjects(propertyId!);
      await host.cleanup();
    },
  };
}

test("moveItem moves one element and leaves the input untouched", () => {
  const input = ["a", "b", "c", "d"];
  expect(moveItem(input, 0, 2)).toEqual(["b", "c", "a", "d"]);
  expect(moveItem(input, 3, 0)).toEqual(["d", "a", "b", "c"]);
  expect(input).toEqual(["a", "b", "c", "d"]);
});

test("validatePhotoFile accepts jpeg/png/webp up to 10 MiB only", () => {
  expect(validatePhotoFile({ type: "image/jpeg", size: 1000 })).toBeNull();
  expect(validatePhotoFile({ type: "image/gif", size: 1000 })).toMatch(/jpeg|png|webp/i);
  expect(validatePhotoFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
});

// @req PROP-05
test("a host can upload photos to a property; the first becomes the cover and each is viewable by signed URL", async () => {
  const fixture = await hostWithPhotos(2);
  try {
    const photos = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(photos.map((p) => p.id)).toEqual(fixture.ids);
    expect(photos.map((p) => p.is_cover)).toEqual([true, false]);
    expect(photos.every((p) => p.storage_path.startsWith(`${fixture.propertyId}/`))).toBe(true);

    const urls = await signedPhotoUrls(fixture.host.supabase, photos);
    const response = await fetch(urls[photos[0].id]);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  } finally {
    await fixture.cleanup();
  }
});

test("the bucket itself refuses a non-image even if client-side validation is bypassed", async () => {
  const fixture = await hostWithPhotos(0);
  try {
    const { error } = await fixture.host.supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`${fixture.propertyId}/evil.html`, new Blob(["<script>"], { type: "text/html" }), {
        contentType: "text/html",
      });
    expect(error).not.toBeNull();
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-06
test("a host can reorder photos, and a partial or foreign ordering is rejected", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    const [a, b, c] = fixture.ids;
    expect((await reorderPropertyPhotos(fixture.host.supabase, { propertyId: fixture.propertyId, orderedIds: [c, a, b] })).error).toBeNull();
    expect((await listPropertyPhotos(fixture.host.supabase, fixture.propertyId)).map((p) => p.id)).toEqual([c, a, b]);

    expect((await reorderPropertyPhotos(fixture.host.supabase, { propertyId: fixture.propertyId, orderedIds: [c, a] })).error).not.toBeNull();
    expect((await reorderPropertyPhotos(fixture.host.supabase, { propertyId: fixture.propertyId, orderedIds: [c, a, a] })).error).not.toBeNull();
    expect((await listPropertyPhotos(fixture.host.supabase, fixture.propertyId)).map((p) => p.id)).toEqual([c, a, b]);
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-07
test("a host can delete a photo, which removes the stored file too", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    const [, b] = fixture.ids;
    const before = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    const path = before.find((p) => p.id === b)!.storage_path;

    expect((await deletePropertyPhoto(fixture.host.supabase, b)).error).toBeNull();

    const after = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(after.map((p) => p.id)).toEqual([fixture.ids[0], fixture.ids[2]]);
    const { error } = await supabaseAdmin().storage.from(PHOTO_BUCKET).download(path);
    expect(error).not.toBeNull();
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-07
// @req PROP-08
test("deleting the cover photo promotes the next photo to cover", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    await deletePropertyPhoto(fixture.host.supabase, fixture.ids[0]);
    const after = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(after.map((p) => p.is_cover)).toEqual([true, false]);
    expect(after[0].id).toBe(fixture.ids[1]);
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-08
test("a host can set a cover photo, and only one photo is ever the cover", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    expect((await setCoverPhoto(fixture.host.supabase, fixture.ids[2])).error).toBeNull();
    const photos = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(photos.filter((p) => p.is_cover).map((p) => p.id)).toEqual([fixture.ids[2]]);
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-14
test("a host cannot see, add to, reorder, re-cover or delete another organisation's photos", async () => {
  const fixture = await hostWithPhotos(2);
  const intruder = await createTestHostWithOrg();
  try {
    const { propertyId, ids } = fixture;
    expect(await listPropertyPhotos(intruder.supabase, propertyId)).toEqual([]);
    expect((await uploadPropertyPhoto(intruder.supabase, { propertyId, file: png() })).error).not.toBeNull();
    expect((await reorderPropertyPhotos(intruder.supabase, { propertyId, orderedIds: [ids[1], ids[0]] })).error).not.toBeNull();
    expect((await setCoverPhoto(intruder.supabase, ids[1])).error).not.toBeNull();
    expect((await deletePropertyPhoto(intruder.supabase, ids[0])).error).not.toBeNull();

    const { data: objects } = await intruder.supabase.storage.from(PHOTO_BUCKET).list(propertyId);
    expect(objects ?? []).toEqual([]);

    const ownerView = await listPropertyPhotos(fixture.host.supabase, propertyId);
    expect(ownerView.map((p) => [p.id, p.is_cover])).toEqual([
      [ids[0], true],
      [ids[1], false],
    ]);
  } finally {
    await fixture.cleanup();
    await intruder.cleanup();
  }
});
