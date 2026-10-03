const MAX_SIDE = 1600;
const QUALITY = 0.85;

export function scaleToFit(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Browser only (needs createImageBitmap and a canvas), exercised in the M11b
// browser walk like photo-variants.ts. Re-encoding as JPEG also drops EXIF
// (including GPS) from the guest's photo, and keeps it under the Server
// Action body limit.
export async function resizeIdPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = scaleToFit(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot resize photos.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.type !== "image/jpeg") throw new Error("This browser cannot resize photos.");
    return blob;
  } finally {
    bitmap.close();
  }
}
