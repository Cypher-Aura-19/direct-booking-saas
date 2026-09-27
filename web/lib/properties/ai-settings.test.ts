// @vitest-environment node
import { test, expect, beforeAll, afterAll } from "vitest";
import {
  AI_SWITCHES,
  DEFAULT_AI_SETTINGS,
  mergeAiSettings,
  parseAiSettings,
  getAiSettings,
  updateAiSettings,
} from "./ai-settings";
import { createProperty } from "./basics";
import { createTestHostWithOrg } from "../../tests/helpers";

// @req AIC-01
test("default settings turn every switch on except sharing wifi and gate codes early", () => {
  expect(DEFAULT_AI_SETTINGS.switches.share_wifi_gate_codes).toBe(false);
  for (const s of AI_SWITCHES) {
    if (s.key === "share_wifi_gate_codes") continue;
    expect(DEFAULT_AI_SETTINGS.switches[s.key]).toBe(true);
  }
  expect(DEFAULT_AI_SETTINGS.neverSay).toBe("");
});

test("mergeAiSettings backfills a bare '{}' row with defaults", () => {
  expect(mergeAiSettings({})).toEqual(DEFAULT_AI_SETTINGS);
  expect(mergeAiSettings(null)).toEqual(DEFAULT_AI_SETTINGS);
});

test("mergeAiSettings keeps explicit values and backfills only missing keys", () => {
  const merged = mergeAiSettings({ switches: { answer_house_rules: false }, neverSay: "no refunds" });
  expect(merged.switches.answer_house_rules).toBe(false);
  expect(merged.switches.give_directions).toBe(true);
  expect(merged.neverSay).toBe("no refunds");
});

test("parseAiSettings reads native checkbox form fields", () => {
  const input: Record<string, unknown> = { answer_house_rules: "on", neverSay: "  never mention pets  " };
  const parsed = parseAiSettings(input);
  if (!parsed.ok) throw new Error("expected ok");
  expect(parsed.value.switches.answer_house_rules).toBe(true);
  expect(parsed.value.switches.give_directions).toBe(false);
  expect(parsed.value.neverSay).toBe("never mention pets");
});

test("parseAiSettings rejects an overlong prohibition", () => {
  const parsed = parseAiSettings({ neverSay: "x".repeat(501) });
  expect(parsed).toMatchObject({ ok: false });
});

let host: Awaited<ReturnType<typeof createTestHostWithOrg>>;
let propertyId: string;

beforeAll(async () => {
  host = await createTestHostWithOrg();
  const { propertyId: id, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Test Place", property_type: "cabin", address: "Somewhere", base_rate_cents: 100_000, max_guests: 2 },
  });
  if (error) throw new Error(error);
  propertyId = id!;
});

afterAll(async () => {
  await host?.cleanup();
});

// @req AIC-01
test("getAiSettings on a freshly created property returns the defaults", async () => {
  expect(await getAiSettings(host.supabase, propertyId)).toEqual(DEFAULT_AI_SETTINGS);
});

test("updateAiSettings persists and getAiSettings reads it back", async () => {
  const settings = { switches: { ...DEFAULT_AI_SETTINGS.switches, recommend_nearby: false }, neverSay: "no refunds" };
  const { error } = await updateAiSettings(host.supabase, propertyId, settings);
  expect(error).toBeNull();
  expect(await getAiSettings(host.supabase, propertyId)).toEqual(settings);
});
