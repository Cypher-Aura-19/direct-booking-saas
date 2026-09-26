import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isIsoDate, nightsBetween, type DateRange } from "./dates";

export type Block = DateRange & { id: string; reason: "manual_block" | "booking" };
const MAX_NIGHTS = 366;

export function parseBlockInput({ firstNight, lastNight, today }: { firstNight: string; lastNight: string; today: string }): { range: DateRange } | { error: string } {
  if (!isIsoDate(firstNight) || !isIsoDate(lastNight)) return { error: "Enter both dates." };
  if (lastNight < firstNight) return { error: "The last night can't be before the first." };
  if (firstNight < today) return { error: "You can't block dates in the past." };
  const range = { start: firstNight, end: addDays(lastNight, 1) };
  if (nightsBetween(range.start, range.end) > MAX_NIGHTS) return { error: "Block at most 366 nights at a time." };
  return { range };
}

export async function listBlocks(supabase: SupabaseClient, propertyId: string): Promise<Block[]> {
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, start_date, end_date, reason")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: true });
  if (error) {
    if (error.code === "22P02") return [];
    throw error;
  }
  return (data ?? []).map((b) => ({ id: b.id, start: b.start_date, end: b.end_date, reason: b.reason }));
}

export async function createBlock(supabase: SupabaseClient, propertyId: string, range: DateRange): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("availability_blocks")
    .insert({ property_id: propertyId, start_date: range.start, end_date: range.end, reason: "manual_block" });
  if (!error) return { error: null };
  // CAL-10: the exclusion constraint is the authority on overlap.
  if (error.code === "23P01") return { error: "Those dates overlap a block you already have." };
  return { error: error.message };
}

export async function deleteBlock(supabase: SupabaseClient, blockId: string): Promise<{ error: string | null }> {
  const { data: found, error: readError } = await supabase
    .from("availability_blocks")
    .select("id, reason")
    .eq("id", blockId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!found) return { error: "Block not found." };
  if (found.reason !== "manual_block") return { error: "Bookings can't be removed here." };
  const { error } = await supabase.from("availability_blocks").delete().eq("id", blockId).eq("reason", "manual_block");
  return { error: error ? error.message : null };
}
