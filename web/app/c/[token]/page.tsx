import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft } from "@/components/ui/icons";
import { getConversation, isToken } from "@/lib/chat/conversations";
import { createServiceClient } from "@/lib/supabase/service";
import PublicLayout from "../../s/[org]/layout";
import { ChatPanel } from "../../s/[org]/[property]/chat/chat-panel";

// "Save your chat" (AI-03): the guest's token is the whole credential, so the
// page is never indexed, never cached, and sends no referrer onward.
export const metadata: Metadata = { title: "Your chat", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

type ChatSubject = { propertyId: string; propertyName: string; hostName: string; href: string | null };

// The service client, because the property comes from the conversation row
// (never from the URL) and may since have been unpublished. Only the names
// shown on this page are read.
async function load(token: string): Promise<ChatSubject | null> {
  if (!isToken(token)) return null;
  const service = createServiceClient();
  const conversation = await getConversation(service, token);
  if (!conversation) return null;
  const { data } = await service
    .from("properties")
    .select("id, name, slug, published, organizations(name, slug)")
    .eq("id", conversation.propertyId)
    .maybeSingle();
  if (!data) return null;
  const organization = (Array.isArray(data.organizations) ? data.organizations[0] : data.organizations) as { name: string; slug: string } | null;
  if (!organization) return null;
  return {
    propertyId: data.id,
    propertyName: data.name,
    hostName: organization.name,
    href: data.published && data.slug ? `/s/${organization.slug}/${data.slug}` : null,
  };
}

export default async function SavedChatPage({ params }: Props) {
  const { token } = await params;
  const subject = await load(token);

  return (
    <PublicLayout>
      <main id="main" className="public-main">
        {subject ? (
          <div className="public-wrap chat-page">
            {subject.href && (
              <Link href={subject.href} className="property-back"><IconArrowLeft /> {subject.propertyName}</Link>
            )}
            <header className="chat-page-heading">
              <p className="public-eyebrow">Your chat with {subject.hostName}</p>
              <h1 className="public-display">{subject.propertyName}</h1>
            </header>
            <ChatPanel propertyId={subject.propertyId} propertyName={subject.propertyName} hostName={subject.hostName} initialToken={token} />
          </div>
        ) : (
          <div className="public-wrap public-not-found">
            <p className="public-eyebrow">Saved chat</p>
            <h1 className="public-display">Chat not found</h1>
            <p>This chat link isn&apos;t valid. Ask the host to send it again.</p>
          </div>
        )}
      </main>
    </PublicLayout>
  );
}
