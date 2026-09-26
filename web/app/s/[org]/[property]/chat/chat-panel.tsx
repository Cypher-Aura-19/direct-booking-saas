"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { IconChat } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { loadChatAction, sendMessageAction, startChatAction, type ChatView } from "./actions";

// The embedded guest chat (AI-01, 03, 04, 05, 18). It talks to the server
// only through ./actions: nothing here may import from lib/chat or the
// service client, which would pull the service-role key toward the browser.

type Props = { propertyId: string; propertyName: string; hostName: string; initialToken?: string };
type Message = ChatView["messages"][number];

const TOKEN = /^[0-9a-f]{64}$/;
const ARABIC_SCRIPT = /[؀-ۿ]/;
const POLL_MS = 20_000;
const MAX_LENGTH = 1000;
const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";
const STARTERS = ["Is it available next weekend?", "What's the price per night?", "Is there parking and hot water?", "How do I get there?"];
const SENDER_LABEL: Record<Message["sender"], string | null> = { guest: null, ai: "Assistant", host: "Host" };

// Storage can be missing or throw (private mode, blocked site data): the chat
// still works for this visit, it just won't be remembered.
const storage = {
  get(key: string) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key: string, value: string) {
    try { localStorage.setItem(key, value); } catch { /* not remembered */ }
  },
  remove(key: string) {
    try { localStorage.removeItem(key); } catch { /* nothing to forget */ }
  },
};

export function ChatPanel({ propertyId, propertyName, hostName, initialToken }: Props) {
  const key = `qayam-chat:${propertyId}`;
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [escalated, setEscalated] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const pendingRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const apply = useCallback((view: ChatView) => {
    setMessages(view.messages);
    setEscalated(view.escalated);
  }, []);

  // Restore: a token from a saved link wins over the one this browser kept.
  useEffect(() => {
    const fromLink = initialToken && TOKEN.test(initialToken) ? initialToken : null;
    const kept = storage.get(key);
    const candidate = fromLink ?? (kept && TOKEN.test(kept) ? kept : null);
    if (!candidate) return;
    if (fromLink) storage.set(key, fromLink);
    let cancelled = false;
    loadChatAction(candidate)
      .then((view) => {
        if (cancelled) return;
        if ("error" in view) {
          storage.remove(key);
          return;
        }
        setToken(candidate);
        apply(view);
      })
      .catch(() => { /* offline: the guest can still start a new chat */ });
    return () => { cancelled = true; };
  }, [key, initialToken, apply]);

  // Host replies arrive by polling until realtime lands (M9).
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible" || pendingRef.current) return;
      loadChatAction(token)
        .then((view) => { if (!("error" in view) && !pendingRef.current) apply(view); })
        .catch(() => { /* try again next tick */ });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [token, apply]);

  // Keep the newest message in view by scrolling the log itself, never the page.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, pending]);

  function resize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.blockSize = "auto";
    el.style.blockSize = `${el.scrollHeight}px`;
  }

  useEffect(resize, [draft]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setDraft("");
    const previous = messages;
    const optimistic: Message = { id: "pending", sender: "guest", body: text, lang: ARABIC_SCRIPT.test(text) ? "ur" : "en" };
    setMessages([...previous, optimistic]);

    const fail = (message: string) => {
      setMessages(previous);
      setDraft(text);
      setError(message);
    };

    try {
      let current = token;
      if (!current) {
        const started = await startChatAction(propertyId);
        if ("error" in started) return fail(started.error);
        current = started.token;
        storage.set(key, current);
        setToken(current);
      }
      const view = await sendMessageAction(current, text);
      if ("error" in view) return fail(view.error);
      apply(view);
    } catch {
      fail(GENERIC_ERROR);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void send(draft);
  }

  const started = messages.length > 0;

  return (
    <section className="chat" aria-label="Ask a question" data-started={started || undefined} data-chat-focused={focused || undefined}>
      {!started && (
        <div className="chat-intro">
          <span className="chat-intro-icon" aria-hidden="true"><IconChat className="size-5" /></span>
          <div className="chat-intro-body">
            <p className="chat-intro-title">Ask {hostName}&apos;s assistant anything about {propertyName}</p>
            <p className="chat-intro-meta">Instant answers in English or Urdu. {hostName} can read this chat and reply here too.</p>
          </div>
        </div>
      )}

      {!started && (
        <div className="chat-starters" role="group" aria-label="Suggested questions">
          {STARTERS.map((q) => (
            <button key={q} type="button" className="chat-starter" disabled={pending} onClick={() => void send(q)}>{q}</button>
          ))}
        </div>
      )}

      {started && (
        <div ref={logRef} className="chat-log" role="log" aria-label="Conversation" tabIndex={0}>
          {messages.map((m) => {
            const label = SENDER_LABEL[m.sender];
            return (
              <div key={m.id} className="chat-message" data-sender={m.sender}>
                {label ? <span className="chat-sender">{label}</span> : <span className="sr-only">You</span>}
                <p className="chat-bubble" lang={m.lang} dir={m.lang === "ur" ? "rtl" : undefined}>{m.body}</p>
              </div>
            );
          })}
          <div aria-live="polite">
            {pending && (
              <div className="chat-message" data-sender="ai">
                <span className="chat-typing">
                  <span className="sr-only">Assistant is typing</span>
                  <span className="chat-typing-dot" aria-hidden="true" />
                  <span className="chat-typing-dot" aria-hidden="true" />
                  <span className="chat-typing-dot" aria-hidden="true" />
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {escalated && <p className="chat-note">{hostName} will reply in this chat soon.</p>}

      {error && <Notice tone="error">{error}</Notice>}

      <form className="chat-composer" onSubmit={onSubmit}>
        <div className="chat-field">
          <label htmlFor={`chat-input-${propertyId}`} className="sr-only">Your message</label>
          <textarea
            id={`chat-input-${propertyId}`}
            ref={inputRef}
            className="chat-input min-h-11"
            rows={1}
            maxLength={MAX_LENGTH}
            placeholder="Type your question…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            enterKeyHint="send"
          />
          <Button type="submit" className="chat-send" disabled={pending || !draft.trim()}>Send</Button>
        </div>
      </form>

      {token && (
        <p className="chat-save">
          <Link href={`/c/${token}`} className="chat-save-link">Save this chat</Link>
          <span>Bookmark this link to come back to your chat.</span>
        </p>
      )}
    </section>
  );
}
