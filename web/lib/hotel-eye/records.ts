import type { SupabaseClient } from "@supabase/supabase-js";
import { isIsoDate } from "../availability/dates";

export type GuestRecord = {
  id: string;
  bookingId: string | null;
  guestName: string;
  guestPhone: string | null;
  cnicNumber: string | null;
  stayStart: string;
  stayEnd: string;
  retentionExpiresAt: string;
  imagePath: string;
  createdAt: string;
};

// Everything here takes the HOST's own client: RLS (owns_organization) is the
// only authorization, so another organisation's rows simply don't exist.
const COLUMNS = "id, booking_id, image_path, cnic_number, stay_start, stay_end, retention_expires_at, created_at, guests(name, phone)";

type Row = {
  id: string;
  booking_id: string | null;
  image_path: string;
  cnic_number: string | null;
  stay_start: string;
  stay_end: string;
  retention_expires_at: string;
  created_at: string;
  guests: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
};
const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

function toRecord(row: Row): GuestRecord {
  const guest = one(row.guests);
  return {
    id: row.id,
    bookingId: row.booking_id,
    guestName: guest?.name ?? "Guest",
    guestPhone: guest?.phone ?? null,
    cnicNumber: row.cnic_number,
    stayStart: row.stay_start,
    stayEnd: row.stay_end,
    retentionExpiresAt: row.retention_expires_at,
    imagePath: row.image_path,
    createdAt: row.created_at,
  };
}

export function parseRange(from?: string | null, to?: string | null): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {};
  if (from && isIsoDate(from)) range.from = from;
  if (to && isIsoDate(to)) range.to = to;
  return range;
}

// CNIC-09: a record is in range when its stay overlaps [from, to].
export async function listRecords(supabase: SupabaseClient, range: { from?: string; to?: string } = {}): Promise<GuestRecord[]> {
  let query = supabase.from("guest_documents").select(COLUMNS).order("stay_start", { ascending: false });
  if (range.from) query = query.gte("stay_end", range.from);
  if (range.to) query = query.lte("stay_start", range.to);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toRecord);
}

export async function getRecord(supabase: SupabaseClient, id: string): Promise<GuestRecord | null> {
  const { data, error } = await supabase.from("guest_documents").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null; // not a uuid
    throw error;
  }
  return data ? toRecord(data as unknown as Row) : null;
}

// CNIC-05: a signed URL created per render, never stored. The storage policy
// (owns_guest_id_object) means another organisation's path signs to an error.
export async function recordImageUrl(supabase: SupabaseClient, path: string, seconds = 60): Promise<string | null> {
  const { data, error } = await supabase.storage.from("guest-ids").createSignedUrl(path, seconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export type ShortenResult =
  | { ok: true; expiresAt: string }
  | { ok: false; reason: "invalid" | "in_past" | "beyond_cap" | "not_found" };

// CNIC-12: `date` is a calendar day (the record is deleted at the start of
// that day in Karachi). The database trigger is the real cap; this maps its
// refusal to a typed result.
export async function shortenRetention(supabase: SupabaseClient, id: string, date: string, now: Date = new Date()): Promise<ShortenResult> {
  if (!isIsoDate(date)) return { ok: false, reason: "invalid" };
  const expiresAt = new Date(`${date}T00:00:00+05:00`).toISOString();
  if (Date.parse(expiresAt) <= now.getTime()) return { ok: false, reason: "in_past" };

  const { data, error } = await supabase.from("guest_documents").update({ retention_expires_at: expiresAt }).eq("id", id).select("id");
  if (error) {
    if (error.code === "23514") return { ok: false, reason: "beyond_cap" };
    if (error.code === "22P02") return { ok: false, reason: "not_found" };
    throw error;
  }
  return data?.length ? { ok: true, expiresAt } : { ok: false, reason: "not_found" };
}

export type BookingIdStatus =
  | { state: "none" }
  | { state: "open"; path: string }
  | { state: "received"; recordId: string }
  | { state: "expired" };

// For the booking page: has the guest sent their ID, is the link still open?
export async function getBookingIdStatus(supabase: SupabaseClient, bookingId: string): Promise<BookingIdStatus> {
  const { data: document, error: documentError } = await supabase.from("guest_documents").select("id").eq("booking_id", bookingId).maybeSingle();
  if (documentError) throw documentError;
  if (document) return { state: "received", recordId: document.id };

  const { data: link, error: linkError } = await supabase.from("id_upload_links").select("token, expires_at, used_at").eq("booking_id", bookingId).maybeSingle();
  if (linkError) throw linkError;
  if (!link) return { state: "none" };
  if (link.used_at) return { state: "none" }; // used but the record is gone (deleted) — nothing to chase
  return Date.parse(link.expires_at) > Date.now() ? { state: "open", path: `/id/${link.token}` } : { state: "expired" };
}
