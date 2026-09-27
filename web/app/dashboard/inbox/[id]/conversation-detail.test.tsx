import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConversationDetail } from "./conversation-detail";
import * as actions from "../actions";
import type { HostConversation } from "@/lib/chat/conversations";
import type { ChatMessage } from "@/lib/chat/conversations";

// refreshMessagesAction resolves to the same `messages` fixture as the
// initial props, for the same reconcile-race reason inbox-shell.test.tsx's
// mock does — and mockImplementation, not mockResolvedValue, since vi.mock
// is hoisted above the `const messages` declaration below it.
vi.mock("../actions", () => ({
  setAiEnabledAction: vi.fn().mockResolvedValue(undefined),
  sendHostMessageAction: vi.fn().mockResolvedValue({ error: null, success: true }),
  refreshMessagesAction: vi.fn().mockImplementation(async () => messages),
}));
// removeChannel is the cleanup path ConversationDetail uses (Supabase's
// recommended way to fully release a channel on unmount, per Task 4's fix
// round) — it must exist on the mock or the effect's cleanup throws on
// every test's unmount.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({ on: () => ({ subscribe: (cb: (s: string) => void) => { cb("SUBSCRIBED"); return { unsubscribe: vi.fn() }; } }) }),
    removeChannel: vi.fn(),
  }),
}));

const conversation: HostConversation = {
  id: "c1", propertyId: "p1", propertyName: "River Hut", guestToken: "a".repeat(64),
  aiState: "enquiry", aiEnabled: true, escalated: false, escalationReason: null,
};
const messages: ChatMessage[] = [
  { id: "m1", sender: "guest", body: "Is there parking?", createdAt: "2026-09-27T10:00:00Z" },
  { id: "m2", sender: "ai", body: "Yes, free parking on site.", createdAt: "2026-09-27T10:01:00Z" },
];

describe("ConversationDetail", () => {
  // @req INBOX-08
  test("every message is labelled guest, AI or host", () => {
    render(<ConversationDetail conversation={conversation} initialMessages={messages} />);
    expect(screen.getByText("Is there parking?")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument(); // AI label
  });

  // @req INBOX-06
  test("a host can send a message as themselves", async () => {
    render(<ConversationDetail conversation={conversation} initialMessages={messages} />);
    fireEvent.change(screen.getByRole("textbox", { name: /your message/i }), { target: { value: "I'll check and get back to you." } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(actions.sendHostMessageAction).toHaveBeenCalled());
  });

  // @req INBOX-04
  test("toggling the AI off calls the action and flips the switch's label", async () => {
    render(<ConversationDetail conversation={conversation} initialMessages={messages} />);
    const toggle = screen.getByRole("button", { name: /turn ai off/i });
    fireEvent.click(toggle);
    await waitFor(() => expect(actions.setAiEnabledAction).toHaveBeenCalledWith("c1", false));
  });

  // @req INBOX-13
  test("copying the guest link puts it on the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ConversationDetail conversation={conversation} initialMessages={messages} />);
    fireEvent.click(screen.getByRole("button", { name: /copy guest link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining(conversation.guestToken)));
  });

  // @req INBOX-12
  test("an escalated conversation shows why", () => {
    render(<ConversationDetail conversation={{ ...conversation, escalated: true, escalationReason: "human" }} initialMessages={messages} />);
    expect(screen.getByText(/escalated/i)).toBeInTheDocument();
  });
});
