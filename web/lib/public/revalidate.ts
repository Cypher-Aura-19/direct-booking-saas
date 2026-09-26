import { revalidatePath } from "next/cache";

// The `/s/*` routes cache for an hour (`revalidate = 3600` on each page).
// Any dashboard change that can affect what a guest sees — publish/unpublish,
// basics, listing, photos, or organisation settings — must invalidate that
// cache immediately, or a just-unpublished property (or a photo the host
// just deleted) would stay visible to anon for up to an hour.
export function revalidatePublicPages(orgSlug: string): void {
  revalidatePath(`/s/${orgSlug}`, "layout");
}
