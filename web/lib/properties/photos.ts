import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "property-photos";
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_COLUMNS = "id, storage_path, position, is_cover";

export type PropertyPhoto = { id: string; storage_path: string; position: number; is_cover: boolean };

// The bucket enforces the same limits server-side (migration 20260924010000);
// this only exists to give a readable message before bytes are sent.
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) return "Photos must be JPEG, PNG or WebP.";
  if (file.size > MAX_PHOTO_BYTES) return "Photos must be 10 MB or smaller.";
  return null;
}

// Runs in the browser (photo-manager.tsx) with the host's session, so the
// bytes go straight to Storage; storage RLS checks the property is theirs.
export async function uploadPropertyPhoto(
  supabase: SupabaseClient,
  { propertyId, file }: { propertyId: string; file: Blob },
): Promise<{ error: string | null; photo?: PropertyPhoto }> {
  const invalid = validatePhotoFile(file);
  if (invalid) return { error: invalid };

  const path = `${propertyId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: last } = await supabase
    .from("property_photos")
    .select("position")
    .eq("property_id", propertyId)
    .order("position", { ascending: false })
    .limit(1);
  const isFirst = !last || last.length === 0;
  const position = isFirst ? 0 : last[0].position + 1;

  const { data, error } = await supabase
    .from("property_photos")
    .insert({ property_id: propertyId, storage_path: path, position, is_cover: isFirst })
    .select(PHOTO_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: error.message };
  }
  return { error: null, photo: data };
}

export async function listPropertyPhotos(supabase: SupabaseClient, propertyId: string): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from("property_photos")
    .select(PHOTO_COLUMNS)
    .eq("property_id", propertyId)
    .order("position", { ascending: true });
  if (error) {
    if (error.code === "22P02") return [];
    throw error;
  }
  return data;
}

export async function signedPhotoUrls(
  supabase: SupabaseClient,
  photos: PropertyPhoto[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (photos.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(photos.map((p) => p.storage_path), expiresInSeconds);
  if (error || !data) return {};
  const byPath = new Map(data.map((entry) => [entry.path, entry.signedUrl]));
  const urls: Record<string, string> = {};
  for (const photo of photos) {
    const url = byPath.get(photo.storage_path);
    if (url) urls[photo.id] = url;
  }
  return urls;
}

export async function reorderPropertyPhotos(
  supabase: SupabaseClient,
  { propertyId, orderedIds }: { propertyId: string; orderedIds: string[] },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("reorder_property_photos", {
    target_property_id: propertyId,
    ordered_photo_ids: orderedIds,
  });
  if (error) return { error: error.code === "22023" ? "That photo order is out of date. Refresh and try again." : error.message };
  return { error: null };
}

export async function setCoverPhoto(supabase: SupabaseClient, photoId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_property_cover", { target_photo_id: photoId });
  if (error) return { error: error.code === "P0002" ? "Photo not found." : error.message };
  return { error: null };
}

export async function deletePropertyPhoto(supabase: SupabaseClient, photoId: string): Promise<{ error: string | null }> {
  const { data: photo, error: readError } = await supabase
    .from("property_photos")
    .select("id, property_id, storage_path, is_cover")
    .eq("id", photoId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!photo) return { error: "Photo not found." };

  const { error } = await supabase.from("property_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };

  // Row first, then object: a leftover object is invisible clutter, whereas
  // a leftover row pointing at a missing object is a broken image.
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  if (photo.is_cover) {
    const [next] = await listPropertyPhotos(supabase, photo.property_id);
    if (next) return setCoverPhoto(supabase, next.id);
  }
  return { error: null };
}
