"use server";

import { dashboardContext } from "../_lib/context";
import { listHostConversations, type HostConversationSummary } from "@/lib/chat/conversations";

// Reconciliation (INBOX-03): called once a realtime channel reports
// SUBSCRIBED, and again whenever a live event references a conversation
// the client doesn't have yet — never a poll, only these two triggers.
export async function refreshInboxAction(): Promise<HostConversationSummary[]> {
  const { supabase, organization } = await dashboardContext();
  return listHostConversations(supabase, organization.id);
}
