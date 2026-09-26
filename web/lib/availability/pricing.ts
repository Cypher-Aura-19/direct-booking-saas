import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isIsoDate } from "./dates";

export type StaySettings = { minimumStay: number; advancePercent: number };
export type SeasonalRule = { id: string; start: string; end: string; rateCents: number; minimumStay: number };

const STAY_SETTINGS_COLUMNS = "minimum_stay, advance_percent";
const SEASONAL_RULE_COLUMNS = "id, start_date, end_date, rate_cents, minimum_stay";

export function parseStaySettings(input: { minimumStay: string; advancePercent: string }): { settings: StaySettings } | { error: string } {
  const minimumStay = Number(String(input.minimumStay ?? "").trim());
  const advancePercent = Number(String(input.advancePercent ?? "").trim());
  if (!Number.isInteger(minimumStay) || minimumStay < 1 || minimumStay > 60) {
    return { error: "Minimum stay must be between 1 and 60 nights." };
  }
  if (!Number.isInteger(advancePercent) || advancePercent < 0 || advancePercent > 100) {
    return { error: "Advance must be between 0% and 100%." };
  }
  return { settings: { minimumStay, advancePercent } };
}

export function parseSeasonalRule(input: {
  firstNight: string;
  lastNight: string;
  rate: string;
  minimumStay: string;
  today: string;
}): { rule: Omit<SeasonalRule, "id"> } | { error: string } {
  const { firstNight, lastNight, rate, minimumStay, today } = input;
  if (!isIsoDate(firstNight) || !isIsoDate(lastNight)) return { error: "Enter both dates." };
  if (lastNight < firstNight) return { error: "The last night can't be before the first." };
  if (firstNight < today) return { error: "Seasonal rates can't start in the past." };

  const rupees = Number(String(rate ?? "").trim());
  if (!Number.isInteger(rupees) || rupees <= 0) return { error: "Enter a nightly rate in rupees." };

  const minimumStayInput = String(minimumStay ?? "").trim();
  const minimumStayValue = minimumStayInput === "" ? 1 : Number(minimumStayInput);
  if (!Number.isInteger(minimumStayValue) || minimumStayValue < 1 || minimumStayValue > 60) {
    return { error: "Minimum stay must be between 1 and 60 nights." };
  }

  return { rule: { start: firstNight, end: addDays(lastNight, 1), rateCents: rupees * 100, minimumStay: minimumStayValue } };
}

export async function getStaySettings(supabase: SupabaseClient, propertyId: string): Promise<StaySettings | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(STAY_SETTINGS_COLUMNS)
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;
  return { minimumStay: data.minimum_stay, advancePercent: data.advance_percent };
}

export async function updateStaySettings(
  supabase: SupabaseClient,
  propertyId: string,
  settings: StaySettings,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("properties")
    .update({ minimum_stay: settings.minimumStay, advance_percent: settings.advancePercent })
    .eq("id", propertyId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Property not found." };
  return { error: null };
}

export async function listSeasonalRules(supabase: SupabaseClient, propertyId: string): Promise<SeasonalRule[]> {
  const { data, error } = await supabase
    .from("seasonal_pricing_rules")
    .select(SEASONAL_RULE_COLUMNS)
    .eq("property_id", propertyId)
    .order("start_date", { ascending: true });
  if (error) {
    if (error.code === "22P02") return [];
    throw error;
  }
  return (data ?? []).map((r) => ({ id: r.id, start: r.start_date, end: r.end_date, rateCents: r.rate_cents, minimumStay: r.minimum_stay }));
}

export async function createSeasonalRule(
  supabase: SupabaseClient,
  propertyId: string,
  rule: Omit<SeasonalRule, "id">,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("seasonal_pricing_rules")
    .insert({ property_id: propertyId, start_date: rule.start, end_date: rule.end, rate_cents: rule.rateCents, minimum_stay: rule.minimumStay });
  if (!error) return { error: null };
  // CAL-10: the exclusion constraint is the authority on overlap.
  if (error.code === "23P01") return { error: "That season overlaps another seasonal rate." };
  return { error: error.message };
}

export async function deleteSeasonalRule(supabase: SupabaseClient, ruleId: string): Promise<{ error: string | null }> {
  const { data: found, error: readError } = await supabase
    .from("seasonal_pricing_rules")
    .select("id")
    .eq("id", ruleId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!found) return { error: "Rate not found." };
  const { error } = await supabase.from("seasonal_pricing_rules").delete().eq("id", ruleId);
  return { error: error ? error.message : null };
}
