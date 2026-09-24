// @vitest-environment node
import { test, expect } from "vitest";
import { createProperty, type PropertyBasics } from "./basics";
import { parseKnowledgeBase, getKnowledgeBase, updateKnowledgeBase, type KnowledgeBase } from "./knowledge-base";
import { createTestHostWithOrg } from "../../tests/helpers";

const BASICS: PropertyBasics = {
  name: "Pine Cabin",
  property_type: "cabin",
  address: "Nathia Gali",
  base_rate_cents: 1_200_000,
  max_guests: 4,
};

async function roundTrip(knowledgeBase: KnowledgeBase) {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
    const { error } = await updateKnowledgeBase(host.supabase, propertyId!, knowledgeBase);
    expect(error).toBeNull();
    return await getKnowledgeBase(host.supabase, propertyId!);
  } finally {
    await host.cleanup();
  }
}

// @req PROP-09
test("knowledge base stores wifi credentials and gate code", async () => {
  const kb = { wifi_name: "PineCabin-5G", wifi_password: "guest-4821", gate_code: "1947#" };
  expect(await roundTrip(kb)).toEqual(kb);
});

// @req PROP-10
test("knowledge base stores geyser, generator, AC and parking instructions", async () => {
  const kb = {
    geyser: "Gas geyser switch is behind the kitchen door. Give it 10 minutes.",
    generator: "UPS covers lights and wifi. Generator starts itself after 2 minutes of load-shedding.",
    ac: "Remote is in the bedside drawer. Please keep it at 24.",
    parking: "Two cars inside the gate; more on the street.",
  };
  expect(await roundTrip(kb)).toEqual(kb);
});

// @req PROP-11
test("knowledge base stores check-in and checkout times, and rejects malformed times", async () => {
  const kb = { check_in_time: "14:00", checkout_time: "11:30" };
  expect(await roundTrip(kb)).toEqual(kb);

  expect(parseKnowledgeBase({ check_in_time: "2pm" })).toMatchObject({ ok: false, error: expect.stringMatching(/check-in/i) });
  expect(parseKnowledgeBase({ checkout_time: "24:00" })).toMatchObject({ ok: false, error: expect.stringMatching(/checkout/i) });
});

// @req PROP-12
test("knowledge base stores directions, nearby food and attractions", async () => {
  const kb = {
    directions: "From Abbottabad take the Murree road; turn left after the PTDC motel.",
    nearby_food: "Nathia Gali bazaar, 10 minutes' walk — try the chapli kebab stall.",
    nearby_attractions: "Mushkpuri trail starts 1 km away. Pipeline track is flat and easy.",
  };
  expect(await roundTrip(kb)).toEqual(kb);
});

test("parseKnowledgeBase trims, drops empty and unknown fields, and caps length", () => {
  expect(
    parseKnowledgeBase({ wifi_name: "  Pine  ", gate_code: "   ", favourite_colour: "blue" }),
  ).toEqual({ ok: true, value: { wifi_name: "Pine" } });
  expect(parseKnowledgeBase({ wifi_password: "x".repeat(201) })).toMatchObject({ ok: false });
  expect(parseKnowledgeBase({ directions: "x".repeat(2001) })).toMatchObject({ ok: false });
});

// @req PROP-14
test("a host cannot read or overwrite another organisation's knowledge base", async () => {
  const owner = await createTestHostWithOrg();
  const intruder = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(owner.supabase, { organizationId: owner.organizationId, basics: BASICS });
    await updateKnowledgeBase(owner.supabase, propertyId!, { gate_code: "1947#" });

    expect(await getKnowledgeBase(intruder.supabase, propertyId!)).toBeNull();
    expect((await updateKnowledgeBase(intruder.supabase, propertyId!, { gate_code: "0000" })).error).not.toBeNull();

    expect(await getKnowledgeBase(owner.supabase, propertyId!)).toEqual({ gate_code: "1947#" });
  } finally {
    await owner.cleanup();
    await intruder.cleanup();
  }
});
