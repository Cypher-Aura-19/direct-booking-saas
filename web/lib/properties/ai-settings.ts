import type { SupabaseClient } from "@supabase/supabase-js";

export type AiSwitchKey =
  | "quote_nightly_rate"
  | "quote_full_stay_total"
  | "take_booking_requests"
  | "answer_house_rules"
  | "give_directions"
  | "share_wifi_gate_codes"
  | "recommend_nearby"
  | "answer_urdu";

export type AiSwitches = Record<AiSwitchKey, boolean>;
export type AiSettings = { switches: AiSwitches; neverSay: string };

// The form renders from this list, the parser validates from it, and M8's
// enforcement (web/lib/chat/capabilities.ts, context.ts, tools.ts) reads
// these same keys — one list, so the three cannot drift apart (mirrors
// KNOWLEDGE_BASE_SECTIONS in ./knowledge-base.ts).
export const AI_SWITCHES: readonly { key: AiSwitchKey; label: string; hint: string; defaultOn: boolean }[] = [
  { key: "quote_nightly_rate", label: "Quote the nightly rate", hint: "Lets the assistant state a per-night price.", defaultOn: true },
  { key: "quote_full_stay_total", label: "Quote the full stay total", hint: "Lets the assistant total up a whole stay.", defaultOn: true },
  { key: "take_booking_requests", label: "Take booking requests", hint: "Lets a guest ask to book; you still confirm it yourself.", defaultOn: true },
  { key: "answer_house_rules", label: "Answer house rules", hint: "Pets, smoking, parties, noise and similar policies.", defaultOn: true },
  { key: "give_directions", label: "Give directions and travel help", hint: "How to reach the property.", defaultOn: true },
  { key: "share_wifi_gate_codes", label: "Share wifi and gate codes before check-in", hint: "Off by default — otherwise these are only shared once a stay begins.", defaultOn: false },
  { key: "recommend_nearby", label: "Recommend nearby food and attractions", hint: "Restaurants, sights and things to do close by.", defaultOn: true },
  { key: "answer_urdu", label: "Answer in Urdu and Roman Urdu", hint: "Off replies in English even if the guest writes in Urdu.", defaultOn: true },
] as const;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  switches: Object.fromEntries(AI_SWITCHES.map((s) => [s.key, s.defaultOn])) as AiSwitches,
  neverSay: "",
};

const MAX_NEVER_SAY = 500;

// Applies to both a freshly-created property's '{}' row (M2's default) and a
// form submission missing a key: every switch not present takes its
// documented default rather than being treated as false, so a switch added
// after a property already has saved settings keeps its default instead of
// silently turning off for every existing property.
export function mergeAiSettings(raw: unknown): AiSettings {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const rawSwitches = typeof value.switches === "object" && value.switches !== null ? (value.switches as Record<string, unknown>) : {};
  const switches = Object.fromEntries(
    AI_SWITCHES.map((s) => [s.key, typeof rawSwitches[s.key] === "boolean" ? (rawSwitches[s.key] as boolean) : s.defaultOn]),
  ) as AiSwitches;
  const neverSay = typeof value.neverSay === "string" ? value.neverSay : "";
  return { switches, neverSay };
}

// Reads native checkbox fields: "on" when checked, absent (undefined) when
// not — the same convention listing-form.tsx's amenity pills already use, so
// an unchecked box parses as false rather than as "leave unchanged".
export function parseAiSettings(input: Record<string, unknown>): { ok: true; value: AiSettings } | { ok: false; error: string } {
  const switches = Object.fromEntries(AI_SWITCHES.map((s) => [s.key, input[s.key] === "on"])) as AiSwitches;
  const neverSay = String(input.neverSay ?? "").trim();
  if (neverSay.length > MAX_NEVER_SAY) return { ok: false, error: `"Never say this" is too long (up to ${MAX_NEVER_SAY} characters).` };
  return { ok: true, value: { switches, neverSay } };
}

export async function getAiSettings(supabase: SupabaseClient, propertyId: string): Promise<AiSettings | null> {
  const { data, error } = await supabase.from("properties").select("ai_settings").eq("id", propertyId).maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;
  return mergeAiSettings(data.ai_settings);
}

export async function updateAiSettings(
  supabase: SupabaseClient,
  propertyId: string,
  settings: AiSettings,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from("properties").update({ ai_settings: settings }).eq("id", propertyId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Property not found." };
  return { error: null };
}
