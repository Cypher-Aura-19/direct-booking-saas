// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { createProperty } from "@/lib/properties/basics";
import {
  createSeasonalRule,
  deleteSeasonalRule,
  getStaySettings,
  listSeasonalRules,
  parseSeasonalRule,
  parseStaySettings,
  updateStaySettings,
} from "./pricing";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()!(); });

// Real ISO dates in the future relative to today, however far this suite is
// run from the year the plan was written in.
const YEAR = new Date().getFullYear() + 1;
const FIRST_NIGHT = `${YEAR}-12-20`;
const LAST_NIGHT = `${YEAR + 1}-01-02`;
const EXPECTED_END = `${YEAR + 1}-01-03`;
const PAST_YEAR = new Date().getFullYear() - 1;

async function hostWithProperty() {
  const host = await createTestHostWithOrg();
  cleanups.push(host.cleanup);
  const { propertyId } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "River Hut", property_type: "cabin", address: "Karimabad", base_rate_cents: 900_000, max_guests: 2 },
  });
  return { host, propertyId: propertyId! };
}

describe("parseStaySettings", () => {
  it("accepts a whole minimum stay and advance percentage", () => {
    expect(parseStaySettings({ minimumStay: "2", advancePercent: "50" })).toEqual({ settings: { minimumStay: 2, advancePercent: 50 } });
  });
  it("rejects a minimum stay outside 1-60", () => {
    expect(parseStaySettings({ minimumStay: "0", advancePercent: "50" })).toEqual({ error: "Minimum stay must be between 1 and 60 nights." });
    expect(parseStaySettings({ minimumStay: "61", advancePercent: "50" })).toEqual({ error: "Minimum stay must be between 1 and 60 nights." });
    expect(parseStaySettings({ minimumStay: "1.5", advancePercent: "50" })).toEqual({ error: "Minimum stay must be between 1 and 60 nights." });
  });
  it("rejects an advance percentage outside 0-100", () => {
    expect(parseStaySettings({ minimumStay: "2", advancePercent: "-1" })).toEqual({ error: "Advance must be between 0% and 100%." });
    expect(parseStaySettings({ minimumStay: "2", advancePercent: "101" })).toEqual({ error: "Advance must be between 0% and 100%." });
  });
});

describe("parseSeasonalRule", () => {
  const today = `${PAST_YEAR + 1}-01-01`;

  it("turns an inclusive first/last night into an exclusive range with rate in paisa", () => {
    expect(parseSeasonalRule({ firstNight: FIRST_NIGHT, lastNight: LAST_NIGHT, rate: "20000", minimumStay: "3", today })).toEqual({
      rule: { start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 3 },
    });
  });
  it("defaults minimum stay to 1 when blank", () => {
    expect(parseSeasonalRule({ firstNight: FIRST_NIGHT, lastNight: LAST_NIGHT, rate: "20000", minimumStay: "", today })).toEqual({
      rule: { start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 1 },
    });
  });
  it("rejects missing dates", () => {
    expect(parseSeasonalRule({ firstNight: "", lastNight: LAST_NIGHT, rate: "20000", minimumStay: "1", today })).toEqual({ error: "Enter both dates." });
  });
  it("rejects a last night before the first", () => {
    expect(parseSeasonalRule({ firstNight: LAST_NIGHT, lastNight: FIRST_NIGHT, rate: "20000", minimumStay: "1", today })).toEqual({
      error: "The last night can't be before the first.",
    });
  });
  it("rejects a season starting in the past", () => {
    expect(parseSeasonalRule({ firstNight: `${PAST_YEAR}-01-01`, lastNight: `${PAST_YEAR}-01-05`, rate: "20000", minimumStay: "1", today })).toEqual({
      error: "Seasonal rates can't start in the past.",
    });
  });
  it("rejects a non-positive or non-whole rate", () => {
    expect(parseSeasonalRule({ firstNight: FIRST_NIGHT, lastNight: LAST_NIGHT, rate: "0", minimumStay: "1", today })).toEqual({ error: "Enter a nightly rate in rupees." });
    expect(parseSeasonalRule({ firstNight: FIRST_NIGHT, lastNight: LAST_NIGHT, rate: "", minimumStay: "1", today })).toEqual({ error: "Enter a nightly rate in rupees." });
    expect(parseSeasonalRule({ firstNight: FIRST_NIGHT, lastNight: LAST_NIGHT, rate: "12.5", minimumStay: "1", today })).toEqual({ error: "Enter a nightly rate in rupees." });
  });
  it("rejects a minimum stay outside 1-60", () => {
    expect(parseSeasonalRule({ firstNight: FIRST_NIGHT, lastNight: LAST_NIGHT, rate: "20000", minimumStay: "61", today })).toEqual({
      error: "Minimum stay must be between 1 and 60 nights.",
    });
  });
});

// @req CAL-04
it("a host can create a seasonal rule and list it", async () => {
  const { host, propertyId } = await hostWithProperty();
  expect(await createSeasonalRule(host.supabase, propertyId, { start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 3 })).toEqual({ error: null });
  expect(await listSeasonalRules(host.supabase, propertyId)).toEqual([{ id: expect.any(String), start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 3 }]);
});

// @req CAL-10
it("an overlapping seasonal rule is rejected with a readable message", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createSeasonalRule(host.supabase, propertyId, { start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 3 });
  const overlapStart = `${YEAR}-12-25`;
  expect(await createSeasonalRule(host.supabase, propertyId, { start: overlapStart, end: `${YEAR + 1}-01-10`, rateCents: 1_500_000, minimumStay: 1 })).toEqual({
    error: "That season overlaps another seasonal rate.",
  });
  expect(await createSeasonalRule(host.supabase, propertyId, { start: EXPECTED_END, end: `${YEAR + 1}-01-10`, rateCents: 1_500_000, minimumStay: 1 })).toEqual({ error: null });
});

// @req CAL-05
// @req CAL-06
it("a host can update the minimum stay and advance percentage", async () => {
  const { host, propertyId } = await hostWithProperty();
  expect(await getStaySettings(host.supabase, propertyId)).toEqual({ minimumStay: 1, advancePercent: 30 });
  expect(await updateStaySettings(host.supabase, propertyId, { minimumStay: 2, advancePercent: 50 })).toEqual({ error: null });
  expect(await getStaySettings(host.supabase, propertyId)).toEqual({ minimumStay: 2, advancePercent: 50 });
});

it("deleting a seasonal rule removes it", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createSeasonalRule(host.supabase, propertyId, { start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 3 });
  const [rule] = await listSeasonalRules(host.supabase, propertyId);
  expect(await deleteSeasonalRule(host.supabase, rule.id)).toEqual({ error: null });
  expect(await listSeasonalRules(host.supabase, propertyId)).toEqual([]);
});

// @req PROP-14
it("another host cannot create, list or delete this property's seasonal rules or settings", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createSeasonalRule(host.supabase, propertyId, { start: FIRST_NIGHT, end: EXPECTED_END, rateCents: 2_000_000, minimumStay: 3 });
  const other = await createTestHostWithOrg();
  cleanups.push(other.cleanup);

  expect((await createSeasonalRule(other.supabase, propertyId, { start: EXPECTED_END, end: `${YEAR + 1}-01-10`, rateCents: 1_500_000, minimumStay: 1 })).error).not.toBeNull();
  expect(await listSeasonalRules(other.supabase, propertyId)).toEqual([]);
  expect((await updateStaySettings(other.supabase, propertyId, { minimumStay: 5, advancePercent: 10 })).error).not.toBeNull();

  const [rule] = await listSeasonalRules(host.supabase, propertyId);
  expect(await deleteSeasonalRule(other.supabase, rule.id)).toEqual({ error: "Rate not found." });

  expect(await listSeasonalRules(host.supabase, propertyId)).toHaveLength(1);
  expect(await getStaySettings(host.supabase, propertyId)).toEqual({ minimumStay: 1, advancePercent: 30 });
});
