import { parseBookingRequest } from "../bookings/requests";

export const MAX_ID_IMAGE_BYTES = 4 * 1024 * 1024;

export type ParsedGuestId = { name: string; cnic: string; phone: string };

// Server-side validation of what the guest typed. Name and phone follow the
// same rules as a booking request; the CNIC is 13 digits, stored dashed.
export function parseGuestId(input: { name: string; cnic: string; phone: string }): ParsedGuestId | { error: string } {
  const contact = parseBookingRequest({ name: input.name, phone: input.phone });
  if ("error" in contact) return contact;
  const digits = String(input.cnic ?? "").replace(/[\s-]/g, "");
  if (!/^\d{13}$/.test(digits)) return { error: "Enter the 13-digit CNIC number, e.g. 35202-1234567-1." };
  return { ...contact, cnic: `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}` };
}

export type ImageType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

// The declared MIME type is client-controlled, so sniff the bytes.
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return { mime: "image/png", ext: "png" };
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (bytes.length >= 12 && riff.every((b, i) => bytes[i] === b) && webp.every((b, i) => bytes[8 + i] === b)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
