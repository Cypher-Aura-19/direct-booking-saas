import type { GuestRecord } from "./records";

const HEADER = ["Guest name", "CNIC number", "Phone", "Check-in", "Check-out", "Retention expires"];

// A cell starting with = + - @ (or a tab/CR) can be run as a formula by
// Excel/Sheets. Prefix those with ' — except a plain +digits phone number.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_PHONE = /^\+\d+$/;

function cell(value: string | null): string {
  let text = value ?? "";
  if (FORMULA_START.test(text) && !PLAIN_PHONE.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCsv(records: GuestRecord[]): string {
  const rows = records.map((r) =>
    [r.guestName, r.cnicNumber, r.guestPhone, r.stayStart, r.stayEnd, r.retentionExpiresAt.slice(0, 10)].map(cell).join(","),
  );
  return [HEADER.join(","), ...rows].join("\r\n") + "\r\n";
}
