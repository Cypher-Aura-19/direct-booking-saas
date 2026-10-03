"use server";

import { revalidatePath } from "next/cache";
import { shortenRetention } from "@/lib/hotel-eye/records";
import { dashboardContext } from "../_lib/context";

const MESSAGE = {
  invalid: "Pick a valid date.",
  in_past: "Pick a date from tomorrow on.",
  beyond_cap: "That is past the 90-day limit after checkout.",
  not_found: "Record not found.",
} as const;

// The host's own RLS client: another organisation's record resolves to
// "not found", and the database trigger enforces the cap regardless.
export async function shortenRetentionAction(recordId: string, date: string): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await shortenRetention(supabase, String(recordId), String(date), new Date());
  if (!result.ok) return { error: MESSAGE[result.reason] };
  revalidatePath("/dashboard", "layout");
  return { error: null };
}
