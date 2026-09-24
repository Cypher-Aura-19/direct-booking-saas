import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeBaseKey =
  | "wifi_name"
  | "wifi_password"
  | "gate_code"
  | "check_in_time"
  | "checkout_time"
  | "geyser"
  | "generator"
  | "ac"
  | "parking"
  | "directions"
  | "nearby_food"
  | "nearby_attractions";

export type KnowledgeBaseField = { key: KnowledgeBaseKey; label: string; kind: "text" | "time" | "long" };

export type KnowledgeBase = Partial<Record<KnowledgeBaseKey, string>>;

// The form renders from this, the parser validates from this, and M7's AI
// grounding reads these keys. One list, so the three cannot drift apart.
export const KNOWLEDGE_BASE_SECTIONS: readonly { title: string; fields: readonly KnowledgeBaseField[] }[] = [
  {
    title: "Access",
    fields: [
      { key: "wifi_name", label: "Wifi network name", kind: "text" },
      { key: "wifi_password", label: "Wifi password", kind: "text" },
      { key: "gate_code", label: "Gate or door code", kind: "text" },
    ],
  },
  {
    title: "Arrival and departure",
    fields: [
      { key: "check_in_time", label: "Check-in from", kind: "time" },
      { key: "checkout_time", label: "Checkout by", kind: "time" },
    ],
  },
  {
    title: "Around the house",
    fields: [
      { key: "geyser", label: "Geyser and hot water", kind: "long" },
      { key: "generator", label: "Generator or UPS during load-shedding", kind: "long" },
      { key: "ac", label: "Air conditioning", kind: "long" },
      { key: "parking", label: "Parking", kind: "long" },
    ],
  },
  {
    title: "Getting here and nearby",
    fields: [
      { key: "directions", label: "Directions", kind: "long" },
      { key: "nearby_food", label: "Nearby food", kind: "long" },
      { key: "nearby_attractions", label: "Nearby attractions", kind: "long" },
    ],
  },
];

const FIELDS = KNOWLEDGE_BASE_SECTIONS.flatMap((section) => section.fields);
const MAX_LENGTH = { text: 200, time: 5, long: 2000 } as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseKnowledgeBase(
  input: Record<string, unknown>,
): { ok: true; value: KnowledgeBase } | { ok: false; error: string } {
  const value: KnowledgeBase = {};
  for (const field of FIELDS) {
    const raw = String(input[field.key] ?? "").trim();
    if (!raw) continue;
    const max = MAX_LENGTH[field.kind];
    if (raw.length > max) return { ok: false, error: `${field.label} is too long (up to ${max} characters).` };
    if (field.kind === "time" && !TIME_PATTERN.test(raw)) {
      return { ok: false, error: `${field.label} must be a time like 14:00.` };
    }
    value[field.key] = raw;
  }
  return { ok: true, value };
}

export async function getKnowledgeBase(supabase: SupabaseClient, propertyId: string): Promise<KnowledgeBase | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("knowledge_base")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;
  return data.knowledge_base as KnowledgeBase;
}

export async function updateKnowledgeBase(
  supabase: SupabaseClient,
  propertyId: string,
  knowledgeBase: KnowledgeBase,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("properties")
    .update({ knowledge_base: knowledgeBase })
    .eq("id", propertyId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Property not found." };
  return { error: null };
}
