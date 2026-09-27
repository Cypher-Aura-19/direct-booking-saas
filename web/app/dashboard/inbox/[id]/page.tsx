import { notFound } from "next/navigation";
import { dashboardContext } from "../../_lib/context";
import { getHostConversation, listMessages, markConversationRead } from "@/lib/chat/conversations";
import { ConversationDetail } from "./conversation-detail";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, id);
  if (!conversation) notFound();
  const messages = await listMessages(supabase, id);
  await markConversationRead(supabase, id); // opening it is reading it (INBOX-09)
  return <ConversationDetail conversation={conversation} initialMessages={messages} />;
}
