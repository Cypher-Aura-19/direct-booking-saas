import type { SupabaseClient } from "@supabase/supabase-js";

export type RetentionResult = { rows: number; images: number; failed: number };

// CNIC-13. Service client: this is the nightly job, not a user action.
// Storage first, then the row: a crash in between leaves a row without an
// image (the next run deletes it) instead of an image nothing points at.
// A per-record failure is logged (id only — never the CNIC) and skipped so one
// bad object cannot block the rest.
export async function deleteExpired(service: SupabaseClient, now: Date = new Date(), batch = 500): Promise<RetentionResult> {
  const { data, error } = await service
    .from("guest_documents")
    .select("id, image_path")
    .lte("retention_expires_at", now.toISOString())
    .limit(batch);
  if (error) throw error;

  const result: RetentionResult = { rows: 0, images: 0, failed: 0 };
  for (const doc of data ?? []) {
    const removed = await service.storage.from("guest-ids").remove([doc.image_path]);
    if (removed.error) {
      result.failed += 1;
      console.warn("retention: image removal failed", { id: doc.id });
      continue;
    }
    result.images += removed.data?.length ?? 0;
    const deleted = await service.from("guest_documents").delete().eq("id", doc.id);
    if (deleted.error) {
      result.failed += 1;
      console.warn("retention: row deletion failed", { id: doc.id });
      continue;
    }
    result.rows += 1;
  }
  return result;
}
