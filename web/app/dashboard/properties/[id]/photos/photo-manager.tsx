"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { IconPhoto, IconStar, IconTrash, IconUpload } from "@/components/ui/icons";
import { Stamp } from "@/components/ui/stamp";
import { createClient } from "@/lib/supabase/client";
import { moveItem } from "@/lib/properties/photo-order";
import { ALLOWED_PHOTO_TYPES, uploadPropertyPhoto, type PropertyPhoto } from "@/lib/properties/photos";
import { makePhotoVariants, type PhotoVariant } from "@/lib/properties/photo-variants";
import { deletePhotoAction, reorderPhotosAction, setCoverPhotoAction } from "../../actions";

type PhotoWithUrl = PropertyPhoto & { url: string };

export function PhotoManager({ propertyId, photos }: { propertyId: string; photos: PhotoWithUrl[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function run(task: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const { error } = await task();
      if (error) setError(error);
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    setError(null);
    startTransition(async () => {
      // Browser → Storage directly, with the host's own session.
      const supabase = createClient();
      const failures: string[] = [];
      for (const file of selected) {
        let variants: PhotoVariant[] = [];
        try {
          variants = await makePhotoVariants(file);
        } catch {
          variants = [];
        }
        const { error } = await uploadPropertyPhoto(supabase, { propertyId, file, variants });
        if (error) failures.push(`${file.name}: ${error}`);
      }
      if (failures.length > 0) {
        const uploaded = selected.length - failures.length;
        setError(`${uploaded} of ${selected.length} uploaded. Not uploaded — ${failures.join("; ")}`);
      }
      router.refresh();
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length || from === to) return;
    const orderedIds = moveItem(photos.map((p) => p.id), from, to);
    run(() => reorderPhotosAction(propertyId, orderedIds));
  }

  return (
    <div className="flex flex-col gap-6">
      <label
        className={`group relative flex cursor-pointer flex-col items-center gap-3 rounded-card border-[1.5px] border-dashed px-6 py-10 text-center transition ${
          pending
            ? "cursor-wait border-hairline bg-surface-muted"
            : "border-ruling bg-surface hover:border-accent hover:bg-accent-soft/40"
        }`}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent transition group-hover:scale-105">
          <IconUpload className="size-6" />
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-[15px] font-medium text-ink">Add photos</span>
          <span className="max-w-md text-sm leading-5 text-muted">
            JPEG, PNG or WebP, up to 10 MB each. The first photo is the cover until you choose another.
          </span>
        </span>
        <span className="mt-1 inline-flex min-h-10 items-center rounded-pill border border-hairline bg-surface px-4 text-sm font-medium text-ink shadow-[0_1px_2px_rgb(20_24_36/0.05)]">
          Choose files
        </span>
        <input
          type="file"
          accept={ALLOWED_PHOTO_TYPES.join(",")}
          multiple
          disabled={pending}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-wait"
        />
      </label>

      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <span className="size-3.5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
          Working…
        </p>
      )}
      {error && (
        <p className="rounded-[var(--radius-field)] bg-destructive/[0.07] px-3.5 py-3 text-sm text-destructive" aria-live="polite">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <p className="text-muted">No photos yet. Guests decide in seconds — lead with the view or the best room.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            {photos.length} {photos.length === 1 ? "photo" : "photos"} · drag to reorder, or use Earlier and Later.
          </p>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                }}
                className={`flex cursor-grab flex-col overflow-hidden rounded-card border bg-surface shadow-[var(--shadow-sheet)] transition active:cursor-grabbing ${
                  dragIndex === index ? "border-accent opacity-60" : "border-hairline"
                }`}
              >
                <div className="relative">
                  {photo.url ? (
                    // Private bucket, short-lived signed URL: next/image's optimiser would cache it past expiry.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={`Photo ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-muted">
                      <span className="flex flex-col items-center gap-2 text-sm text-muted">
                        <IconPhoto className="size-6" />
                        Preview unavailable
                      </span>
                    </div>
                  )}
                  <span className="absolute start-3 top-3 grid min-w-7 place-items-center rounded-full bg-ink/75 px-2 py-0.5 font-mono text-xs text-white backdrop-blur-sm">
                    {index + 1}
                  </span>
                  {photo.is_cover && (
                    <Stamp tone="violet" tilt={-5} className="absolute end-3 top-3 bg-surface/95">
                      Cover
                    </Stamp>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 p-2 text-sm">
                  {!photo.is_cover && (
                    <Button
                      variant="ghost"
                      className="min-h-10 px-3"
                      disabled={pending}
                      onClick={() => run(() => setCoverPhotoAction(propertyId, photo.id))}
                    >
                      <IconStar className="size-4" />
                      Make cover
                    </Button>
                  )}
                  <span className="ms-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      className="min-h-10 min-w-10 px-3"
                      disabled={pending || index === 0}
                      aria-label={`Move photo ${index + 1} earlier`}
                      onClick={() => move(index, index - 1)}
                    >
                      Earlier
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-10 min-w-10 px-3"
                      disabled={pending || index === photos.length - 1}
                      aria-label={`Move photo ${index + 1} later`}
                      onClick={() => move(index, index + 1)}
                    >
                      Later
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Delete photo ${index + 1}`}
                      className="min-h-10 min-w-10 px-3 text-destructive hover:bg-destructive/[0.07]"
                      onClick={() => {
                        if (window.confirm("Delete this photo? This cannot be undone.")) {
                          run(() => deletePhotoAction(propertyId, photo.id));
                        }
                      }}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
