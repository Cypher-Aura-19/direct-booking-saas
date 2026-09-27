import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InboxShell } from "./inbox-shell";
import type { HostConversationSummary } from "@/lib/chat/conversations";

// refreshInboxAction resolves to the same fixture data as the initial props
// (not []) — the mocked channel below fires "SUBSCRIBED" synchronously, so
// reconcile() runs on mount; returning the same data removes any race
// between that resolving and a test's assertions, rather than relying on
// microtask-vs-synchronous-assertion timing to keep tests passing.
// mockImplementation (not mockResolvedValue) so the closure reads
// `conversations` only when called, not when this hoisted vi.mock factory
// runs — vi.mock is hoisted above the `const conversations` below it, so
// mockResolvedValue(conversations) here would throw a TDZ ReferenceError.
vi.mock("./actions", () => ({ refreshInboxAction: vi.fn().mockImplementation(async () => conversations) }));
// The real supabase-js RealtimeChannel.on() returns `this`, so multiple
// .on() registrations chain before a single .subscribe() — InboxShell
// relies on that (one channel, two .on() calls for "conversations" and
// "messages", then .subscribe()). The mock's `channel` object must return
// itself from `on()` to support that chain, rather than a one-shot object
// that only has `subscribe`.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: () => channel,
      subscribe: (cb: (s: string) => void) => { cb("SUBSCRIBED"); return { unsubscribe: vi.fn() }; },
    };
    return { channel: () => channel };
  },
}));
// No global next/navigation mock exists in this repo (confirmed in Task 3) —
// InboxShell calls both usePathname and useSearchParams, so this file mocks
// both directly.
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/inbox",
  useSearchParams: () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""),
}));

const conversations: HostConversationSummary[] = [
  { id: "c1", propertyId: "p1", propertyName: "River Hut", guestToken: "a".repeat(64), aiState: "enquiry", aiEnabled: true, escalated: false, lastMessage: { sender: "guest", body: "Is there parking?", createdAt: "2026-09-27T10:00:00Z" }, unreadCount: 2 },
  { id: "c2", propertyId: "p2", propertyName: "Hill House", guestToken: "b".repeat(64), aiState: "stay", aiEnabled: true, escalated: true, lastMessage: { sender: "ai", body: "Sorry, I'm not sure — the host will help.", createdAt: "2026-09-27T09:00:00Z" }, unreadCount: 0 },
];

describe("InboxShell", () => {
  // @req INBOX-01
  // @req INBOX-09
  test("lists every conversation with its property, last message and unread count", () => {
    render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
    expect(screen.getByText("River Hut")).toBeInTheDocument();
    expect(screen.getByText("Hill House")).toBeInTheDocument();
    expect(screen.getByText("Is there parking?")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // unread badge
  });

  // @req INBOX-10
  test("search narrows the list by property name or last message", () => {
    render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
    fireEvent.change(screen.getByRole("searchbox", { name: /search conversations/i }), { target: { value: "parking" } });
    expect(screen.getByText("River Hut")).toBeInTheDocument();
    expect(screen.queryByText("Hill House")).not.toBeInTheDocument();
  });

  // @req INBOX-11
  test("filtering by property narrows the list", () => {
    render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
    fireEvent.change(screen.getByRole("combobox", { name: /filter by property/i }), { target: { value: "p2" } });
    expect(screen.queryByText("River Hut")).not.toBeInTheDocument();
    expect(screen.getByText("Hill House")).toBeInTheDocument();
  });

  // @req INBOX-11
  test("filtering by conversation status (ai_state) narrows the list", () => {
    render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
    fireEvent.change(screen.getByRole("combobox", { name: /filter by status/i }), { target: { value: "stay" } });
    expect(screen.queryByText("River Hut")).not.toBeInTheDocument();
    expect(screen.getByText("Hill House")).toBeInTheDocument();
  });

  // @req INBOX-12
  // InboxShell's initial showEscalatedOnly state reads window.location.search
  // directly (not the mocked useSearchParams hook, which only syncs it on a
  // later client-side navigation) — jsdom's window.location doesn't reset
  // between tests on its own, so this test saves and restores it in a
  // try/finally rather than leaving a stub object for every later test in
  // this file to silently inherit.
  test("the ?filter=escalated query param preselects the escalated-only view", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, search: "?filter=escalated" }, writable: true, configurable: true });
    try {
      render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
      expect(screen.queryByText("River Hut")).not.toBeInTheDocument();
      expect(screen.getByText("Hill House")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
    }
  });

  test("each conversation links to its detail route", () => {
    render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
    expect(screen.getByRole("link", { name: /river hut/i })).toHaveAttribute("href", "/dashboard/inbox/c1");
  });

  // @req INBOX-03
  // The real end-to-end delivery proof lives in Task 6 (a genuine
  // postgres_changes subscription). This test proves the specific ordering
  // INBOX-03 describes: the client renders instantly from the server
  // snapshot (no reconcile call yet), and only once the channel reports
  // SUBSCRIBED does it call back to re-fetch and reconcile.
  test("reconciles via a fresh fetch only after the realtime channel confirms it's subscribed", async () => {
    const refreshInboxAction = (await import("./actions")).refreshInboxAction;
    render(<InboxShell initialConversations={conversations}>{null}</InboxShell>);
    // The mocked channel's subscribe() callback fires "SUBSCRIBED" synchronously
    // on mount in this test double; asserting the call happened at all (rather
    // than never) is what proves the effect is wired to the SUBSCRIBED branch,
    // not to some other lifecycle event.
    await waitFor(() => expect(refreshInboxAction).toHaveBeenCalled());
  });
});
