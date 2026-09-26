import type { SupabaseClient } from "@supabase/supabase-js";

// The token-scoped conversation library every later guest-chat piece calls
// (spec §4, AI-17, SEC-06, SEC-07). Every function here takes a service-role
// client and, for guest-facing calls, resolves token -> conversation first,
// then scopes every read and write to that conversation's id. Nothing here
// ever trusts a property id supplied by the caller for anything other than
// starting a brand new conversation against a published property.

export type Sender = "guest" | "ai" | "host";
export type ChatMessage = { id: string; sender: Sender; body: string; createdAt: string };
export type Conversation = {
  id: string;
  propertyId: string;
  aiState: "enquiry" | "payment" | "stay";
  aiEnabled: boolean;
  escalated: boolean;
};

export const MAX_GUEST_MESSAGE = 1000;
export const GUEST_MESSAGES_PER_DAY = 60;

const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// The token is the credential (SEC-06): anything that isn't exactly 64
// lowercase hex characters is rejected without ever reaching the database.
export function isToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

// Only inserts for a property that both exists and is published. A
// malformed id (not a uuid) comes back from Postgres as 22P02, which is
// treated the same as "no such property" rather than thrown.
export async function startConversation(
  service: SupabaseClient,
  propertyId: string,
): Promise<{ token: string } | { error: "not_found" }> {
  const { data: property, error: lookupError } = await service
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("published", true)
    .maybeSingle();
  if (lookupError) {
    if (lookupError.code !== "22P02") throw lookupError;
  }
  if (!property) return { error: "not_found" };

  const { data, error } = await service
    .from("conversations")
    .insert({ property_id: propertyId })
    .select("guest_token")
    .single();
  if (error) throw error;
  return { token: data.guest_token as string };
}

// Returns null for a non-token string without ever querying the database
// (SEC-06), and null (not a throw) when the token doesn't resolve to a row.
export async function getConversation(service: SupabaseClient, token: string): Promise<Conversation | null> {
  if (!isToken(token)) return null;

  const { data, error } = await service
    .from("conversations")
    .select("id, property_id, ai_state, ai_enabled, escalated")
    .eq("guest_token", token)
    .maybeSingle();
  if (error) {
    if (error.code !== "22P02") throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    propertyId: data.property_id,
    aiState: data.ai_state,
    aiEnabled: data.ai_enabled,
    escalated: data.escalated,
  };
}

// Oldest first, capped at 200 (spec §4) so a very long-running conversation
// never sends an unbounded payload to the model or the browser. The query
// itself fetches the NEWEST 200 (descending, with the same id tie-break
// `recentHistory` in agent.ts uses for its own capped query, since
// `created_at` alone doesn't guarantee a unique order) and the result is
// reversed in JS back to oldest-first — the opposite (ascending + limit)
// would freeze on the same oldest 200 rows forever once a conversation
// passes the cap, so new messages would never appear.
export async function listMessages(service: SupabaseClient, conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await service
    .from("messages")
    .select("id, sender, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (error) {
    if (error.code !== "22P02") throw error;
    return [];
  }
  return (data ?? []).reverse().map((row) => ({
    id: row.id,
    sender: row.sender as Sender,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function addMessage(
  service: SupabaseClient,
  conversationId: string,
  sender: Sender,
  body: string,
): Promise<ChatMessage> {
  const { data, error } = await service
    .from("messages")
    .insert({ conversation_id: conversationId, sender, body })
    .select("id, sender, body, created_at")
    .single();
  if (error) throw error;
  return { id: data.id, sender: data.sender as Sender, body: data.body, createdAt: data.created_at };
}

// Counts guest messages in the last 24h, for the GUEST_MESSAGES_PER_DAY cap.
export async function guestMessagesToday(service: SupabaseClient, conversationId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await service
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender", "guest")
    .gte("created_at", since);
  if (error) {
    if (error.code !== "22P02") throw error;
    return 0;
  }
  return count ?? 0;
}

// Marks the conversation escalated and turns the AI off. ai_enabled=false
// is the backstop the orchestrator and the DB trigger both check before
// letting the AI speak again.
export async function escalate(service: SupabaseClient, conversationId: string, reason: string): Promise<void> {
  const { error } = await service
    .from("conversations")
    .update({ escalated: true, ai_enabled: false, escalation_reason: reason })
    .eq("id", conversationId);
  if (error) throw error;
}

export function parseGuestMessage(text: string): { body: string } | { error: string } {
  const body = text.trim();
  if (!body) return { error: "Type a message first." };
  if (body.length > MAX_GUEST_MESSAGE) return { error: "Messages can be up to 1,000 characters." };
  return { body };
}
