// @vitest-environment node
import { test, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runCheckStay, parseRespondArgs } from "./tools";
import { createProperty, setPropertyPublished } from "../properties/basics";
import { createBlock } from "../availability/blocks";
import { createSeasonalRule } from "../availability/pricing";
import { createTestHostWithOrg, supabaseAdmin } from "../../tests/helpers";

const TODAY = "2026-10-01";

let host: Awaited<ReturnType<typeof createTestHostWithOrg>>;
let service: SupabaseClient;
let propertyId: string;

beforeAll(async () => {
  host = await createTestHostWithOrg();
  service = supabaseAdmin();
  const { propertyId: id, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: {
      name: "Check Stay Cottage",
      property_type: "cabin",
      address: "Somewhere in the hills",
      base_rate_cents: 1_000_000,
      max_guests: 4,
    },
  });
  if (error) throw new Error(error);
  propertyId = id!;
  await setPropertyPublished(host.supabase, propertyId, true);
});

afterAll(async () => {
  await host?.cleanup();
});

// @req AI-11
test("a blocked stay is reported as not available", async () => {
  const { error } = await createBlock(service, propertyId, { start: "2026-10-10", end: "2026-10-13" });
  if (error) throw new Error(error);

  const result = await runCheckStay(service, propertyId, { check_in: "2026-10-10", check_out: "2026-10-12" }, TODAY);
  expect(result).toEqual({ ok: false, reason: "Those dates are not available.", minimumStay: 1 });
});

// @req AI-12
test("a stay spanning base and seasonal nights returns the exact quoted total, formatted", async () => {
  const { error } = await createSeasonalRule(service, propertyId, {
    start: "2026-12-20",
    end: "2026-12-25",
    rateCents: 2_000_000,
    minimumStay: 1,
  });
  if (error) throw new Error(error);

  const result = await runCheckStay(service, propertyId, { check_in: "2026-12-18", check_out: "2026-12-22" }, TODAY);
  expect(result).toEqual({
    ok: true,
    nights: 4,
    total: "Rs 60,000",
    nightly: [
      { rate: "Rs 10,000", nights: 2 },
      { rate: "Rs 20,000", nights: 2 },
    ],
  });
});

test("invalid args return ok:false without throwing", async () => {
  const result = await runCheckStay(service, propertyId, { check_in: "tomorrow" }, TODAY);
  expect(result).toMatchObject({ ok: false });
});

// A malformed (non-uuid) property id makes every `.eq("...id", propertyId)`
// read fail with a genuine Postgres error (22P02, "invalid input syntax for
// type uuid" — the same failure mode other libs in this codebase special-case,
// e.g. properties/basics.ts's getProperty), not a guest-input problem. The
// function's contract is to never throw regardless: this is the DB-hiccup
// path the orchestrator's tool-call loop must never crash on.
test("a genuine DB error resolves ok:false instead of throwing", async () => {
  await expect(
    runCheckStay(service, "not-a-valid-uuid", { check_in: "2026-10-10", check_out: "2026-10-12" }, TODAY),
  ).resolves.toMatchObject({ ok: false });
});

test("parseRespondArgs accepts valid args", () => {
  expect(parseRespondArgs({ reply: "Hi there", escalate: false })).toEqual({
    reply: "Hi there",
    escalate: false,
    escalation_reason: undefined,
  });
  expect(parseRespondArgs({ reply: "Hi", escalate: true, escalation_reason: "money" })).toEqual({
    reply: "Hi",
    escalate: true,
    escalation_reason: "money",
  });
});

test("parseRespondArgs rejects a missing reply", () => {
  expect(parseRespondArgs({ escalate: false })).toBeNull();
});

test("parseRespondArgs rejects a non-boolean escalate", () => {
  expect(parseRespondArgs({ reply: "Hi", escalate: "false" })).toBeNull();
});

test("parseRespondArgs rejects a reply over 2000 chars", () => {
  expect(parseRespondArgs({ reply: "a".repeat(2001), escalate: false })).toBeNull();
});
