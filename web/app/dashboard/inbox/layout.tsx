import { dashboardContext } from "../_lib/context";
import { listHostConversations } from "@/lib/chat/conversations";
import { PageHeader } from "@/components/ui/page-header";
import { InboxShell } from "./inbox-shell";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { supabase, organization } = await dashboardContext();
  const conversations = await listHostConversations(supabase, organization.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Inbox" description="Every conversation, across every property." />
      <InboxShell initialConversations={conversations}>{children}</InboxShell>
    </div>
  );
}
