// @vitest-environment node
import { test, expect } from "vitest";
import {
  isToken,
  startConversation,
  getConversation,
  listMessages,
  addMessage,
  guestMessagesToday,
  escalate,
  parseGuestMessage,
  MAX_GUEST_MESSAGE,
} from "./conversations";
import { createProperty } from "../properties/basics";
import { setPropertyPublished } from "../properties/basics";
import { createTestHostWithOrg, supabaseAdmin } from "../../tests/helpers";

const BASICS = {
  name: "Sunset Villa",
  property_type: "villa" as const,
  address: "Mall Road, Murree",
  base_rate_cents: 1_500_000,
  max_guests: 4,
};

async function publishedProperty(host: Awaited<ReturnType<typeof createTestHostWithOrg>>) {
  const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
  await setPropertyPublished(host.supabase, propertyId!, true);
  return propertyId!;
}

// @req AI-01
test("startConversation on a published property returns a token, and the row starts in enquiry with ai enabled", async () => {
  const host = await createTestHostWithOrg();
  try {
    const propertyId = await publishedProperty(host);
    const service = supabaseAdmin();

    const result = await startConversation(service, propertyId);
    expect(result).toMatchObject({ token: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const token = (result as { token: string }).token;

    const conversation = await getConversation(service, token);
    expect(conversation).toMatchObject({ propertyId, aiState: "enquiry", aiEnabled: true, escalated: false });
  } finally {
    await host.cleanup();
  }
});

test("startConversation returns not_found for a draft property, a random uuid, or a malformed id", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId: draftId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
    const service = supabaseAdmin();

    expect(await startConversation(service, draftId!)).toEqual({ error: "not_found" });
    expect(await startConversation(service, "00000000-0000-0000-0000-000000000000")).toEqual({ error: "not_found" });
    expect(await startConversation(service, "not-a-uuid")).toEqual({ error: "not_found" });
  } finally {
    await host.cleanup();
  }
});

// @req AI-02
// @req SEC-06
test("isToken accepts only 64 lowercase hex characters", () => {
  const validToken = "a".repeat(64);
  expect(isToken(validToken)).toBe(true);
  expect(isToken(validToken.toUpperCase())).toBe(false);
  expect(isToken("a".repeat(63))).toBe(false);
  expect(isToken("g".repeat(64))).toBe(false);
});

test("getConversation returns null for a non-token string without querying", async () => {
  const service = supabaseAdmin();
  expect(await getConversation(service, "not-a-token")).toBeNull();
  expect(await getConversation(service, "a".repeat(64))).toBeNull();
});

// @req SEC-07
test("a token only ever resolves its own conversation, and messages never leak across conversations", async () => {
  const host = await createTestHostWithOrg();
  try {
    const propertyId = await publishedProperty(host);
    const service = supabaseAdmin();

    const resultA = (await startConversation(service, propertyId)) as { token: string };
    const resultB = (await startConversation(service, propertyId)) as { token: string };
    const conversationA = await getConversation(service, resultA.token);
    const conversationB = await getConversation(service, resultB.token);
    expect(conversationA!.id).not.toBe(conversationB!.id);

    await addMessage(service, conversationA!.id, "guest", "Hello from A");
    await addMessage(service, conversationB!.id, "guest", "Hello from B");

    const resolved = await getConversation(service, resultA.token);
    expect(resolved!.id).toBe(conversationA!.id);

    const messagesA = await listMessages(service, conversationA!.id);
    expect(messagesA).toHaveLength(1);
    expect(messagesA[0].body).toBe("Hello from A");
  } finally {
    await host.cleanup();
  }
});

test("addMessage round-trips and listMessages returns them oldest first", async () => {
  const host = await createTestHostWithOrg();
  try {
    const propertyId = await publishedProperty(host);
    const service = supabaseAdmin();
    const { token } = (await startConversation(service, propertyId)) as { token: string };
    const conversation = await getConversation(service, token);

    const first = await addMessage(service, conversation!.id, "guest", "First message");
    const second = await addMessage(service, conversation!.id, "ai", "Second message");
    expect(first).toMatchObject({ sender: "guest", body: "First message" });
    expect(first.id).toBeTruthy();
    expect(first.createdAt).toBeTruthy();

    const messages = await listMessages(service, conversation!.id);
    expect(messages.map((m) => m.body)).toEqual(["First message", "Second message"]);
    expect(messages.map((m) => m.sender)).toEqual(["guest", "ai"]);
    expect(second.sender).toBe("ai");
  } finally {
    await host.cleanup();
  }
});

// @req AI-17
test("listMessages returns the newest 200 messages, oldest first, once a conversation passes the cap", async () => {
  const host = await createTestHostWithOrg();
  try {
    const propertyId = await publishedProperty(host);
    const service = supabaseAdmin();
    const { token } = (await startConversation(service, propertyId)) as { token: string };
    const conversation = await getConversation(service, token);

    // Insert 205 messages directly with explicit, strictly increasing
    // created_at values (one second apart) so ordering is deterministic
    // regardless of how fast the inserts execute — a plain sequential
    // addMessage loop would rely on now() ticking forward between round
    // trips, which is not guaranteed at this volume.
    const TOTAL = 205;
    const base = Date.now();
    const rows = Array.from({ length: TOTAL }, (_, i) => ({
      conversation_id: conversation!.id,
      sender: "guest" as const,
      body: `msg-${String(i).padStart(3, "0")}`,
      created_at: new Date(base + i * 1000).toISOString(),
    }));
    const { error: insertError } = await service.from("messages").insert(rows);
    expect(insertError).toBeNull();

    const messages = await listMessages(service, conversation!.id);
    expect(messages).toHaveLength(200);
    // The newest 200 of 205 are indices 5..204 ("msg-005".."msg-204").
    expect(messages[0].body).toBe("msg-005");
    expect(messages[messages.length - 1].body).toBe("msg-204");
    const bodies = messages.map((m) => m.body);
    expect(bodies).not.toContain("msg-000");
    expect(bodies).not.toContain("msg-004");
    // Still oldest-first within the returned window.
    expect(bodies).toEqual([...bodies].sort());
  } finally {
    await host.cleanup();
  }
});

test("escalate marks the conversation escalated, disables ai, and records the reason", async () => {
  const host = await createTestHostWithOrg();
  try {
    const propertyId = await publishedProperty(host);
    const service = supabaseAdmin();
    const { token } = (await startConversation(service, propertyId)) as { token: string };
    const conversation = await getConversation(service, token);

    await escalate(service, conversation!.id, "model_error");

    const after = await getConversation(service, token);
    expect(after).toMatchObject({ escalated: true, aiEnabled: false });

    const { data, error } = await service.from("conversations").select("escalation_reason").eq("id", conversation!.id).single();
    expect(error).toBeNull();
    expect(data!.escalation_reason).toBe("model_error");
  } finally {
    await host.cleanup();
  }
});

test("guestMessagesToday counts only messages sent by the guest", async () => {
  const host = await createTestHostWithOrg();
  try {
    const propertyId = await publishedProperty(host);
    const service = supabaseAdmin();
    const { token } = (await startConversation(service, propertyId)) as { token: string };
    const conversation = await getConversation(service, token);

    await addMessage(service, conversation!.id, "guest", "One");
    await addMessage(service, conversation!.id, "ai", "Reply");
    await addMessage(service, conversation!.id, "guest", "Two");
    await addMessage(service, conversation!.id, "host", "Host note");

    expect(await guestMessagesToday(service, conversation!.id)).toBe(2);
  } finally {
    await host.cleanup();
  }
});

test("parseGuestMessage trims whitespace and rejects empty or overlong messages", () => {
  expect(parseGuestMessage("  Hello there  ")).toEqual({ body: "Hello there" });
  expect(parseGuestMessage("   ")).toEqual({ error: "Type a message first." });
  expect(parseGuestMessage("")).toEqual({ error: "Type a message first." });
  expect(parseGuestMessage("a".repeat(MAX_GUEST_MESSAGE + 1))).toEqual({ error: "Messages can be up to 1,000 characters." });
  expect(parseGuestMessage("a".repeat(MAX_GUEST_MESSAGE))).toEqual({ body: "a".repeat(MAX_GUEST_MESSAGE) });
});
