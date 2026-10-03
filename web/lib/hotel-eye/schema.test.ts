// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { markBookingPaid } from "@/lib/bookings/host";
import { seedBookingFixture } from "@/tests/bookings";
import { anonClient } from "@/tests/helpers";
import { cleanupSeed, insertDocument, seedPaidBooking } from "@/tests/hotel-eye";
import { retentionCap } from "./dates";

// @req CNIC-01
test("marking paid creates one upload link that expires at the end of checkout day, and the acknowledgement carries it", async () => {
  const seed = await seedPaidBooking();
  expect(seed.uploadToken).toMatch(/^[0-9a-f]{64}$/);

  const { data: link } = await seed.service.from("id_upload_links").select("expires_at, used_at, organization_id").eq("token", seed.uploadToken).single();
  expect(link!.used_at).toBeNull();
  expect(link!.organization_id).toBe(seed.host.organizationId);
  expect(Date.parse(link!.expires_at)).toBe(Date.parse(`${addDays(seed.end, 1)}T00:00:00+05:00`));

  const { data: messages } = await seed.service.from("messages").select("sender, body").eq("conversation_id", seed.conversationId!).order("created_at");
  expect(messages!.map((m) => m.sender)).toEqual(["ai", "ai"]); // approval ack, then payment ack (still exactly one AI message from mark-paid)
  expect(messages![1].body).toContain(`/id/${seed.uploadToken}`);

  // A second mark-paid is a typed no-op and creates no second link.
  expect(await markBookingPaid(seed.host.supabase, seed.bookingId)).toEqual({ ok: false, reason: "already_handled" });
  const { data: links } = await seed.service.from("id_upload_links").select("token").eq("booking_id", seed.bookingId);
  expect(links).toHaveLength(1);
  await cleanupSeed(seed);
});

// @req CNIC-04
test("the guest-ids bucket is private and anon can read nothing from it or from the link/document tables", async () => {
  const seed = await seedPaidBooking();
  const { documentId, path } = await insertDocument(seed);
  expect(documentId).toBeTruthy();

  const { data: bucket } = await seed.service.storage.getBucket("guest-ids");
  expect(bucket!.public).toBe(false);

  const anon = anonClient();
  expect((await anon.storage.from("guest-ids").download(path)).error).not.toBeNull();
  expect((await anon.storage.from("guest-ids").createSignedUrl(path, 60)).error).not.toBeNull();
  expect((await anon.storage.from("guest-ids").list(seed.host.organizationId)).data ?? []).toHaveLength(0);
  expect((await anon.from("id_upload_links").select("token")).error).not.toBeNull();
  expect((await anon.from("guest_documents").select("id")).error).not.toBeNull();
  await cleanupSeed(seed);
});

// @req CNIC-11
test("the retention expiry is stored as 90 days after checkout", async () => {
  const seed = await seedPaidBooking();
  const { documentId } = await insertDocument(seed);
  const { data } = await seed.service.from("guest_documents").select("retention_expires_at").eq("id", documentId).single();
  expect(Date.parse(data!.retention_expires_at)).toBe(Date.parse(retentionCap(seed.end)));
  await cleanupSeed(seed);
});

// @req CNIC-12
test("retention can be shortened by the host but never pushed past the cap, and the stay dates are locked", async () => {
  const seed = await seedPaidBooking();
  const { documentId } = await insertDocument(seed);
  const cap = Date.parse(retentionCap(seed.end));
  const iso = (ms: number) => new Date(ms).toISOString();
  const update = (patch: Record<string, unknown>) => seed.host.supabase.from("guest_documents").update(patch).eq("id", documentId).select("id");

  expect((await update({ retention_expires_at: iso(cap - 10 * 86_400_000) })).error).toBeNull();   // shorten
  expect((await update({ retention_expires_at: iso(cap) })).error).toBeNull();                       // back up to the cap itself
  expect((await update({ retention_expires_at: iso(cap + 1000) })).error?.code).toBe("23514");       // beyond the cap
  expect((await update({ stay_end: addDays(seed.end, 60) })).error?.code).toBe("23514");             // can't move the checkout to widen the cap

  // A direct insert beyond the cap is refused too.
  const { error } = await seed.service.from("guest_documents").insert({
    guest_id: seed.guestId, organization_id: seed.host.organizationId, image_path: "x/y/z.png",
    stay_start: seed.start, stay_end: seed.end, retention_expires_at: iso(cap + 1000),
  });
  expect(error?.code).toBe("23514");
  await cleanupSeed(seed);
});

// @req CNIC-15
test("another organisation cannot read or change documents, links or stored images", async () => {
  const a = await seedPaidBooking();
  const b = await seedBookingFixture();
  const { documentId, path } = await insertDocument(a);

  expect((await b.host.supabase.from("guest_documents").select("id")).data).toEqual([]);
  expect((await b.host.supabase.from("id_upload_links").select("token")).data).toEqual([]);
  const changed = await b.host.supabase.from("guest_documents").update({ retention_expires_at: new Date().toISOString() }).eq("id", documentId).select("id");
  expect(changed.data).toEqual([]);

  expect((await b.host.supabase.storage.from("guest-ids").createSignedUrl(path, 60)).error).not.toBeNull();
  const own = await a.host.supabase.storage.from("guest-ids").createSignedUrl(path, 60);
  expect(own.error).toBeNull();
  expect(own.data!.signedUrl).toContain("token=");

  expect((await a.host.supabase.from("guest_documents").select("id")).data).toHaveLength(1);
  await cleanupSeed(a);
  await b.host.cleanup();
});
