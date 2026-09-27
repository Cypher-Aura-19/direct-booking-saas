"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/stamp";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage, HostConversation, Sender } from "@/lib/chat/conversations";
import { refreshMessagesAction, sendHostMessageAction, setAiEnabledAction, type FormState } from "../actions";

const SENDER_LABEL: Record<Sender, string> = { guest: "Guest", ai: "Assistant", host: "Host" };

export function ConversationDetail({ conversation, initialMessages }: { conversation: HostConversation; initialMessages: ChatMessage[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [aiEnabled, setAiEnabledState] = useState(conversation.aiEnabled);
  const [togglePending, setTogglePending] = useState(false);
  const [copied, setCopied] = useState(false);
  const knownIds = useRef(new Set(initialMessages.map((m) => m.id)));
  const logRef = useRef<HTMLDivElement>(null);

  const reconcile = useCallback(async () => {
    const fresh = await refreshMessagesAction(conversation.id);
    knownIds.current = new Set(fresh.map((m) => m.id));
    setMessages(fresh);
  }, [conversation.id]);

  // Subscribe first, then reconcile once live (INBOX-02, INBOX-03), same
  // pattern InboxShell uses — scoped to just this conversation's messages.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        () => void reconcile(),
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") void reconcile();
      });
    return () => {
      // removeChannel (not just unsubscribe) fully releases the channel
      // from the client's internal registry once unsubscribe completes, so
      // a later supabase.channel(`conversation-${id}`) call (StrictMode's
      // dev double-effect, or a host switching between conversations
      // quickly) gets a fresh channel rather than one still mid-leave that
      // may never re-fire SUBSCRIBED (see inbox-shell.tsx's identical fix).
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, reconcile]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  async function toggleAi() {
    setTogglePending(true);
    const next = !aiEnabled;
    try {
      await setAiEnabledAction(conversation.id, next);
      setAiEnabledState(next);
    } finally {
      setTogglePending(false);
    }
  }

  async function copyLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await navigator.clipboard.writeText(`${origin}/c/${conversation.guestToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const [state, formAction, sendPending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const result = await sendHostMessageAction(conversation.id, { error: null, success: false }, formData);
      if (result.success) await reconcile();
      return result;
    },
    { error: null, success: false },
  );

  return (
    <div className="conversation-detail">
      <div className="conversation-detail-header">
        <div>
          <h2>{conversation.propertyName}</h2>
          {conversation.escalated && (
            <p className="conversation-escalated-note">
              <Stamp tone="red" tilt={-2}>Escalated</Stamp>
              {conversation.escalationReason && <span>Reason: {conversation.escalationReason}</span>}
            </p>
          )}
        </div>
        <div className="conversation-detail-actions">
          <Button type="button" variant="secondary" onClick={copyLink}>{copied ? "Copied!" : "Copy guest link"}</Button>
          <Button type="button" variant={aiEnabled ? "secondary" : "primary"} disabled={togglePending} onClick={toggleAi}>
            {aiEnabled ? "Turn AI off" : "Turn AI on"}
          </Button>
        </div>
      </div>

      <div ref={logRef} className="conversation-log" role="log" aria-label="Conversation">
        {messages.map((m) => (
          <div key={m.id} className="conversation-message" data-sender={m.sender}>
            <span className="conversation-sender">{SENDER_LABEL[m.sender]}</span>
            <p className="conversation-bubble">{m.body}</p>
          </div>
        ))}
      </div>

      <form action={formAction} className="conversation-composer">
        <label htmlFor="host-message" className="sr-only">Your message</label>
        <textarea id="host-message" name="body" rows={2} maxLength={2000} placeholder="Type a message..." />
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" disabled={sendPending}>{sendPending ? "Sending…" : "Send"}</Button>
      </form>
    </div>
  );
}
