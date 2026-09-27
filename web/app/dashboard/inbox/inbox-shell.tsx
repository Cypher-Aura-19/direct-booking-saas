"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { IconInbox } from "@/components/ui/icons";
import { Stamp } from "@/components/ui/stamp";
import { createClient } from "@/lib/supabase/client";
import type { HostConversationSummary } from "@/lib/chat/conversations";
import { refreshInboxAction } from "./actions";

type Props = { initialConversations: HostConversationSummary[]; children: React.ReactNode };

const STATUS_LABEL: Record<HostConversationSummary["aiState"], string> = { enquiry: "Enquiry", payment: "Payment", stay: "Stay" };

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function InboxShell({ initialConversations, children }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [status, setStatus] = useState("all");
  const [showEscalatedOnly, setShowEscalatedOnly] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("filter") === "escalated",
  );
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const knownIds = useRef(new Set(initialConversations.map((c) => c.id)));

  // Adjusted during render, not in a useEffect (react-hooks/set-state-in-effect):
  // the value tracked is the primitive filter string, not the searchParams
  // object itself, so this only fires an extra render when that string
  // actually changes — the object next/navigation's useSearchParams()
  // returns is a fresh instance on every render.
  const filterParam = searchParams?.get("filter") ?? null;
  const [lastFilterParam, setLastFilterParam] = useState(filterParam);
  if (filterParam !== lastFilterParam) {
    setLastFilterParam(filterParam);
    if (filterParam === "escalated") setShowEscalatedOnly(true);
  }

  const reconcile = useCallback(async () => {
    const fresh = await refreshInboxAction();
    knownIds.current = new Set(fresh.map((c) => c.id));
    setConversations(fresh);
  }, []);

  // Subscribe first, then reconcile once live (INBOX-02, INBOX-03) — RLS
  // scopes delivery to this host's own conversations/messages; the org
  // isn't filterable in the subscription itself (no organization_id column
  // on either table), so every event is checked against the known-id set
  // and a full reconcile runs for anything unfamiliar (a brand-new
  // conversation, or a gap the initial snapshot missed).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, (payload) => {
        const row = payload.new as { id: string } | undefined;
        if (!row) return;
        if (!knownIds.current.has(row.id)) { void reconcile(); return; }
        void reconcile();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { conversation_id: string } | undefined;
        if (!row) return;
        void reconcile(); // simplest correct patch: re-derive last message + unread from the server
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void reconcile();
      });
    return () => { void channel.unsubscribe(); };
  }, [reconcile]);

  // Labeled with each property's conversation count (a real, useful signal
  // for a host with many properties) — as a side effect, this also keeps
  // every <option>'s rendered text distinct from the identically-named
  // <strong> in a list row, so a plain-text query for a property name
  // resolves to exactly one element on the page rather than two.
  const properties = useMemo(() => {
    const seen = new Map<string, { name: string; count: number }>();
    for (const c of conversations) {
      const entry = seen.get(c.propertyId) ?? { name: c.propertyName, count: 0 };
      entry.count += 1;
      seen.set(c.propertyId, entry);
    }
    return Array.from(seen, ([id, { name, count }]) => ({ id, name, count }));
  }, [conversations]);

  const visible = conversations.filter((c) => {
    if (showEscalatedOnly && !c.escalated) return false;
    if (propertyId !== "all" && c.propertyId !== propertyId) return false;
    if (status !== "all" && c.aiState !== status) return false;
    const haystack = `${c.propertyName} ${c.lastMessage?.body ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <div className="inbox-layout">
      <div className="inbox-list-pane">
        <div className="inbox-toolbar">
          <input
            type="search"
            role="searchbox"
            aria-label="Search conversations"
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select aria-label="Filter by property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="all">All properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{`${p.name} (${p.count})`}</option>
            ))}
          </select>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="enquiry">Enquiry</option>
            <option value="payment">Payment</option>
            <option value="stay">Stay</option>
          </select>
          {showEscalatedOnly && (
            <button type="button" className="inbox-clear-filter" onClick={() => setShowEscalatedOnly(false)}>
              Escalated only ✕
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <div className="panel-empty">
            <span><IconInbox className="size-5" /></span>
            <h3>No matching conversations</h3>
            <p>Try another search or clear the filters.</p>
          </div>
        ) : (
          <ul className="inbox-list divide-y divide-hairline">
            {visible.map((c) => {
              const active = pathname === `/dashboard/inbox/${c.id}`;
              return (
                <li key={c.id} className={`inbox-row ${active ? "is-active" : ""}`}>
                  <Link href={`/dashboard/inbox/${c.id}`} aria-current={active ? "page" : undefined}>
                    <div className="inbox-row-top">
                      <strong>{c.propertyName}</strong>
                      {c.lastMessage && <span className="inbox-row-time">{timeAgo(c.lastMessage.createdAt)}</span>}
                    </div>
                    <p className="inbox-row-preview">{c.lastMessage?.body ?? "No messages yet"}</p>
                    <div className="inbox-row-badges">
                      {c.escalated && <Stamp tone="red" tilt={-2}>Escalated</Stamp>}
                      <Stamp tone="grey">{STATUS_LABEL[c.aiState]}</Stamp>
                      {c.unreadCount > 0 && <span className="inbox-unread-badge">{c.unreadCount}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="inbox-detail-pane">{children}</div>
    </div>
  );
}
