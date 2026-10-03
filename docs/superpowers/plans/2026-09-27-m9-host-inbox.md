# M9 Host Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host sees every guest conversation across every property in one live-updating list, opens one to read the full message log (guest/AI/host clearly labelled), can take over by sending a message as themselves and toggling the AI off/on for just that conversation, sees unread counts and can search/filter the list, and can copy the guest's link to resend it. Escalations already surfaced on the dashboard home page become clickable through to the conversation that needs attention.

**Architecture:**
- **Storage.** One new column, `conversations.host_last_read_at timestamptz` (nullable — null means "never opened"). Unread count for a conversation is guest/AI messages newer than that timestamp; there is one reader (the org), not per-user, matching how the rest of the app has no multi-user-per-org concept yet.
- **The list query is one round trip.** `list_host_conversations(org_id)` is a `security invoker` SQL function (same shape as M4's `is_published_property_object`) that joins `conversations` to `properties` and a `LATERAL` "last message" per conversation, plus a per-row unread subquery — PostgREST alone can't express "latest row per group," and N+1 queries don't scale. RLS still applies inside the function because it runs as the caller (the host's own authenticated client), exactly like every other dashboard read in this codebase.
- **Toggling the AI off for one conversation (INBOX-04/05) needs no new agent logic at all.** `runGuestTurn` already reads `conversation.ai_enabled` fresh on every guest turn and stays silent when it's `false` (`web/lib/chat/agent.ts:148-150`, unchanged since M7). Today the only way that flag becomes `false` is `escalate()`, which also sets `escalated=true` — this plan adds a second, independent mutation (`setAiEnabled`) that flips just the one flag, so a host taking over is recorded separately from the AI having given up. Turning it back on needs no new logic either (INBOX-07): `recentHistory()` in `agent.ts` rebuilds the model's context from the `messages` table fresh on every turn, and a host message is just another row in that same table.
- **Realtime, not polling, for the host side.** `conversations`/`messages` are added to the `supabase_realtime` publication. The host's browser subscribes with their own authenticated Supabase client (`web/lib/supabase/client.ts`, already exists, currently unused) — Realtime evaluates the same RLS policies the tables already have (`owns_property`/`owns_conversation`), so this exposes nothing new to anon (still zero grants) and nothing cross-org to another host. The guest-facing public chat keeps polling; it is out of scope here.
- **Subscribe-then-reconcile, exactly as INBOX-03 is worded.** A client component renders instantly from the server-fetched snapshot, opens its realtime channel, and only once the channel reports `SUBSCRIBED` does it call a Server Action to re-fetch and replace state — closing the gap between "the server rendered this" and "the channel went live" without needing to buffer anything. After that, live inserts/updates patch state directly; the same reconcile action is the fallback whenever a live event references a conversation the client doesn't have yet (a brand new conversation, or one the initial snapshot missed).
- **"Booking status" filter (INBOX-11), an explicit decision.** `bookings` (M10) doesn't exist yet and a conversation has no booking of its own to point at. The only per-conversation status that already tracks where a guest is in the journey is `ai_state` (`enquiry` → `payment` → `stay`), so that's what INBOX-11's "booking status" filters on. Documented here, not left implicit, so a future M10 owner decision can revisit it.
- **INBOX-12 is mostly already built.** `web/app/dashboard/page.tsx` already counts escalated conversations and waiting booking requests and shows them on the dashboard home "Needs your attention" panel (`dashboard-home.tsx`, `attention-panel`/`attention-row` — this predates M9 and was missed by earlier audits because it reads the `escalated` boolean, not the `escalation_reason` string). This plan's job is narrower than "build alerts from scratch": link the escalated-chats row through to the inbox, and replace the existing "Unread messages: read tracking is not available yet" footnote with a real count now that `host_last_read_at` exists.
- **Two-pane layout, route-based.** `/dashboard/inbox` (list pane + an empty-state right pane) and `/dashboard/inbox/[id]` (list pane + the open conversation) share `web/app/dashboard/inbox/layout.tsx`, which fetches the list once and keeps it live; `{children}` is the right pane. On narrow screens the right pane becomes the only visible pane when a conversation is open (a back link returns to the list), following the two-column-grid precedent already in `web/app/dashboard/settings/page.tsx` (`.settings-content-grid`) rather than inventing a new layout primitive.
- **No pagination in v1.** `list_host_conversations` returns every conversation for the org in one call. Fine at this project's current scale (a single Pakistani host's properties); worth revisiting past roughly 1,000 conversations for one org, the same threshold `web/app/dashboard/page.tsx` already uses for its own paginated reads.

**Tech Stack:** Next.js Server Actions/Server Components, a `"use client"` component per interactive pane, `@supabase/supabase-js`'s `channel(...).on("postgres_changes", ...)` realtime API via the existing browser client, Vitest against the real local Supabase stack (no mocks). No new npm dependencies.

## Global Constraints

- **RLS is the only authorization boundary for host reads/writes.** Every new lib function takes the caller's own `SupabaseClient` (from `dashboardContext()`), never the service-role client — `owns_property`/`owns_conversation` (already in place since M2) do the scoping. Never add a new RLS policy without a reason; none is needed for this milestone.
- **`host_last_read_at` is written only by the host's own authenticated client**, via `markConversationRead`. Nothing guest-facing ever reads or writes it.
- **Realtime exposure:** enabling the `supabase_realtime` publication on `conversations`/`messages` must not be paired with any RLS or grant change — the existing policies already restrict `anon` to nothing and `authenticated` to owned rows, and that's what must gate Realtime delivery too. After the migration, confirm with `grep -n "grant\|policy" supabase/migrations/*.sql | grep -i "conversations\|messages"` that nothing new appeared beyond the publication statement itself.
- **The AI money-block is untouched.** `setAiEnabled` only ever sets the boolean the host controls; it must never touch `ai_state`, and nothing in this plan writes to `ai_state`. The DB trigger from M2 (`forbid_ai_message_during_payment`) remains the real backstop.
- **Host message length:** cap at 2,000 characters (matching `tools.ts`'s `MAX_REPLY_LENGTH` for AI replies — the same practical "one chat message" ceiling for any non-guest sender), safely under the DB's `messages_body_length` constraint (1–4,000).
- **Tests:** `web/lib/**` tests start with `// @vitest-environment node`, run against the real local Supabase stack (no mocks), and every requirement-proving test carries `// @req <ID>` (INBOX-01 through INBOX-13).
- **Machine: low memory.** Run `npx vitest run --maxWorkers=1 --testTimeout=120000 <paths>` from `web/`. Apply the new migration locally with `npx supabase db reset`, never `db push`, inside a task.
- **Before any push:** lint, full web vitest, `npm run test:scripts`, `npm run audit -- --milestone M9`, the tracker diff, `npm run build`, the token grep, and `grep -n "ai_settings\|knowledge_base" supabase/migrations/*.sql` to confirm this milestone didn't touch either grant.
- **Commit after each task.** Messages end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Don't stage an unrelated `docs/TRACKER.md`, except in the final task.

---

## File Structure

```
supabase/migrations/20260927030000_m9_host_inbox.sql   NEW — host_last_read_at, realtime publication, list_host_conversations()
web/lib/chat/conversations.ts (+test)                   MODIFY — HostConversationSummary/HostConversation types, listHostConversations, getHostConversation, setAiEnabled, markConversationRead, parseHostMessage
web/lib/dashboard/analytics.ts                           unchanged (read only)
web/app/dashboard/
├─ dashboard-nav.tsx                                     MODIFY — un-stub Inbox, add /inbox breadcrumb branch
├─ page.tsx (+test via dashboard-home.test)               MODIFY — real unread count, escalated-chats link
├─ dashboard-home.tsx (+ page.test.tsx fix)               MODIFY — unread count prop + link, drop the disclaimer footnote
├─ inbox/
│  ├─ layout.tsx                                         NEW — fetches the list once, renders InboxShell
│  ├─ inbox-shell.tsx (+test)                             NEW — "use client": search/filter, list pane, realtime subscribe+reconcile
│  ├─ actions.ts                                          NEW — "use server": refreshInboxAction, setAiEnabledAction, sendHostMessageAction, refreshMessagesAction
│  ├─ page.tsx                                            NEW — empty-state right pane
│  └─ [id]/
│     ├─ page.tsx                                         NEW — fetches one conversation + its messages, marks read
│     └─ conversation-detail.tsx (+test)                  NEW — "use client": message log, composer, AI toggle, copy-link
web/app/dashboard/workspace.css                          MODIFY — inbox-* classes alongside the existing property-*/settings-content-grid ones
```

---

### Task 1: Migration and `conversations.ts` host-side library functions

**Files:**
- Create: `supabase/migrations/20260927030000_m9_host_inbox.sql`
- Modify: `web/lib/chat/conversations.ts`
- Test: `web/lib/chat/conversations.test.ts`

**Interfaces:**
- Produces: `HostConversationSummary = { id, propertyId, propertyName, guestToken, aiState, aiEnabled, escalated, lastMessage: {sender, body, createdAt} | null, unreadCount: number }`; `HostConversation = { id, propertyId, propertyName, guestToken, aiState, aiEnabled, escalated, escalationReason: string | null }`; `listHostConversations(supabase, organizationId): Promise<HostConversationSummary[]>`; `getHostConversation(supabase, conversationId): Promise<HostConversation | null>`; `setAiEnabled(supabase, conversationId, enabled): Promise<void>`; `markConversationRead(supabase, conversationId): Promise<void>`; `parseHostMessage(text): {body: string} | {error: string}`; `MAX_HOST_MESSAGE = 2000`.

- [ ] **Step 1: Write the migration**

```sql
-- ---------------------------------------------------------------------------
-- M9 host inbox: read-tracking, realtime, and the one-round-trip list query.
-- No RLS or grant changes — the existing owns_property/owns_conversation
-- policies (M2) are exactly what must also gate Realtime delivery below.
-- ---------------------------------------------------------------------------

alter table public.conversations add column host_last_read_at timestamptz;

-- Realtime honors each table's existing RLS for the connecting role, so
-- adding these two tables to the publication exposes nothing new: anon still
-- has zero grants on either (M7), and an authenticated host still only ever
-- sees rows owns_property/owns_conversation already let them see.
alter publication supabase_realtime add table public.conversations, public.messages;

-- One round trip for the inbox list: PostgREST alone can't express "the
-- latest message per conversation" (a LATERAL join), and N+1 queries don't
-- scale. security invoker (like is_published_property_object, M4) means
-- this runs as the caller — RLS still applies to every table it touches.
create function public.list_host_conversations(org_id uuid)
returns table (
  id uuid,
  property_id uuid,
  property_name text,
  guest_token text,
  ai_state text,
  ai_enabled boolean,
  escalated boolean,
  last_sender text,
  last_body text,
  last_created_at timestamptz,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.property_id, p.name as property_name, c.guest_token, c.ai_state, c.ai_enabled, c.escalated,
    m.sender as last_sender, m.body as last_body, m.created_at as last_created_at,
    (
      select count(*) from public.messages um
      where um.conversation_id = c.id
        and um.sender <> 'host'
        and (c.host_last_read_at is null or um.created_at > c.host_last_read_at)
    ) as unread_count
  from public.conversations c
  join public.properties p on p.id = c.property_id
  left join lateral (
    select sender, body, created_at from public.messages mm
    where mm.conversation_id = c.id
    order by created_at desc, id desc
    limit 1
  ) m on true
  where p.organization_id = org_id
  order by coalesce(m.created_at, c.created_at) desc;
$$;

-- Supabase grants EXECUTE to anon and authenticated by name at creation
-- time regardless of the `revoke ... from public` below (the same gotcha
-- 20260925010000 documents) — anon's own grant is revoked explicitly.
revoke execute on function public.list_host_conversations(uuid) from public, anon;
grant execute on function public.list_host_conversations(uuid) to authenticated;
```

- [ ] **Step 2: Apply it locally**

Run: `npx supabase db reset` (from repo root). Confirm no errors.

- [ ] **Step 3: Write the failing tests** (append to `web/lib/chat/conversations.test.ts`; read the file first for its existing fixtures/helpers — `createTestHostWithOrg`, `createProperty`, `setPropertyPublished`, `startConversation`, `supabaseAdmin` are all already used elsewhere in this repo's chat tests)

```typescript
// Appended to web/lib/chat/conversations.test.ts
import {
  listHostConversations,
  getHostConversation,
  setAiEnabled,
  markConversationRead,
  parseHostMessage,
  MAX_HOST_MESSAGE,
} from "./conversations";
import { createProperty, setPropertyPublished } from "../properties/basics";
import { createTestHostWithOrg, supabaseAdmin } from "../../tests/helpers";

async function seedHostConversation() {
  const host = await createTestHostWithOrg();
  const { propertyId, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Inbox Test Cabin", property_type: "cabin", address: "Somewhere", base_rate_cents: 500_000, max_guests: 2 },
  });
  if (error) throw new Error(error);
  await setPropertyPublished(host.supabase, propertyId!, true);
  const service = supabaseAdmin();
  const started = await startConversation(service, propertyId!);
  if (!("token" in started)) throw new Error("could not start conversation");
  const conversation = (await getConversation(service, started.token))!;
  return { host, service, propertyId: propertyId!, conversation };
}

// @req INBOX-01
test("listHostConversations returns every conversation across every property in the org, newest activity first", async () => {
  const { host, service, conversation } = await seedHostConversation();
  await addMessage(service, conversation.id, "guest", "Is there parking?");
  const rows = await listHostConversations(host.supabase, host.organizationId);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: conversation.id,
    propertyId: conversation.propertyId,
    propertyName: "Inbox Test Cabin",
    aiState: "enquiry",
    aiEnabled: true,
    escalated: false,
    lastMessage: { sender: "guest", body: "Is there parking?" },
  });
  await host.cleanup();
});

// @req INBOX-09
test("unreadCount counts only guest/AI messages after the host's last read, never the host's own", async () => {
  const { host, service, conversation } = await seedHostConversation();
  await addMessage(service, conversation.id, "guest", "Hello?");
  await addMessage(service, conversation.id, "ai", "Hi! How can I help?");
  let rows = await listHostConversations(host.supabase, host.organizationId);
  expect(rows[0].unreadCount).toBe(2);

  await markConversationRead(host.supabase, conversation.id);
  await addMessage(service, conversation.id, "host", "I'll take it from here.");
  rows = await listHostConversations(host.supabase, host.organizationId);
  expect(rows[0].unreadCount).toBe(0); // the host's own message never counts

  await addMessage(service, conversation.id, "guest", "Are you there?");
  rows = await listHostConversations(host.supabase, host.organizationId);
  expect(rows[0].unreadCount).toBe(1);
  await host.cleanup();
});

test("getHostConversation returns the full conversation including the escalation reason", async () => {
  const { host, service, conversation } = await seedHostConversation();
  await escalate(service, conversation.id, "human");
  const found = await getHostConversation(host.supabase, conversation.id);
  expect(found).toMatchObject({
    id: conversation.id,
    propertyName: "Inbox Test Cabin",
    escalated: true,
    escalationReason: "human",
    aiEnabled: false,
  });
  await host.cleanup();
});

test("getHostConversation returns null for a conversation the host doesn't own", async () => {
  const { host: hostA } = await seedHostConversation();
  const { host: hostB, conversation: conversationB } = await seedHostConversation();
  expect(await getHostConversation(hostA.supabase, conversationB.id)).toBeNull();
  await hostA.cleanup();
  await hostB.cleanup();
});

// @req INBOX-04
// @req INBOX-05
test("setAiEnabled turns the AI off without escalating, and the guest turn goes silent", async () => {
  const { host, service, conversation } = await seedHostConversation();
  await setAiEnabled(host.supabase, conversation.id, false);
  const row = await getHostConversation(host.supabase, conversation.id);
  expect(row).toMatchObject({ aiEnabled: false, escalated: false });

  const result = await runGuestTurn({
    service,
    model: new ScriptedModel([]),
    token: (await service.from("conversations").select("guest_token").eq("id", conversation.id).single()).data!.guest_token,
    text: "Still there?",
    today: "2026-10-01",
  });
  if (!("messages" in result)) throw new Error("expected messages");
  expect(result.messages).toHaveLength(1); // the AI never replied
  await host.cleanup();
});

// @req INBOX-06
// @req INBOX-07
test("a host message is stored and is in context the moment the AI is re-enabled", async () => {
  const { host, service, conversation } = await seedHostConversation();
  await setAiEnabled(host.supabase, conversation.id, false);
  const parsed = parseHostMessage("The wifi is 'CabinGuest', password on the fridge.");
  if ("error" in parsed) throw new Error("expected ok");
  await addMessage(host.supabase, conversation.id, "host", parsed.body);
  await setAiEnabled(host.supabase, conversation.id, true);

  const guestToken = (await service.from("conversations").select("guest_token").eq("id", conversation.id).single()).data!.guest_token;
  const model = new ScriptedModel([{ toolCall: { name: "respond", args: { reply: "ok", escalate: false } } }]);
  await runGuestTurn({ service, model, token: guestToken, text: "thanks!", today: "2026-10-01" });
  expect(model.calls[0].history).toContainEqual({ role: "model", text: "Host: The wifi is 'CabinGuest', password on the fridge." });
  await host.cleanup();
});

test("parseHostMessage rejects blank and overlong bodies", () => {
  expect(parseHostMessage("   ")).toMatchObject({ error: expect.any(String) });
  expect(parseHostMessage("x".repeat(MAX_HOST_MESSAGE + 1))).toMatchObject({ error: expect.any(String) });
  const ok = parseHostMessage("  Sure, check-in is at 3pm.  ");
  if ("error" in ok) throw new Error("expected ok");
  expect(ok.body).toBe("Sure, check-in is at 3pm.");
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 lib/chat/conversations.test.ts`
Expected: FAIL — none of the new exports exist yet.

- [ ] **Step 5: Implement the additions in `web/lib/chat/conversations.ts`** (append; do not change any existing export)

```typescript
export type HostConversationSummary = {
  id: string;
  propertyId: string;
  propertyName: string;
  guestToken: string;
  aiState: "enquiry" | "payment" | "stay";
  aiEnabled: boolean;
  escalated: boolean;
  lastMessage: { sender: Sender; body: string; createdAt: string } | null;
  unreadCount: number;
};

export type HostConversation = {
  id: string;
  propertyId: string;
  propertyName: string;
  guestToken: string;
  aiState: "enquiry" | "payment" | "stay";
  aiEnabled: boolean;
  escalated: boolean;
  escalationReason: string | null;
};

export const MAX_HOST_MESSAGE = 2000;

export function parseHostMessage(text: string): { body: string } | { error: string } {
  const body = text.trim();
  if (!body) return { error: "Type a message first." };
  if (body.length > MAX_HOST_MESSAGE) return { error: `Messages can be up to ${MAX_HOST_MESSAGE} characters.` };
  return { body };
}

// All conversations across every property in the org (INBOX-01), newest
// activity first, with the unread count and last message pre-computed —
// see the migration's list_host_conversations() for why this is one RPC
// call rather than N+1 queries.
export async function listHostConversations(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<HostConversationSummary[]> {
  const { data, error } = await supabase.rpc("list_host_conversations", { org_id: organizationId });
  if (error) throw error;
  return (data ?? []).map((row): HostConversationSummary => ({
    id: row.id,
    propertyId: row.property_id,
    propertyName: row.property_name,
    guestToken: row.guest_token,
    aiState: row.ai_state,
    aiEnabled: row.ai_enabled,
    escalated: row.escalated,
    lastMessage: row.last_sender
      ? { sender: row.last_sender as Sender, body: row.last_body as string, createdAt: row.last_created_at as string }
      : null,
    unreadCount: Number(row.unread_count),
  }));
}

// The one conversation a host opened (INBOX-08's detail view). Unlike
// getConversation (token-keyed, guest-facing), this is id-keyed and scoped
// entirely by the caller's own RLS — a foreign conversation id resolves to
// null, never a cross-org read.
export async function getHostConversation(supabase: SupabaseClient, conversationId: string): Promise<HostConversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, property_id, guest_token, ai_state, ai_enabled, escalated, escalation_reason, properties(name)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;
  const property = data.properties as unknown as { name: string } | { name: string }[];
  const propertyName = Array.isArray(property) ? property[0]?.name ?? "" : property?.name ?? "";
  return {
    id: data.id,
    propertyId: data.property_id,
    propertyName,
    guestToken: data.guest_token,
    aiState: data.ai_state,
    aiEnabled: data.ai_enabled,
    escalated: data.escalated,
    escalationReason: data.escalation_reason,
  };
}

// Independent of escalate(): a host taking over is a deliberate choice, not
// the AI giving up, so this never touches `escalated`/`escalation_reason`.
// Turning the AI back on needs nothing else — runGuestTurn already reads
// ai_enabled fresh on every turn (agent.ts) and recentHistory() rebuilds the
// model's context from `messages` fresh every time, so a host message sent
// while the AI is off is already in context the instant it's re-enabled.
export async function setAiEnabled(supabase: SupabaseClient, conversationId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("conversations").update({ ai_enabled: enabled }).eq("id", conversationId);
  if (error) throw error;
}

export async function markConversationRead(supabase: SupabaseClient, conversationId: string): Promise<void> {
  const { error } = await supabase.from("conversations").update({ host_last_read_at: new Date().toISOString() }).eq("id", conversationId);
  if (error) throw error;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 lib/chat/conversations.test.ts`
Expected: PASS, all tests green. (This file's existing tests must also still pass unmodified — you only appended.)

- [ ] **Step 7: Confirm the constraint sweep**

Run: `grep -n "grant\|policy" supabase/migrations/*.sql | grep -i "conversations\|messages"` and confirm the only new line is the `alter publication` statement — no new grant or policy.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260927030000_m9_host_inbox.sql web/lib/chat/conversations.ts web/lib/chat/conversations.test.ts
git commit -m "feat: host-side inbox library — read-tracking, list query, AI toggle, host send"
```

---

### Task 2: Dashboard home — real unread count, escalated-chats link

**Files:**
- Modify: `web/app/dashboard/page.tsx`, `web/app/dashboard/dashboard-home.tsx`, `web/app/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: nothing new from Task 1 directly (unread count here is a fresh aggregate query, not `listHostConversations`, since the home page needs one total number across the org, not a per-conversation breakdown).
- Produces: `DashboardHome` gains an `unreadCount` prop (replacing the "read tracking is not available yet" disclaimer) and the "Escalated chats" attention-row becomes a link to `/dashboard/inbox?filter=escalated`.

- [ ] **Step 1: Write the failing test changes** (in `web/app/dashboard/page.test.tsx` — this file's existing two tests must be updated, not left to fail; read it first, it's short)

```tsx
// Replace the full contents of web/app/dashboard/page.test.tsx with:
import { test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardHome } from './dashboard-home';
// @req AUTH-13
test('empty overview shows honest analytics and attention state',()=>{
 render(<DashboardHome today="2026-09-25" />);
 expect(screen.getByText(/nothing needs you right now/i)).toBeInTheDocument();
 expect(screen.getByText(/no bookings in this period/i)).toBeInTheDocument();
});
// @req INBOX-09
test('an honest unread count replaces the old "not available yet" disclaimer', () => {
  render(<DashboardHome today="2026-09-25" unreadCount={3} />);
  expect(screen.queryByText(/read tracking is not available/i)).not.toBeInTheDocument();
  expect(screen.getByText('Unread messages')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
});
// @req INBOX-12
test('the escalated-chats row links through to the inbox, filtered', () => {
  render(<DashboardHome today="2026-09-25" escalatedCount={2} />);
  expect(screen.getByRole('link', { name: /escalated chats/i })).toHaveAttribute('href', '/dashboard/inbox?filter=escalated');
});
// @req AUTH-13
// @req INBOX-12
test('overview filters analytics by period and property',()=>{
 render(<DashboardHome today="2026-09-25" properties={[{id:'p1',name:'River Hut',published:true},{id:'p2',name:'Hill House',published:true}]} bookings={[{id:'b1',property_id:'p1',start_date:'2026-10-01',end_date:'2026-10-03',created_at:'2026-09-10T10:00:00Z',status:'requested',total_price_cents:2000000}]} escalatedCount={2} />);
 expect(screen.getByText('1 this period')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Last 7 days'}));
 expect(screen.getByText('0 this period')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Last 30 days'}));
 fireEvent.change(screen.getByRole('combobox',{name:'Filter analytics by property'}),{target:{value:'p2'}});
 expect(screen.getByText('0 this period')).toBeInTheDocument();
 expect(screen.getByText('Waiting booking requests')).toBeInTheDocument();
 expect(screen.getByText('Escalated chats')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/page.test.tsx"`
Expected: FAIL — `unreadCount` prop doesn't exist, the escalated row isn't a link yet.

- [ ] **Step 3: Modify `web/app/dashboard/dashboard-home.tsx`**

Change the component's prop signature (line 15-17) to add `unreadCount`:

```tsx
export function DashboardHome({ bookings = [], properties = [], today = localToday(), organizationName = 'your workspace', escalatedCount = 0, unreadCount = 0 }: {
  bookings?: Booking[]; properties?: DashboardProperty[]; today?: string; organizationName?: string; escalatedCount?: number; unreadCount?: number;
}) {
```

Replace the whole `attention-panel` section (currently ending with `<p className="panel-footnote">Unread messages: read tracking is not available yet.</p></section>`) with:

```tsx
      <section className="dash-panel attention-panel"><div className="panel-heading"><div><h2>Needs your attention</h2><p>A little focus for the day ahead.</p></div></div><div className="attention-row"><span className="attention-icon"><IconCalendar /></span><div><strong>Waiting booking requests</strong><small>Across the selected properties</small></div><b>{pending}</b></div><Link href="/dashboard/inbox?filter=escalated" className="attention-row attention-row-link"><span className="attention-icon"><IconSparkle /></span><div><strong>Escalated chats</strong><small>Across your whole workspace</small></div><b>{escalatedCount}</b></Link><div className="attention-row"><span className="attention-icon"><IconInbox /></span><div><strong>Unread messages</strong><small>Across your whole workspace</small></div><b>{unreadCount}</b></div><div className="attention-row"><span className="attention-icon"><IconBuilding /></span><div><strong>Today&apos;s arrivals and departures</strong><small>{shortDate(today)}</small></div><b>{arrivals}</b></div>{pending+escalatedCount+arrivals+unreadCount===0&&<div className="all-clear"><IconCheck className="size-4" />Nothing needs you right now.</div>}</section>
```

(`IconInbox` is already imported at the top of this file per the existing import line — confirm, it is.)

- [ ] **Step 4: Modify `web/app/dashboard/page.tsx`**

`conversations` has no `updated_at` column, so "unread" can't be expressed as a single PostgREST filter the way `escalatedCount` is — it needs a per-conversation comparison against that conversation's own message timestamps, which is exactly what Task 1's `listHostConversations` already computes. Add this call alongside the existing `escalatedCount` query (inside the same `if (properties.length)` block, after the `escalatedCount` assignment):

```tsx
    const conversations = await listHostConversations(supabase, organization.id);
    const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
```

Add the import at the top: `import { listHostConversations } from '@/lib/chat/conversations';`

Pass it through: change the final `return` line to:

```tsx
  return <DashboardHome bookings={bookings} properties={properties} today={today} organizationName={organization.name} escalatedCount={escalatedCount} unreadCount={unreadCount} />;
```

And declare `let unreadCount = 0;` alongside the existing `let escalatedCount = 0;` near the top of the function, so it's in scope outside the `if` block.

- [ ] **Step 5: Add the two CSS rules `workspace.css` needs** (the existing `.attention-row` styling already covers everything except making one row a real link without breaking its layout)

Append to `web/app/dashboard/workspace.css`:

```css
.attention-row-link { text-decoration: none; color: inherit; cursor: pointer; transition: background-color 160ms ease; }
.attention-row-link:hover { background: var(--surface-muted); }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/page.test.tsx"`
Expected: PASS, all 4 tests green.

- [ ] **Step 7: Commit**

```bash
git add web/app/dashboard/page.tsx web/app/dashboard/dashboard-home.tsx web/app/dashboard/page.test.tsx web/app/dashboard/workspace.css
git commit -m "feat: real unread count on dashboard home, link escalated chats to the inbox"
```

---

### Task 3: Nav — un-stub Inbox

**Files:**
- Modify: `web/app/dashboard/dashboard-nav.tsx`
- Test: `web/app/dashboard/dashboard-nav.test.tsx` (create if it doesn't exist — check first; if a `layout.test.tsx` already exercises the nav, extend that instead of creating a duplicate)

**Interfaces:** none — this task only removes a stub, it produces nothing new.

- [ ] **Step 1: Check for an existing nav test.** Run `grep -rn "upcoming\|Soon" web/app/dashboard/*.test.tsx web/app/dashboard/layout.test.tsx`. If a test already asserts Inbox shows a "Soon" pill, that assertion must be updated in this task (not left red for a later task to trip over). Neither `dashboard-nav.tsx` nor `web/components/ui/sub-nav.tsx` (the other component in this codebase that calls `usePathname`) has an existing test file, and there is no global `next/navigation` mock in `vitest.setup.ts` — confirmed by reading it. This task's test file is the first in the repo to render a component that calls `usePathname`/`useSearchParams`, so it must mock `next/navigation` itself rather than assume a default.

- [ ] **Step 2: Write the failing test**

```tsx
// web/app/dashboard/dashboard-nav.test.tsx
import { test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNav, WorkspaceHeader } from "./dashboard-nav";

let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

test("the Inbox nav item is a real link, not a disabled 'Soon' placeholder", () => {
  render(<DashboardNav />);
  const link = screen.getByRole("link", { name: /inbox/i });
  expect(link).toHaveAttribute("href", "/dashboard/inbox");
  expect(screen.queryByText(/soon/i)).not.toBeInTheDocument();
});

test("the workspace breadcrumb names the Inbox section on /dashboard/inbox routes", () => {
  mockPathname = "/dashboard/inbox/c1";
  render(<WorkspaceHeader organizationName="Test Org" />);
  expect(screen.getByText("Inbox")).toBeInTheDocument();
  mockPathname = "/dashboard"; // reset so later tests in this file aren't affected
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/dashboard-nav.test.tsx"`
Expected: FAIL — the link doesn't exist yet (it's a disabled div).

- [ ] **Step 4: Modify `web/app/dashboard/dashboard-nav.tsx`**

Remove `, upcoming: true` from the Inbox entry (line 11):

```tsx
  { href: '/dashboard/inbox', label: 'Inbox', Icon: IconInbox },
```

Add an Inbox branch to `WorkspaceHeader`'s `section` computation (line 40):

```tsx
  const section = pathname?.includes('/inbox') ? 'Inbox' : pathname?.includes('/settings') ? 'Settings' : pathname?.includes('/properties') ? 'Properties' : 'Overview';
```

Add Inbox to the mobile tab bar (line 34's inline array — insert after Home, before Properties, matching the sidebar's own order):

```tsx
    <nav data-testid="dashboard-tabbar" aria-label="Main" className="workspace-mobile-nav md:hidden">{[{ href:'/dashboard',label:'Home',Icon:IconHome },{href:'/dashboard/inbox',label:'Inbox',Icon:IconInbox},{href:'/dashboard/properties',label:'Properties',Icon:IconBuilding},{href:'/dashboard/calendar',label:'Calendar',Icon:IconCalendar},{href:'/dashboard/settings',label:'More',Icon:IconMore}].map(({href,label,Icon})=><Link href={href} key={href} aria-current={active(href)?'page':undefined}><Icon /><span>{label}</span></Link>)}</nav>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/dashboard-nav.test.tsx"` and, if Step 1 found other affected test files, run those too.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/app/dashboard/dashboard-nav.tsx web/app/dashboard/dashboard-nav.test.tsx
git commit -m "feat: un-stub the Inbox nav item now that the page exists"
```

(If another test file was touched per Step 1, add it to this commit too.)

---

### Task 4: Inbox layout and list pane

**Files:**
- Create: `web/app/dashboard/inbox/layout.tsx`, `web/app/dashboard/inbox/actions.ts`, `web/app/dashboard/inbox/inbox-shell.tsx`, `web/app/dashboard/inbox/page.tsx`
- Test: `web/app/dashboard/inbox/inbox-shell.test.tsx`
- Modify: `web/app/dashboard/workspace.css`

**Interfaces:**
- Consumes: `listHostConversations`, `HostConversationSummary`, `AI_STATE` values (Task 1).
- Produces: `refreshInboxAction(): Promise<HostConversationSummary[]>` (a Server Action, exported from `actions.ts`, reused by Task 5's detail page after a host sends a message — a new message changes the list's "last message"/unread ordering too); `<InboxShell initialConversations={...} organizationSlug={...}>{children}</InboxShell>`.

- [ ] **Step 1: Write the failing component test**

```tsx
// web/app/dashboard/inbox/inbox-shell.test.tsx
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
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: () => ({ on: () => ({ subscribe: (cb: (s: string) => void) => { cb("SUBSCRIBED"); return { unsubscribe: vi.fn() }; } }) }) }),
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/inbox/inbox-shell.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `web/app/dashboard/inbox/actions.ts`**

```typescript
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
```

- [ ] **Step 4: Create `web/app/dashboard/inbox/inbox-shell.tsx`**

```tsx
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

  useEffect(() => {
    if (searchParams?.get("filter") === "escalated") setShowEscalatedOnly(true);
  }, [searchParams]);

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

  const properties = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of conversations) seen.set(c.propertyId, c.propertyName);
    return Array.from(seen, ([id, name]) => ({ id, name }));
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
              <option key={p.id} value={p.id}>{p.name}</option>
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
```

- [ ] **Step 5: Create `web/app/dashboard/inbox/layout.tsx`**

```tsx
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
```

- [ ] **Step 6: Create `web/app/dashboard/inbox/page.tsx`**

```tsx
import { IconInbox } from "@/components/ui/icons";

export default function InboxIndexPage() {
  return (
    <div className="inbox-empty-detail">
      <span><IconInbox className="size-6" /></span>
      <p>Select a conversation to read it.</p>
    </div>
  );
}
```

- [ ] **Step 7: Add the inbox CSS classes** (append to `web/app/dashboard/workspace.css`, alongside the existing `.property-*`/`.settings-content-grid` rules — same tokens, same radii, no new colors)

```css
.inbox-layout { display:grid; grid-template-columns:minmax(280px,.9fr) minmax(0,2fr); gap:24px; align-items:start; }
.inbox-list-pane { border:1px solid var(--hairline); border-radius:12px; background:var(--surface); overflow:hidden; }
.inbox-toolbar { display:flex; flex-wrap:wrap; gap:10px; padding:16px; border-bottom:1px solid var(--hairline); background:#f4f7ef; }
.inbox-toolbar input { flex:1 1 160px; border:1px solid var(--hairline); background:var(--surface-muted); border-radius:8px; min-height:42px; padding:9px 14px; font-size:12px; }
.inbox-toolbar select { min-height:42px; border:1px solid var(--hairline); border-radius:8px; background:var(--surface); padding:8px 12px; font-size:11px; color:var(--ink); }
.inbox-clear-filter { border:1px solid var(--hairline); border-radius:8px; padding:8px 12px; font-size:11px; background:var(--surface); color:var(--accent); }
.inbox-list { max-height:70vh; overflow-y:auto; }
.inbox-row a { display:block; padding:14px 16px; text-decoration:none; color:inherit; }
.inbox-row:hover, .inbox-row.is-active { background:var(--surface-muted); }
.inbox-row-top { display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
.inbox-row-time { font-size:10px; color:var(--muted); white-space:nowrap; }
.inbox-row-preview { margin:4px 0 8px; font-size:12px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.inbox-row-badges { display:flex; align-items:center; gap:8px; }
.inbox-unread-badge { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 6px; border-radius:999px; background:var(--accent); color:var(--accent-contrast); font-size:11px; font-weight:600; }
.inbox-detail-pane { min-height:70vh; }
.inbox-empty-detail { display:flex; flex-direction:column; align-items:center; justify-content:center; height:70vh; gap:12px; color:var(--muted); border:1px dashed var(--hairline); border-radius:12px; }
@media (max-width:1023px) {
  .inbox-layout { grid-template-columns:1fr; }
  .inbox-list-pane[data-has-open="true"] { display:none; }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/inbox/inbox-shell.test.tsx"`
Expected: PASS, all 6 tests green.

- [ ] **Step 9: Commit**

```bash
git add web/app/dashboard/inbox/layout.tsx web/app/dashboard/inbox/actions.ts web/app/dashboard/inbox/inbox-shell.tsx web/app/dashboard/inbox/inbox-shell.test.tsx web/app/dashboard/inbox/page.tsx web/app/dashboard/workspace.css
git commit -m "feat: inbox list pane — live, searchable, filterable across every property"
```

---

### Task 5: Conversation detail — message log, host send, AI toggle, copy link

**Files:**
- Create: `web/app/dashboard/inbox/[id]/page.tsx`, `web/app/dashboard/inbox/[id]/conversation-detail.tsx`
- Modify: `web/app/dashboard/inbox/actions.ts`
- Test: `web/app/dashboard/inbox/[id]/conversation-detail.test.tsx`

**Interfaces:**
- Consumes: `getHostConversation`, `listMessages` (existing, from M7), `setAiEnabled`, `markConversationRead`, `parseHostMessage`, `addMessage` (existing), all from `web/lib/chat/conversations.ts`.
- Produces: `setAiEnabledAction(conversationId, enabled): Promise<void>`; `sendHostMessageAction(conversationId, _prev, formData): Promise<FormState>` (same `{error, success}` shape as the rest of the dashboard's Server Actions); `refreshMessagesAction(conversationId): Promise<ChatMessage[]>`.

- [ ] **Step 1: Write the failing component test**

```tsx
// web/app/dashboard/inbox/[id]/conversation-detail.test.tsx
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
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ channel: () => ({ on: () => ({ subscribe: (cb: (s: string) => void) => { cb("SUBSCRIBED"); return { unsubscribe: vi.fn() }; } }) }) }),
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/inbox/[id]/conversation-detail.test.tsx"`
Expected: FAIL — module not found.

- [ ] **Step 3: Add to `web/app/dashboard/inbox/actions.ts`**

```typescript
import { revalidatePath } from "next/cache";
import {
  addMessage,
  getHostConversation,
  listMessages,
  markConversationRead,
  parseHostMessage,
  setAiEnabled,
  type ChatMessage,
} from "@/lib/chat/conversations";

export type FormState = { error: string | null; success: boolean };

export async function setAiEnabledAction(conversationId: string, enabled: boolean): Promise<void> {
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, conversationId);
  if (!conversation) throw new Error("Conversation not found.");
  await setAiEnabled(supabase, conversationId, enabled);
  revalidatePath(`/dashboard/inbox/${conversationId}`);
}

export async function sendHostMessageAction(conversationId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseHostMessage(String(formData.get("body") ?? ""));
  if ("error" in parsed) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, conversationId);
  if (!conversation) return { error: "Conversation not found.", success: false };
  await addMessage(supabase, conversationId, "host", parsed.body);
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  return { error: null, success: true };
}

// Reconciliation for the message log (INBOX-03), same shape as
// refreshInboxAction above but scoped to one conversation. Also marks the
// conversation read, since opening/refreshing a conversation is exactly
// when a host has seen its messages (INBOX-09).
export async function refreshMessagesAction(conversationId: string): Promise<ChatMessage[]> {
  const { supabase } = await dashboardContext();
  const conversation = await getHostConversation(supabase, conversationId);
  if (!conversation) return [];
  await markConversationRead(supabase, conversationId);
  return listMessages(supabase, conversationId);
}
```

- [ ] **Step 4: Create `web/app/dashboard/inbox/[id]/conversation-detail.tsx`**

```tsx
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

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        () => void reconcile(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void reconcile();
      });
    return () => { void channel.unsubscribe(); };
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
```

- [ ] **Step 5: Create `web/app/dashboard/inbox/[id]/page.tsx`**

```tsx
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
```

- [ ] **Step 6: Add the conversation-detail CSS** (append to `workspace.css`)

```css
.conversation-detail { display:flex; flex-direction:column; height:70vh; border:1px solid var(--hairline); border-radius:12px; background:var(--surface); overflow:hidden; }
.conversation-detail-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:16px 20px; border-bottom:1px solid var(--hairline); background:#f4f7ef; }
.conversation-detail-header h2 { font-size:15px; font-weight:600; }
.conversation-escalated-note { display:flex; align-items:center; gap:8px; margin-top:6px; font-size:12px; color:var(--muted); }
.conversation-detail-actions { display:flex; gap:10px; flex-wrap:wrap; }
.conversation-log { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:14px; }
.conversation-message { display:flex; flex-direction:column; gap:4px; max-width:70%; }
.conversation-message[data-sender="host"] { align-self:flex-end; align-items:flex-end; }
.conversation-message[data-sender="guest"] { align-self:flex-start; }
.conversation-message[data-sender="ai"] { align-self:flex-start; }
.conversation-sender { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.03em; }
.conversation-bubble { border-radius:14px; padding:10px 14px; font-size:13px; line-height:1.5; }
.conversation-message[data-sender="host"] .conversation-bubble { background:var(--ink); color:#fff; }
.conversation-message[data-sender="guest"] .conversation-bubble { background:var(--surface-muted); color:var(--ink); }
.conversation-message[data-sender="ai"] .conversation-bubble { background:var(--accent-soft); color:var(--ink); }
.conversation-composer { display:flex; gap:12px; align-items:flex-end; padding:16px 20px; border-top:1px solid var(--hairline); }
.conversation-composer textarea { flex:1; border:1px solid var(--hairline); border-radius:10px; padding:10px 14px; font-size:13px; resize:none; min-height:44px; }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 "app/dashboard/inbox/[id]/conversation-detail.test.tsx"`
Expected: PASS, all 5 tests green.

- [ ] **Step 8: Commit**

```bash
git add web/app/dashboard/inbox/[id]/page.tsx web/app/dashboard/inbox/[id]/conversation-detail.tsx web/app/dashboard/inbox/actions.ts web/app/dashboard/inbox/[id]/conversation-detail.test.tsx web/app/dashboard/workspace.css
git commit -m "feat: conversation detail — labelled log, host send, AI on/off, copy guest link"
```

---

### Task 6: End-to-end integration test for the AI-toggle/host-send/re-enable loop through the real Server Actions

**Files:**
- Test: `web/app/dashboard/inbox/inbox.integration.test.ts`

This is the one task in this plan whose entire job is a test — Tasks 1-5 each unit/component-tested their own layer against mocks or the DB directly, but nothing yet proves the actual `"use server"` actions in `web/app/dashboard/inbox/actions.ts` work end-to-end against a real signed-in host and a real conversation, the way M7/M8's `*.actions.test.ts` files already do for the guest chat and AI settings.

**Interfaces:** none produced — this only proves existing interfaces from Tasks 1 and 5 compose correctly.

- [ ] **Step 1: Write the test** (model this on `web/app/dashboard/properties/[id]/ai-settings/actions.test.ts` from M8 — read it first for the exact "real signed-in host, real Supabase, mock nothing" convention this repo uses for Server Action tests)

```typescript
// web/app/dashboard/inbox/inbox.integration.test.ts
// @vitest-environment node
import { test, expect, beforeAll, afterAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createProperty, setPropertyPublished } from "@/lib/properties/basics";
import { startConversation, getConversation } from "@/lib/chat/conversations";
import { createTestHostWithOrg, supabaseAdmin } from "@/tests/helpers";
import { refreshMessagesAction, sendHostMessageAction, setAiEnabledAction } from "./actions";

// dashboardContext() reads the request's cookies via next/headers, which
// has no meaning outside a real request — every dashboard Server Action
// test in this repo mocks dashboardContext() to return a real signed-in
// host's own client instead (see ai-settings/actions.test.ts, M8). vi.mock
// is hoisted above every import in this file (including the ./actions one
// above), so actions.ts's own "../_lib/context" import — which resolves to
// the same module this mock targets, since both files live in
// web/app/dashboard/inbox/ — picks up the mock automatically.
let host: Awaited<ReturnType<typeof createTestHostWithOrg>>;
vi.mock("../_lib/context", () => ({
  dashboardContext: async () => ({ supabase: host.supabase, organization: { id: host.organizationId, slug: host.organizationSlug, name: "Test Org" } }),
}));

let service: SupabaseClient;
let propertyId: string;
let conversationId: string;

beforeAll(async () => {
  host = await createTestHostWithOrg();
  service = supabaseAdmin();
  const { propertyId: id, error } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "Integration Cabin", property_type: "cabin", address: "Somewhere", base_rate_cents: 500_000, max_guests: 2 },
  });
  if (error) throw new Error(error);
  propertyId = id!;
  await setPropertyPublished(host.supabase, propertyId, true);
  const started = await startConversation(service, propertyId);
  if (!("token" in started)) throw new Error("could not start conversation");
  conversationId = (await getConversation(service, started.token))!.id;
});

afterAll(async () => {
  await host?.cleanup();
});

// @req INBOX-04
// @req INBOX-06
// @req INBOX-07
test("the full take-over loop: turn AI off, send as host, turn it back on, message is stored and readable", async () => {
  await setAiEnabledAction(conversationId, false);
  let { data: row } = await service.from("conversations").select("ai_enabled").eq("id", conversationId).single();
  expect(row!.ai_enabled).toBe(false);

  const formData = new FormData();
  formData.set("body", "I'll confirm your dates shortly.");
  const sendResult = await sendHostMessageAction(conversationId, { error: null, success: false }, formData);
  expect(sendResult).toEqual({ error: null, success: true });

  await setAiEnabledAction(conversationId, true);
  ({ data: row } = await service.from("conversations").select("ai_enabled").eq("id", conversationId).single());
  expect(row!.ai_enabled).toBe(true);

  const messages = await refreshMessagesAction(conversationId);
  expect(messages.map((m) => [m.sender, m.body])).toContainEqual(["host", "I'll confirm your dates shortly."]);
});

// @req INBOX-09
test("refreshMessagesAction marks the conversation read as a side effect", async () => {
  await refreshMessagesAction(conversationId);
  const { data } = await service.from("conversations").select("host_last_read_at").eq("id", conversationId).single();
  expect(data!.host_last_read_at).not.toBeNull();
});

// @req INBOX-02
// Every UI test in Tasks 4/5 mocks the realtime channel entirely (a fake
// object that immediately calls back "SUBSCRIBED") — none of them proves a
// message actually arrives over a live channel. This is the one real,
// end-to-end proof: a genuine @supabase/supabase-js client (host.supabase,
// signed in exactly like the browser client will be) opens a real
// postgres_changes subscription against the local stack's real Realtime
// service, a service-role insert simulates a guest message landing, and the
// callback must fire with that row. The conversations-table path
// (ai_enabled/escalated changes) shares the identical publication and
// postgres_changes mechanism — this one test is the proof for both; a
// second, near-identical WebSocket test would only add flakiness, not
// coverage of anything materially different.
test("a message inserted by the service role arrives over the host's own realtime subscription", async () => {
  const received = new Promise<{ body: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("realtime event did not arrive within 10s")), 10_000);
    host.supabase
      .channel(`test-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => { clearTimeout(timeout); resolve(payload.new as { body: string }); },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void service.from("messages").insert({ conversation_id: conversationId, sender: "guest", body: "Realtime probe message" });
      });
  });
  expect((await received).body).toBe("Realtime probe message");
}, 15_000);
```

- [ ] **Step 2: Run it**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 "app/dashboard/inbox/inbox.integration.test.ts"`
Expected: PASS. If `dashboardContext()`'s mocked shape doesn't match what `../_lib/context.ts` actually exports (check it first), adjust the mock to match — don't change `actions.ts` to work around a mismatch.

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/inbox/inbox.integration.test.ts
git commit -m "test: end-to-end Server Action coverage for the inbox take-over loop"
```

---

### Task 7: Full-suite pass, requirements coverage, milestone gate

**Files:** No new files. Modifies `docs/TRACKER.md` only (regenerated).

- [ ] **Step 1: Run every touched directory together**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 lib/chat "app/dashboard"`
Expected: PASS, no regressions in M1-M8 dashboard/chat tests that share these directories.

- [ ] **Step 2: Run the full web test suite, lint, and scripts test**

```bash
cd web && npm run lint && npx vitest run --maxWorkers=1 --testTimeout=120000 && cd .. && npm run test:scripts
```
Expected: all green.

- [ ] **Step 3: Run the audit and check M9 coverage**

Run: `npm run audit -- --milestone M9`
Expected: 13/13. If any `INBOX-xx` is still `todo`, find the test that actually proves it and add its `// @req INBOX-xx` tag — never edit the auditor to force a pass. Watch specifically for the tag-parsing quirk found in M8 (a comma-separated `// @req A, B` line only registers the first id) — if a test proves more than one requirement, give it one `// @req` line per id, not a combined one.

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: succeeds, no TypeScript errors.

- [ ] **Step 5: Constraint sweep**

```bash
grep -n "grant\|policy" supabase/migrations/*.sql | grep -i "conversations\|messages"   # only the alter publication line is new
grep -n "ai_settings\|knowledge_base" supabase/migrations/*.sql                          # unchanged from before this milestone
```

- [ ] **Step 6: Commit the regenerated tracker**

```bash
git add docs/TRACKER.md
git commit -m "chore: M9 tracker coverage — 13/13"
```

---

## Milestone finish

1. **Final whole-branch review.** Emphasis:
   - Can a host reach another org's conversation, by id or via Realtime? (RLS is the only gate — verify `owns_conversation`/`owns_property` genuinely still deny it, don't just trust that no new policy was added.)
   - Does enabling the `supabase_realtime` publication expose anything to `anon`? (It shouldn't — anon has zero grants on either table.)
   - Does turning the AI off ever accidentally touch `ai_state` or bypass the payment-state trigger? (It shouldn't — `setAiEnabled` touches only `ai_enabled`.)
   - Is the "subscribe, then reconcile" ordering actually followed in both `inbox-shell.tsx` and `conversation-detail.tsx` (reconcile only fires from the `SUBSCRIBED` callback or a known-id miss, never before)?
2. **Browser walk** (390px and 1440px): open the inbox, see the list, open a conversation, send a message as host, toggle the AI off and on, copy the guest link, search and filter the list, click through from the dashboard home's "Escalated chats" row.
3. Run `npx supabase db push`. Push `main`, watch CI, curl the live `/dashboard/inbox` route (should redirect to `/login`, not 500, since it's behind auth).
4. Update `milestone-progress` memory with what M9 actually shipped and any follow-ups found during review.
