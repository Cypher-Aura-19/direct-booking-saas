import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isIsoDate } from "../availability/dates";
import { quoteStay } from "../availability/quote";
import { formatRupees } from "../properties/basics";
import type { ToolDeclaration } from "./model";

// The one tool that touches live data (AI-11, AI-12), plus the tool the
// model must always end a turn with. Both are declared here so the
// orchestrator and the tests share one source of truth for their JSON
// schemas.
export const TOOL_DECLARATIONS: ToolDeclaration[] = [
  {
    name: "check_stay",
    description: "Check live availability and price for a date range at this property.",
    parameters: {
      type: "object",
      properties: {
        check_in: { type: "string", description: "YYYY-MM-DD" },
        check_out: { type: "string", description: "YYYY-MM-DD, the checkout morning" },
      },
      required: ["check_in", "check_out"],
    },
  },
  {
    name: "respond",
    description: "Send the reply to the guest, and flag whether the host needs to step in.",
    parameters: {
      type: "object",
      properties: {
        reply: { type: "string" },
        escalate: { type: "boolean" },
        escalation_reason: { type: "string", enum: ["unknown", "human", "money", "other"] },
      },
      required: ["reply", "escalate"],
    },
  },
];

export type RespondArgs = { reply: string; escalate: boolean; escalation_reason?: string };

const MAX_REPLY_LENGTH = 2000;
const ESCALATION_REASONS = new Set(["unknown", "human", "money", "other"]);

// The model is untrusted input: whatever it hands back for `respond` is
// validated exactly like a guest form submission before anything downstream
// (the reply scanner, the escalation write) trusts it.
export function parseRespondArgs(args: unknown): RespondArgs | null {
  if (typeof args !== "object" || args === null) return null;
  const value = args as Record<string, unknown>;

  if (typeof value.reply !== "string" || value.reply.length === 0 || value.reply.length > MAX_REPLY_LENGTH) return null;
  if (typeof value.escalate !== "boolean") return null;
  if (value.escalation_reason !== undefined) {
    if (typeof value.escalation_reason !== "string" || !ESCALATION_REASONS.has(value.escalation_reason)) return null;
  }

  return {
    reply: value.reply,
    escalate: value.escalate,
    escalation_reason: value.escalation_reason as string | undefined,
  };
}

// Same window as M6's getPublicAvailability (web/lib/public/catalogue.ts),
// but read with the service client for a property regardless of published
// state: this is server-side chat logic scoped by the conversation's own
// property_id, not a public catalogue read.
const AVAILABILITY_HORIZON_DAYS = 366;

type CheckStayResult =
  | { ok: true; nights: number; total: string; nightly: { rate: string; nights: number }[] }
  | { ok: false; reason: string; minimumStay: number };

function groupByRate(breakdown: { night: string; rateCents: number }[]): { rateCents: number; nights: number }[] {
  const groups: { rateCents: number; nights: number }[] = [];
  for (const { rateCents } of breakdown) {
    const last = groups[groups.length - 1];
    if (last && last.rateCents === rateCents) last.nights += 1;
    else groups.push({ rateCents, nights: 1 });
  }
  return groups;
}

const UNAVAILABLE_REASON = "Those dates are not available.";
const INVALID_REASON = "Enter valid check-in and check-out dates.";
const PAST_REASON = "Those dates are in the past.";

export async function runCheckStay(
  service: SupabaseClient,
  propertyId: string,
  args: unknown,
  today: string,
): Promise<CheckStayResult> {
  const value = typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};
  const checkIn = typeof value.check_in === "string" ? value.check_in : "";
  const checkOut = typeof value.check_out === "string" ? value.check_out : "";
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return { ok: false, reason: INVALID_REASON, minimumStay: 1 };

  const horizon = addDays(today, AVAILABILITY_HORIZON_DAYS);
  const [property, blocks, rules] = await Promise.all([
    service.from("properties").select("base_rate_cents, minimum_stay").eq("id", propertyId).maybeSingle(),
    service
      .from("availability_blocks")
      .select("start_date, end_date")
      .eq("property_id", propertyId)
      .gt("end_date", today)
      .lt("start_date", horizon),
    service
      .from("seasonal_pricing_rules")
      .select("start_date, end_date, rate_cents, minimum_stay")
      .eq("property_id", propertyId)
      .gt("end_date", today)
      .lt("start_date", horizon),
  ]);
  for (const { error } of [property, blocks, rules]) if (error) throw error;
  if (!property.data) return { ok: false, reason: INVALID_REASON, minimumStay: 1 };

  const quote = quoteStay(checkIn, checkOut, {
    baseRateCents: property.data.base_rate_cents,
    minimumStay: property.data.minimum_stay,
    rules: (rules.data ?? []).map((r) => ({ start: r.start_date, end: r.end_date, rateCents: r.rate_cents, minimumStay: r.minimum_stay })),
    blocks: (blocks.data ?? []).map((b) => ({ start: b.start_date, end: b.end_date })),
    today,
  });

  if (!quote.ok) {
    const reason =
      quote.reason === "unavailable"
        ? UNAVAILABLE_REASON
        : quote.reason === "minimum_stay"
          ? `The minimum stay for those dates is ${quote.minimumStay} nights.`
          : quote.reason === "past"
            ? PAST_REASON
            : INVALID_REASON;
    return { ok: false, reason, minimumStay: quote.minimumStay };
  }

  return {
    ok: true,
    nights: quote.nights,
    total: formatRupees(quote.totalCents),
    nightly: groupByRate(quote.breakdown).map((g) => ({ rate: formatRupees(g.rateCents), nights: g.nights })),
  };
}
