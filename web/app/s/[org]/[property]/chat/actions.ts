"use server";

import { runGuestTurn } from "@/lib/chat/agent";
import { getConversation, isToken, listMessages, startConversation, type ChatMessage } from "@/lib/chat/conversations";
import { detectLanguage, langAttribute } from "@/lib/chat/language";
import { modelFromEnv } from "@/lib/chat/model";
import { localToday } from "@/lib/dashboard/analytics";
import { createServiceClient } from "@/lib/supabase/service";

// The browser's only way into guest chat (spec §4, AI-17). Thin on purpose:
// build the service client, call the token-scoped lib, and map the result to
// plain data. Nothing returned here carries another conversation's token, an
// internal id other than a message id, or an escalation reason. Every call is
// wrapped: a thrown DB error (the lib leaves some writes unhandled on
// purpose) becomes a generic message, never a crashed Server Action.

export type ChatView = {
  messages: { id: string; sender: "guest" | "ai" | "host"; body: string; lang: "en" | "ur" | "ur-Latn" }[];
  escalated: boolean;
};

// `invalidToken: true` means the token itself is bad (malformed, or no
// conversation matches it) — the caller should stop using it. Its absence
// means the token may still be good; the failure was a transient one (a DB
// or network hiccup), and the caller should keep the token and let the
// guest retry rather than treating it as "not found".
export type ChatLoadError = { error: string; invalidToken?: true };

const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";
const INVALID_LINK = "This chat link isn't valid.";
const NOT_TAKING_MESSAGES = "This place isn't taking messages right now.";

function toView(messages: ChatMessage[], escalated: boolean): ChatView {
  return {
    escalated,
    messages: messages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, lang: langAttribute(detectLanguage(m.body)) })),
  };
}

export async function startChatAction(propertyId: string): Promise<{ token: string } | { error: string }> {
  if (typeof propertyId !== "string" || !propertyId) return { error: NOT_TAKING_MESSAGES };
  try {
    const result = await startConversation(createServiceClient(), propertyId);
    return "error" in result ? { error: NOT_TAKING_MESSAGES } : { token: result.token };
  } catch {
    console.error("[chat] could not start a conversation");
    return { error: GENERIC_ERROR };
  }
}

export async function loadChatAction(token: string): Promise<ChatView | ChatLoadError> {
  if (typeof token !== "string" || !isToken(token)) return { error: INVALID_LINK, invalidToken: true };
  try {
    const service = createServiceClient();
    const conversation = await getConversation(service, token);
    if (!conversation) return { error: INVALID_LINK, invalidToken: true };
    return toView(await listMessages(service, conversation.id), conversation.escalated);
  } catch {
    console.error("[chat] could not load a conversation");
    return { error: GENERIC_ERROR };
  }
}

export async function sendMessageAction(token: string, text: string): Promise<ChatView | { error: string }> {
  if (typeof token !== "string" || !isToken(token)) return { error: INVALID_LINK };
  if (typeof text !== "string") return { error: "Type a message first." };
  try {
    const result = await runGuestTurn({ service: createServiceClient(), model: modelFromEnv(), token, text, today: localToday() });
    if ("error" in result) return { error: result.error };
  } catch {
    // Logged without the message or the token: both are the guest's.
    console.error("[chat] guest turn failed");
    return { error: GENERIC_ERROR };
  }
  return loadChatAction(token);
}
