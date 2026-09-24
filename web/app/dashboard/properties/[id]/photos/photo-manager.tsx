"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { moveItem } from "@/lib/properties/photo-order";
import { ALLOWED_PHOTO_TYPES, uploadPropertyPhoto, type PropertyPhoto } from "@/lib/properties/photos";
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
      for (const file of selected) {
        const { error } = await uploadPropertyPhoto(supabase, { propertyId, file });
        if (error) {
          setError(`${file.name}: ${error}`);
          break;
        }
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
      <label className="flex max-w-md flex-col gap-2 text-sm">
        <span className="font-medium">Add photos</span>
        <span className="text-muted">JPEG, PNG or WebP, up to 10 MB each. The first photo is the cover until you choose another.</span>
        <input
          type="file"
          accept={ALLOWED_PHOTO_TYPES.join(",")}
          multiple
          disabled={pending}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          className="min-h-11 text-sm"
        />
      </label>

      {pending && <p className="text-sm text-muted">Working…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-muted">No photos yet. Guests decide in seconds — lead with the view or the best room.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              className="flex flex-col gap-2"
            >
              {/* Private bucket, short-lived signed URL: next/image's optimiser would cache it past expiry. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Photo ${index + 1}`} className="aspect-[4/3] w-full rounded-card object-cover" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {photo.is_cover ? (
                  <span className="px-3 text-success">Cover</span>
                ) : (
                  <Button variant="ghost" disabled={pending} onClick={() => run(() => setCoverPhotoAction(propertyId, photo.id))}>
                    Make cover
                  </Button>
                )}
                <Button variant="ghost" disabled={pending || index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, index - 1)}>
                  Earlier
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending || index === photos.length - 1}
                  aria-label={`Move photo ${index + 1} later`}
                  onClick={() => move(index, index + 1)}
                >
                  Later
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm("Delete this photo? This cannot be undone.")) {
                      run(() => deletePhotoAction(propertyId, photo.id));
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
