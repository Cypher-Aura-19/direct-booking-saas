import type { SupabaseClient } from "@supabase/supabase-js";
import { nightsBetween } from "../availability/dates";

export type BookingStatus = "requested" | "approved" | "paid" | "staying" | "checked_out" | "rejected";
export const PIPELINE: BookingStatus[] = ["requested", "approved", "paid", "staying", "checked_out"];

export type HostBooking = {
  id: string;
  propertyId: string;
  propertyName: string;
  conversationId: string | null;
  guestName: string;
  guestPhone: string | null;
  startDate: string;
  endDate: string;
  nights: number;
  status: BookingStatus;
  totalCents: number;
  createdAt: string;
};

export type DecisionResult = { ok: true } | { ok: false; reason: "not_found" | "already_handled" | "dates_taken" };

const COLUMNS =
  "id, property_id, conversation_id, start_date, end_date, status, total_price_cents, created_at, properties!inner(name, organization_id), guests(name, phone)";

type Row = {
  id: string;
  property_id: string;
  conversation_id: string | null;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  total_price_cents: number;
  created_at: string;
  properties: { name: string } | { name: string }[];
  guests: { name: string; phone: string | null } | { name: string; phone: string | null }[] | null;
};

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

function toHostBooking(row: Row): HostBooking {
  const guest = one(row.guests);
  return {
    id: row.id,
    propertyId: row.property_id,
    propertyName: one(row.properties)?.name ?? "",
    conversationId: row.conversation_id,
    guestName: guest?.name ?? "Guest",
    guestPhone: guest?.phone ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    nights: nightsBetween(row.start_date, row.end_date),
    status: row.status,
    totalCents: row.total_price_cents,
    createdAt: row.created_at,
  };
}

// Every booking across the org's properties, newest first. No pagination in
// v1 (same trade-off as the inbox): fine for one host's scale.
export async function listBookings(supabase: SupabaseClient, organizationId: string): Promise<HostBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(COLUMNS)
    .eq("properties.organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toHostBooking);
}

// A foreign or malformed id resolves to null, never a cross-org read (RLS).
export async function getBooking(supabase: SupabaseClient, id: string): Promise<HostBooking | null> {
  const { data, error } = await supabase.from("bookings").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? toHostBooking(data as unknown as Row) : null;
}

export async function getBookingForConversation(supabase: SupabaseClient, conversationId: string): Promise<HostBooking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? toHostBooking(data as unknown as Row) : null;
}

function decision(error: { code?: string; message: string } | null): DecisionResult {
  if (!error) return { ok: true };
  if (error.code === "P0002") return { ok: false, reason: "not_found" };
  if (error.code === "55000") return { ok: false, reason: "already_handled" };
  if (error.code === "23P01") return { ok: false, reason: "dates_taken" };
  if (error.code === "22P02") return { ok: false, reason: "not_found" };
  throw error;
}

export async function approveBooking(supabase: SupabaseClient, id: string): Promise<DecisionResult> {
  const { error } = await supabase.rpc("approve_booking", { booking_id: id });
  return decision(error);
}

export async function rejectBooking(supabase: SupabaseClient, id: string): Promise<DecisionResult> {
  const { error } = await supabase.rpc("reject_booking", { booking_id: id });
  return decision(error);
}
