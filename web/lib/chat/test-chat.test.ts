// web/lib/chat/test-chat.test.ts
// @vitest-environment node
import { test, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runTestTurn, TEST_CHAT_HISTORY_LIMIT } from "./test-chat";
import { ScriptedModel, type ModelTurn } from "./model";
import { createProperty, setPropertyPublished } from "../properties/basics";
import { updateKnowledgeBase } from "../properties/knowledge-base";
import { DEFAULT_AI_SETTINGS } from "../properties/ai-settings";
import { createTestHostWithOrg, supabaseAdmin } from "../../tests/helpers";

const TODAY = "2026-10-01";

function respond(reply: string, escalate = false, escalation_reason?: string): ModelTurn {
  return { toolCall: { name: "respond", args: { reply, escalate, ...(escalation_reason ? { escalation_reason } : {}) } } };
}

let host: Awaited<ReturnType<typeof createTestHostWithOrg>>;
let service: SupabaseClient;
let propertyId: string;

beforeAll(async () => {
  host = await createTestHostWithOrg();
  service = supabaseAdmin();
  const { propertyId: id, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Test Place", property_type: "cabin", address: "A secret lane", base_rate_cents: 100_000, max_guests: 2 },
  });
  if (error) throw new Error(error);
  propertyId = id!;
  await updateKnowledgeBase(host.supabase, propertyId, { wifi_password: "test-wifi-pass", geyser: "Gas geyser" });
  await setPropertyPublished(host.supabase, propertyId, true);
});

afterAll(async () => {
  await host?.cleanup();
});

// @req AIC-14
test("a scripted reply comes back without creating any conversation row", async () => {
  const model = new ScriptedModel([respond("Yes, there is a gas geyser.")]);
  const result = await runTestTurn({
    service: host.supabase,
    model,
    propertyId,
    settings: DEFAULT_AI_SETTINGS,
    history: [],
    message: "Is there hot water?",
    today: TODAY,
  });
  expect(result).toEqual({ reply: "Yes, there is a gas geyser.", escalated: false });

  const { count, error } = await service.from("conversations").select("id", { count: "exact", head: true }).eq("property_id", propertyId);
  if (error) throw error;
  expect(count).toBe(0);
});

// @req AIC-14
test("a disabled switch declines in the test chat exactly as it would for a real guest", async () => {
  const settings = { ...DEFAULT_AI_SETTINGS, switches: { ...DEFAULT_AI_SETTINGS.switches, give_directions: false } };
  const model = new ScriptedModel([respond("should never be reached")]);
  const result = await runTestTurn({
    service: host.supabase,
    model,
    propertyId,
    settings,
    history: [],
    message: "How do I get there from the airport?",
    today: TODAY,
  });
  expect(result).toMatchObject({ escalated: true });
  expect(model.calls).toHaveLength(0);
});

test("a long test conversation is rejected with a plain error, not a crash", async () => {
  const history = Array.from({ length: TEST_CHAT_HISTORY_LIMIT }, (_, i) => ({
    role: (i % 2 === 0 ? "guest" : "ai") as const,
    text: `message ${i}`,
  }));
  const result = await runTestTurn({
    service: host.supabase,
    model: new ScriptedModel([]),
    propertyId,
    settings: DEFAULT_AI_SETTINGS,
    history,
    message: "one more?",
    today: TODAY,
  });
  expect(result).toMatchObject({ error: expect.any(String) });
});
