"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { IconSparkle } from "@/components/ui/icons";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Sheet, SheetHeader } from "@/components/ui/page-header";
import type { TestTurn } from "@/lib/chat/test-chat";
import { testAiReplyAction } from "./actions";

type Message = TestTurn & { id: string };

const FORM_ID = "ai-settings-form";

export function TestChatPanel({ propertyId }: { propertyId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    const form = document.getElementById(FORM_ID) as HTMLFormElement | null;
    const settingsFormData = form ? new FormData(form) : new FormData();
    const history = messages.map(({ role, text }) => ({ role, text }));

    setMessages((prev) => [...prev, { id: `t${counter.current++}`, role: "guest", text }]);
    setDraft("");
    setPending(true);
    setError(null);
    try {
      const result = await testAiReplyAction(propertyId, settingsFormData, history, text);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessages((prev) => [...prev, { id: `t${counter.current++}`, role: "ai", text: result.reply }]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setMessages([]);
    setError(null);
  }

  return (
    <Sheet as="div">
      <SheetHeader
        title="Test chat"
        description="Try questions as a guest would, using whatever is currently checked above — save first if you want to keep it."
      />
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex min-h-40 flex-col gap-3 rounded-[var(--radius-field)] border border-hairline bg-surface-muted/60 p-4">
          {messages.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <IconSparkle className="size-4 shrink-0" /> Ask something a guest might ask.
            </p>
          ) : (
            messages.map((m) => (
              <p
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-5 ${
                  m.role === "guest" ? "self-end bg-ink text-white" : "self-start border border-hairline bg-surface text-ink"
                }`}
              >
                {m.text}
              </p>
            ))
          )}
          {pending && <p className="self-start text-sm text-muted">Thinking…</p>}
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <form onSubmit={send} className="flex items-center gap-3">
          <label htmlFor="test-chat-input" className="sr-only">Test message</label>
          <input
            id="test-chat-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. What's the wifi password?"
            maxLength={1000}
            className={INPUT_CLASSES}
          />
          <Button type="submit" disabled={pending || !draft.trim()}>Send</Button>
        </form>
        {messages.length > 0 && (
          <button type="button" onClick={reset} className="self-start text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
            Reset test conversation
          </button>
        )}
      </div>
    </Sheet>
  );
}
