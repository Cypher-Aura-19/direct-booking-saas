"use server";

import { revalidatePath } from "next/cache";
import { dashboardContext } from "../_lib/context";
import {
  addMessage,
  getHostConversation,
  listHostConversations,
  listMessages,
  markConversationRead,
  parseHostMessage,
  setAiEnabled,
  type ChatMessage,
  type HostConversationSummary,
} from "@/lib/chat/conversations";

// Reconciliation (INBOX-03): called once a realtime channel reports
// SUBSCRIBED, and again whenever a live event references a conversation
// the client doesn't have yet — never a poll, only these two triggers.
export async function refreshInboxAction(): Promise<HostConversationSummary[]> {
  const { supabase, organization } = await dashboardContext();
  return listHostConversations(supabase, organization.id);
}

export type FormState = { error: string | null; success: boolean };

export async function setAiEnabledAction(conversationId: string, enabled: boolean): Promise<void> {
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, conversationId);
  if (!conversation) throw new Error("Conversation not found.");
  await setAiEnabled(supabase, conversationId, enabled);
  revalidatePath(`/dashboard/inbox/${conversationId}`);
}

export async function sendHostMessageAction(conversationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseHostMessage(String(formData.get("body") ?? ""));
  if ("error" in parsed) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, conversationId);
  if (!conversation) return { error: "Conversation not found.", success: false };
  await addMessage(supabase, conversationId, "host", parsed.body);
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { error: null, success: true };
}

// Reconciliation for the message log (INBOX-03), same shape as
// refreshInboxAction above but scoped to one conversation. Also marks the
// conversation read, since opening/refreshing a conversation is exactly
// when a host has seen its messages (INBOX-09).
export async function refreshMessagesAction(conversationId: string): Promise<ChatMessage[]> {
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, conversationId);
  if (!conversation) return [];
  await markConversationRead(supabase, conversationId);
  return listMessages(supabase, conversationId);
}
