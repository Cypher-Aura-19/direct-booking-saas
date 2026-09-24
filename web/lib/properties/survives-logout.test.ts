// @vitest-environment node
import { test, expect } from "vitest";
import { createProperty } from "./basics";
import { getKnowledgeBase, updateKnowledgeBase } from "./knowledge-base";
import { PHOTO_BUCKET, listPropertyPhotos, uploadPropertyPhoto } from "./photos";
import { createTestHostWithOrg, signedInClient, supabaseAdmin } from "../../tests/helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// @req PROP-05
// @req PROP-09
test("a property with photos and a filled knowledge base survives a logout", async () => {
  const host = await createTestHostWithOrg();
  let propertyId: string | undefined;
  try {
    ({ propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { name: "Lake Hut", property_type: "cabin", address: "Attabad", base_rate_cents: 800_000, max_guests: 3 },
    }));
    for (let i = 0; i < 2; i++) {
      const { error } = await uploadPropertyPhoto(host.supabase, {
        propertyId: propertyId!,
        file: new Blob([PNG], { type: "image/png" }),
      });
      expect(error).toBeNull();
    }
    const kb = { wifi_password: "lake-4821", check_in_time: "14:00", directions: "Boat from the jetty." };
    const { error: kbError } = await updateKnowledgeBase(host.supabase, propertyId!, kb);
    expect(kbError).toBeNull();

    await host.supabase.auth.signOut();
    const fresh = await signedInClient(host);

    expect(await listPropertyPhotos(fresh, propertyId!)).toHaveLength(2);
    expect(await getKnowledgeBase(fresh, propertyId!)).toEqual(kb);
  } finally {
    if (propertyId) {
      const admin = supabaseAdmin();
      const { data } = await admin.storage.from(PHOTO_BUCKET).list(propertyId);
      if (data?.length) await admin.storage.from(PHOTO_BUCKET).remove(data.map((o) => `${propertyId}/${o.name}`));
    }
    await host.cleanup();
  }
});
