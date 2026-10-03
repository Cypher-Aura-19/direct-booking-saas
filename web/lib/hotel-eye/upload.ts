import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_ID_IMAGE_BYTES, parseGuestId, sniffImage } from "./cnic";
import { retentionCap } from "./dates";
import { getUploadLink } from "./links";

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "unknown" | "expired" | "used" | "bad_image" | "too_large" | "failed" };

type Input = { token: string; name: string; cnic: string; phone: string; bytes: Uint8Array };

// Guest side, service client, behind a verified token. Dates come from the
// booking, never from the caller, so a guest cannot stretch their own
// retention. The link is "claimed" with a conditional update, so of two
// simultaneous submissions only one can win; the loser's image is removed.
export async function submitGuestId(service: SupabaseClient, input: Input, now: Date = new Date()): Promise<SubmitResult> {
  const parsed = parseGuestId(input);
  if ("error" in parsed) return { ok: false, reason: "invalid", message: parsed.error };

  const link = await getUploadLink(service, input.token, now);
  if (link.status === "unknown") return { ok: false, reason: "unknown" };
  if (link.status === "used") return { ok: false, reason: "used" };
  if (link.status === "expired") return { ok: false, reason: "expired" };

  if (input.bytes.length > MAX_ID_IMAGE_BYTES) return { ok: false, reason: "too_large" };
  const image = sniffImage(input.bytes);
  if (!image) return { ok: false, reason: "bad_image" };

  const bucket = service.storage.from("guest-ids");
  const path = `${link.organizationId}/${link.bookingId}/${crypto.randomUUID()}.${image.ext}`;
  const upload = await bucket.upload(path, input.bytes, { contentType: image.mime, upsert: false });
  if (upload.error) return { ok: false, reason: "failed" };
  const discard = async () => { await bucket.remove([path]); };

  const claim = await service
    .from("id_upload_links")
    .update({ used_at: now.toISOString() })
    .eq("token", input.token)
    .is("used_at", null)
    .select("token");
  if (claim.error) { await discard(); return { ok: false, reason: "failed" }; }
  if (!claim.data?.length) { await discard(); return { ok: false, reason: "used" }; }

  const release = async () => {
    await service.from("id_upload_links").update({ used_at: null }).eq("token", input.token);
    await discard();
  };

  const guest = await service.from("guests").update({ name: parsed.name, phone: parsed.phone }).eq("id", link.guestId);
  if (guest.error) { await release(); return { ok: false, reason: "failed" }; }

  const document = await service.from("guest_documents").insert({
    guest_id: link.guestId,
    organization_id: link.organizationId,
    booking_id: link.bookingId,
    image_path: path,
    cnic_number: parsed.cnic,
    stay_start: link.startDate,
    stay_end: link.endDate,
    retention_expires_at: retentionCap(link.endDate),
  });
  if (document.error) { await release(); return { ok: false, reason: "failed" }; }

  return { ok: true };
}
