import { addDays } from "../availability/dates";

export const RETENTION_DAYS = 90;

// 90 days after checkout, at the start of that day in Karachi. Pakistan has
// no DST, so a fixed +05:00 offset is exact; this must equal
// guest_document_retention_cap() in the M11b migration.
export function retentionCap(stayEnd: string): string {
  return new Date(`${addDays(stayEnd, RETENTION_DAYS)}T00:00:00+05:00`).toISOString();
}

// CNIC-14: what the host sees next to each record.
export function retentionLabel(expiresAt: string, now: Date): string {
  const msLeft = Date.parse(expiresAt) - now.getTime();
  if (msLeft <= 0) return "Expired — deleted at the next nightly run";
  const days = Math.ceil(msLeft / 86_400_000);
  return days === 1 ? "Deletes tomorrow" : `Deletes in ${days} days`;
}
