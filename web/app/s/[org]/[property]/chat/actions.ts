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

export async function loadChatAction(token: string): Promise<ChatView | { error: string }> {
  if (typeof token !== "string" || !isToken(token)) return { error: INVALID_LINK };
  try {
    const service = createServiceClient();
    const conversation = await getConversation(service, token);
    if (!conversation) return { error: INVALID_LINK };
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
