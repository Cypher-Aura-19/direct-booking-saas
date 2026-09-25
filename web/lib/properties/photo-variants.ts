// Photos are resized in the host's browser at upload time, so public pages
// can serve a phone a 480px image instead of a 4000px original, without
// Supabase's (Pro-plan) image transformation. Decided 2026-09-25.
export const PHOTO_WIDTHS = [480, 960, 1600] as const;
export type PhotoVariant = { width: (typeof PHOTO_WIDTHS)[number]; blob: Blob };

const WEBP_QUALITY = 0.8;

export function variantPath(storagePath: string, width: number): string {
  return `${storagePath.replace(/\.[a-z0-9]+$/i, "")}.w${width}.webp`;
}

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max) return { width, height };
  return { width: max, height: Math.round((height * max) / width) };
}

// Browser only: needs createImageBitmap and a canvas. Tested in the M5
// browser walk, not in Vitest (jsdom has no canvas).
export async function makePhotoVariants(file: Blob): Promise<PhotoVariant[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const variants: PhotoVariant[] = [];
    for (const width of PHOTO_WIDTHS) {
      const size = fitWithin(bitmap.width, bitmap.height, width);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot resize photos.");
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
      if (!blob) throw new Error("This browser cannot resize photos.");
      variants.push({ width, blob });
    }
    return variants;
  } finally {
    bitmap.close();
  }
}
