"use server";

import { MAX_ID_IMAGE_BYTES } from "@/lib/hotel-eye/cnic";
import { submitGuestId, type SubmitResult } from "@/lib/hotel-eye/upload";
import { createServiceClient } from "@/lib/supabase/service";

const MESSAGE: Record<Exclude<Extract<SubmitResult, { ok: false }>["reason"], "invalid">, string> = {
  unknown: "This link isn't valid. Ask your host to send it again.",
  expired: "This link has expired. Ask your host for a new one.",
  used: "Your ID has already been received. Thank you.",
  bad_image: "Please upload a JPEG, PNG or WebP photo of your ID.",
  too_large: "That photo is too large. Try a smaller one.",
  failed: "We couldn't save that. Please try again.",
};

// The guest has no session: the unguessable token (re-checked inside
// submitGuestId) is the credential, and the service client is only used here.
export async function submitIdAction(form: FormData): Promise<{ error: string | null }> {
  const photo = form.get("photo");
  if (!(photo instanceof File)) return { error: MESSAGE.bad_image };
  if (photo.size > MAX_ID_IMAGE_BYTES) return { error: MESSAGE.too_large };

  const result = await submitGuestId(createServiceClient(), {
    token: String(form.get("token") ?? ""),
    name: String(form.get("name") ?? ""),
    cnic: String(form.get("cnic") ?? ""),
    phone: String(form.get("phone") ?? ""),
    bytes: new Uint8Array(await photo.arrayBuffer()),
  });
  if (result.ok) return { error: null };
  return { error: result.reason === "invalid" ? result.message : MESSAGE[result.reason] };
}
