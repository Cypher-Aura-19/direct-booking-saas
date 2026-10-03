# M11a Payment, Stay and Check-in/out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After approving a booking, the host marks payment received: the booking becomes `paid`, the conversation moves `payment → stay` and the AI resumes (answers check-in/house questions, hands refund/new-charge questions to the host). The host then marks check-in and check-out (`paid → staying → checked_out`).

**Architecture:** Three `security invoker` Postgres functions (`mark_booking_paid`, `check_in_booking`, `check_out_booking`), each one transaction, mirroring M10's `approve_booking`. The AI needs no new resume logic (`runGuestTurn` is silent only in `payment`/AI-off; `buildContext` already unlocks stay-only details). A deterministic keyword pre-check, in the slot of the existing "ask for a person" check, hands refund/charge questions to the host in `stay` state before the model is called. The host UI's booking actions become status-aware.

**Tech Stack:** Postgres plpgsql, Next.js Server Actions/Components, Vitest against the real local Supabase stack (no mocks for `lib/`; `ScriptedModel` for the agent), React Testing Library. No new dependencies.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-10-03-m11a-payment-stay-design.md` (decisions M11a-1 … M11a-6). Requirements `PAY-01 … PAY-06`. **Out of scope:** CNIC upload/records/export/retention (M11b), any change to the "payment received" message beyond its fixed text.
- **RLS is the only authorization boundary.** Host-side functions take the caller's own `SupabaseClient` (`dashboardContext()`); the new functions are `security invoker` so `owns_property` still gates them. **No new RLS policy, no table grant change, no `security definer`.**
- **The AI money-block is untouched.** The only `ai_state` write is `payment → stay` inside `mark_booking_paid` (allowed by the forward-only trigger). The acknowledgement is inserted **after** the flip, so `messages_forbid_ai_during_payment` is neither bypassed nor modified.
- **Anon gets nothing:** `revoke execute … from public, anon; grant execute … to authenticated` on all three functions (the Supabase anon-by-name gotcha, see `20260925010000`).
- **Refund/charge handling is deterministic in stay state** and never depends on the model; the keyword set is deliberately narrow (a miss still hits the prompt rule) and must not catch ordinary stay questions ("phone charging point", "extra towels").
- **UI:** reuse existing tokens/classes/components; logical CSS properties; no new colours. Confirmation text must say what will happen.
- **Tests:** `web/lib/**` tests start with `// @vitest-environment node`, real local Supabase, one `// @req PAY-xx` line per ID (a comma-separated line only registers the first).
- **Machine: low memory.** `npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 <paths>` from `web/`. Apply the migration locally with `npx supabase db reset` from the repo root (never `db push` inside a task).
- **CI audit gate stays at `--milestone M10`** until M11b lands (gating M11 would demand all 21 requirements). `docs/TRACKER.md` is regenerated and committed in the last task so the `PAY-*` rows show `done`.
- **Worktree-session git:** use plain, separate git commands (no compound `cd && git`); `ExitWorktree keep` before merging; delete the merged worktree directory (`cmd /c rd /s /q "\\?\<path>"`) **before** the final audit/tracker check.
- **Commit after each task**, messages ending `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

## File Structure

```
supabase/migrations/20261003020000_m11a_payment_stay.sql    NEW  mark_booking_paid(), check_in_booking(), check_out_booking()
web/lib/bookings/
├─ host.ts                                                   MODIFY  markBookingPaid, checkInBooking, checkOutBooking
└─ stay.test.ts                                              NEW  PAY-01/02/03/06 against the real stack
web/lib/chat/
├─ money.ts (+test)                                          NEW  isMoneyRequest()
├─ agent.ts (+agent.test.ts)                                 MODIFY  stay-state money pre-check; PAY-04/05 tests
└─ context.ts                                                MODIFY  one stay-state rule line
web/app/dashboard/bookings/
├─ actions.ts                                                MODIFY  markPaidAction, checkInAction, checkOutAction
├─ bookings.integration.test.ts                              MODIFY  full approve → paid → check-in → check-out walk
└─ [id]/
   ├─ booking-actions.tsx (+test)                            MODIFY  status-aware actions
   └─ page.tsx                                               MODIFY  pass status
docs/TRACKER.md                                              regenerated
```

---

### Task 1: Migration and host library — mark paid, check in, check out

**Files:**
- Create: `supabase/migrations/20261003020000_m11a_payment_stay.sql`, `web/lib/bookings/stay.test.ts`
- Modify: `web/lib/bookings/host.ts`

**Interfaces:**
- Consumes: `seedBookingFixture`, `insertRequestedBooking` (`web/tests/bookings.ts`), `approveBooking`, `DecisionResult`, `decision()` (all in `host.ts`).
- Produces: `markBookingPaid(supabase, id)`, `checkInBooking(supabase, id)`, `checkOutBooking(supabase, id)`, each `Promise<DecisionResult>`.

- [ ] **Step 1: Write the migration**

```sql
-- ---------------------------------------------------------------------------
-- M11a payment, stay and check-in/out. No table, column, RLS or grant change:
-- these are security invoker functions, so the existing bookings_all_own /
-- conversations_all_own / messages_all_own policies (M2) gate them exactly as
-- they gate a direct update by the host.
-- ---------------------------------------------------------------------------

-- Mark paid: booking -> paid, conversation payment -> stay (the AI resumes),
-- then ONE fixed-template acknowledgement. The acknowledgement is inserted
-- AFTER the flip: messages_forbid_ai_during_payment only blocks AI messages
-- while the conversation is in 'payment', so this is permitted and that
-- trigger is left exactly as it was. Not model output.
create function public.mark_booking_paid(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.status <> 'approved' then
    raise exception 'booking is not awaiting payment' using errcode = '55000';
  end if;

  update public.bookings set status = 'paid' where id = b.id;

  if b.conversation_id is not null then
    update public.conversations set ai_state = 'stay' where id = b.conversation_id;
    insert into public.messages (conversation_id, sender, body)
    values (
      b.conversation_id,
      'ai',
      'Payment received - you''re confirmed. Ask me anything about check-in or the house.'
    );
  end if;
end;
$$;

-- Check in / check out only move the booking along the pipeline. The
-- conversation stays in 'stay' (terminal), and there is deliberately no date
-- gating: early arrivals and late departures are the host's call.
create function public.check_in_booking(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated integer;
begin
  update public.bookings set status = 'staying' where id = booking_id and status = 'paid';
  get diagnostics updated = row_count;
  if updated = 0 then
    perform 1 from public.bookings where id = booking_id;
    if not found then
      raise exception 'booking not found' using errcode = 'P0002';
    end if;
    raise exception 'booking is not ready to check in' using errcode = '55000';
  end if;
end;
$$;

create function public.check_out_booking(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated integer;
begin
  update public.bookings set status = 'checked_out' where id = booking_id and status = 'staying';
  get diagnostics updated = row_count;
  if updated = 0 then
    perform 1 from public.bookings where id = booking_id;
    if not found then
      raise exception 'booking not found' using errcode = 'P0002';
    end if;
    raise exception 'booking is not ready to check out' using errcode = '55000';
  end if;
end;
$$;

-- Supabase grants EXECUTE to anon by name at creation time regardless of
-- `revoke ... from public` (the gotcha 20260925010000 documents).
revoke execute on function public.mark_booking_paid(uuid) from public, anon;
revoke execute on function public.check_in_booking(uuid) from public, anon;
revoke execute on function public.check_out_booking(uuid) from public, anon;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.check_in_booking(uuid) to authenticated;
grant execute on function public.check_out_booking(uuid) to authenticated;
```

- [ ] **Step 2: Apply it locally**

Run (repo root): `npx supabase db reset`. Expected: finishes with no error. Then confirm ACLs: `docker exec supabase_db_airbnb_like_system psql -U postgres -At -c "select proname, proacl::text from pg_proc where proname in ('mark_booking_paid','check_in_booking','check_out_booking')"` — every row shows `authenticated=X` and **no** `anon=`.

- [ ] **Step 3: Write the failing tests** — `web/lib/bookings/stay.test.ts`

```typescript
// @vitest-environment node
import { test, expect } from "vitest";
import { addDays } from "@/lib/availability/dates";
import { localToday } from "@/lib/dashboard/analytics";
import { anonClient } from "@/tests/helpers";
import { insertRequestedBooking, seedBookingFixture } from "@/tests/bookings";
import { approveBooking, checkInBooking, checkOutBooking, markBookingPaid } from "./host";

const START = addDays(localToday(), 30);
const END = addDays(START, 3);

async function approvedBooking(withConversation = true) {
  const fixture = await seedBookingFixture();
  const booking = await insertRequestedBooking(fixture.service, {
    propertyId: fixture.propertyId, organizationId: fixture.host.organizationId, start: START, end: END, withConversation,
  });
  expect(await approveBooking(fixture.host.supabase, booking.bookingId)).toEqual({ ok: true });
  return { ...fixture, ...booking };
}

const statusOf = async (service: Awaited<ReturnType<typeof approvedBooking>>["service"], id: string) =>
  (await service.from("bookings").select("status").eq("id", id).single()).data!.status;

// @req PAY-01
// @req PAY-02
// @req PAY-03
test("marking payment received makes the booking paid, moves the conversation to stay and sends exactly one acknowledgement", async () => {
  const { host, service, bookingId, conversationId } = await approvedBooking();

  expect(await markBookingPaid(host.supabase, bookingId)).toEqual({ ok: true });

  expect(await statusOf(service, bookingId)).toBe("paid");
  const { data: conversation } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(conversation!.ai_state).toBe("stay");

  const { data: messages } = await service.from("messages").select("sender, body").eq("conversation_id", conversationId!).order("created_at");
  expect(messages!.map((m) => m.sender)).toEqual(["ai", "ai"]); // M10's approval ack, then this one
  expect(messages![1].body).toMatch(/Payment received/);

  // A second call is a typed no-op: no second message.
  expect(await markBookingPaid(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  const { data: after } = await service.from("messages").select("id").eq("conversation_id", conversationId!);
  expect(after).toHaveLength(2);
  await host.cleanup();
});

// @req PAY-03
test("in stay state an AI message can be written again (the payment-state block has lifted)", async () => {
  const { host, service, bookingId, conversationId } = await approvedBooking();
  await markBookingPaid(host.supabase, bookingId);
  const { error } = await service.from("messages").insert({ conversation_id: conversationId, sender: "ai", body: "Check-in is from 2pm." });
  expect(error).toBeNull();
  await host.cleanup();
});

// @req PAY-01
test("only an approved booking can be marked paid", async () => {
  const fixture = await seedBookingFixture();
  const { bookingId, conversationId } = await insertRequestedBooking(fixture.service, {
    propertyId: fixture.propertyId, organizationId: fixture.host.organizationId, start: START, end: END,
  });
  expect(await markBookingPaid(fixture.host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  expect(await statusOf(fixture.service, bookingId)).toBe("requested");
  const { data } = await fixture.service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(data!.ai_state).toBe("enquiry");
  await fixture.host.cleanup();
});

// @req PAY-01
test("another organisation cannot mark, check in or check out a booking, and anon cannot call any of them", async () => {
  const a = await approvedBooking();
  const b = await seedBookingFixture();
  expect(await markBookingPaid(b.host.supabase, a.bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await checkInBooking(b.host.supabase, a.bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await checkOutBooking(b.host.supabase, a.bookingId)).toEqual({ ok: false, reason: "not_found" });
  expect(await statusOf(a.service, a.bookingId)).toBe("approved");

  const anon = anonClient();
  for (const fn of ["mark_booking_paid", "check_in_booking", "check_out_booking"]) {
    expect((await anon.rpc(fn, { booking_id: a.bookingId })).error).not.toBeNull();
  }
  await a.host.cleanup();
  await b.host.cleanup();
});

// @req PAY-06
test("check-in then check-out move the booking paid -> staying -> checked_out, in that order only", async () => {
  const { host, service, bookingId, conversationId } = await approvedBooking();

  // Not yet paid: neither step is available.
  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  await markBookingPaid(host.supabase, bookingId);
  // Paid but not checked in: check-out is premature.
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await statusOf(service, bookingId)).toBe("staying");
  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await statusOf(service, bookingId)).toBe("checked_out");
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: false, reason: "already_handled" });

  const { data } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(data!.ai_state).toBe("stay"); // terminal; check-in/out never touch it
  await host.cleanup();
});

test("a booking without a conversation still moves through the whole pipeline", async () => {
  const { host, service, bookingId } = await approvedBooking(false);
  expect(await markBookingPaid(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await checkInBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await checkOutBooking(host.supabase, bookingId)).toEqual({ ok: true });
  expect(await statusOf(service, bookingId)).toBe("checked_out");
  await host.cleanup();
});
```

- [ ] **Step 4: Run to verify they fail**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 lib/bookings/stay.test.ts`
Expected: FAIL — `markBookingPaid` / `checkInBooking` / `checkOutBooking` are not exported from `./host`.

- [ ] **Step 5: Implement** — append to `web/lib/bookings/host.ts` (after `rejectBooking`; do not change any existing export)

```typescript
export async function markBookingPaid(supabase: SupabaseClient, id: string): Promise<DecisionResult> {
  const { error } = await supabase.rpc("mark_booking_paid", { booking_id: id });
  return decision(error);
}

export async function checkInBooking(supabase: SupabaseClient, id: string): Promise<DecisionResult> {
  const { error } = await supabase.rpc("check_in_booking", { booking_id: id });
  return decision(error);
}

export async function checkOutBooking(supabase: SupabaseClient, id: string): Promise<DecisionResult> {
  const { error } = await supabase.rpc("check_out_booking", { booking_id: id });
  return decision(error);
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 lib/bookings`
Expected: PASS — the new `stay.test.ts` (6 tests) plus every existing `lib/bookings` test (host, requests, payment-instructions, guest) unmodified.

- [ ] **Step 7: Constraint sweep**

Run: `grep -c "security definer" supabase/migrations/20261003020000_m11a_payment_stay.sql` → `0`. Run: `grep -n "grant\|policy" supabase/migrations/20261003020000_m11a_payment_stay.sql` → only the three `revoke execute` and three `grant execute … to authenticated` lines; no table grant, no policy.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261003020000_m11a_payment_stay.sql web/lib/bookings/host.ts web/lib/bookings/stay.test.ts
git commit -m "feat: mark paid, check in and check out — atomic booking and conversation transitions"
```

---

### Task 2: The AI resumes in stay state, and hands refund/charge questions to the host

**Files:**
- Create: `web/lib/chat/money.ts`, `web/lib/chat/money.test.ts`
- Modify: `web/lib/chat/agent.ts`, `web/lib/chat/context.ts`, `web/lib/chat/agent.test.ts`

**Interfaces:**
- Produces: `isMoneyRequest(text: string): boolean`.
- Consumes: `holdingMessage`, `handOff` (inside `runGuestTurn`), `ScriptedModel`, the fixtures already in `agent.test.ts` (`newChat`, `conversationRow`, `stored`, `respond`, `service`, `TODAY`).

- [ ] **Step 1: Write the failing matcher test** — `web/lib/chat/money.test.ts`

```typescript
// @vitest-environment node
import { test, expect } from "vitest";
import { isMoneyRequest } from "./money";

test("refund, charge, deposit and cancellation wording is a money request", () => {
  for (const text of [
    "I want a refund for last night",
    "Can I get my money back?",
    "Please reimburse me for the broken heater",
    "Why was I charged extra?",
    "I was charged twice",
    "Is there an additional charge for the bonfire?",
    "Do I get my security deposit back",
    "I'd like to cancel my booking",
    "Can you give me a discount for the inconvenience",
    "Paise wapas chahiye",
    "مجھے ریفنڈ چاہیے",
  ]) {
    expect(isMoneyRequest(text), text).toBe(true);
  }
});

test("ordinary stay questions are not money requests", () => {
  for (const text of [
    "What is the wifi password?",
    "What time is checkout?",
    "Is there a phone charging point in the room?",
    "Can I get extra towels?",
    "Where can I park the car?",
    "How do I use the geyser?",
    "The heater is not working",
  ]) {
    expect(isMoneyRequest(text), text).toBe(false);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run --maxWorkers=1 lib/chat/money.test.ts`
Expected: FAIL — module `./money` not found.

- [ ] **Step 3: Implement the matcher** — `web/lib/chat/money.ts`

```typescript
// Deterministic pre-check (PAY-05), the same shape as language.ts's
// isHumanRequest (AI-14): in stay state a guest raising refunds, cancellations
// or a new/extra charge is handed to the host without spending a model call —
// the model can't be talked into discussing money it never sees. Deliberately
// narrow: a miss is still caught by buildContext's stay-state rule line, and
// the patterns must not catch ordinary stay questions ("phone charging point",
// "extra towels").
const MONEY_PATTERNS: readonly RegExp[] = [
  /\brefunds?\b/i,
  /\bmoney\s+back\b/i,
  /\breimburs\w*/i,
  /\b(extra|additional|new|another|unexpected|hidden)\s+(charges?|fees?|payments?|bills?)\b/i,
  /\bover-?charg\w*/i,
  /\b(been|was|were|get|got)\s+charged\b/i,
  /\bcharged\s+(me|us|extra|twice|again)\b/i,
  /\bdeposits?\b/i,
  /\bpay\s+(more|extra|again)\b/i,
  /\bdiscounts?\b/i,
  /\bcancel(?:l?ation|l?ed|l?ing|s)?\b/i,
  // Roman Urdu / Urdu
  /\b(paise|paisay|raqam)\s+wapas\b/i,
  /\bwapas\s+(karo|chahiye|paise)\b/i,
  /ریفنڈ/,
  /(پیسے|رقم)\s*واپس/,
];

export function isMoneyRequest(text: string): boolean {
  return MONEY_PATTERNS.some((pattern) => pattern.test(text));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run --maxWorkers=1 lib/chat/money.test.ts`
Expected: PASS, 2 tests. If a positive case fails, fix the pattern, not the test; if a negative case matches, narrow the pattern.

- [ ] **Step 5: Write the failing agent tests** — append to `web/lib/chat/agent.test.ts` (it already has `service`, `TODAY`, `newChat`, `conversationRow`, `stored`, `respond`, `holdingMessage`, `ScriptedModel`, `runGuestTurn`)

```typescript
async function inStay(token: string) {
  const { conversation } = await conversationRow(token);
  const { error } = await service.from("conversations").update({ ai_state: "stay" }).eq("id", conversation.id);
  if (error) throw error;
}

// @req PAY-04
test("in stay state the AI answers a house question again, with the stay-only details unlocked", async () => {
  const token = await newChat();
  await inStay(token);
  const model = new ScriptedModel([respond("The geyser is gas; switch it on 15 minutes before.")]);

  const result = await runGuestTurn({ service, model, token, text: "How do I use the geyser?", today: TODAY });
  if (!("messages" in result)) throw new Error("expected messages");

  expect(model.calls).toHaveLength(1); // the model is called again
  expect(result.messages.map((m) => m.sender)).toEqual(["guest", "ai"]);
  expect(result.escalated).toBe(false);
  expect(model.calls[0].system).toContain("A-GATE-4412"); // stay unlocks the gate code
  expect(model.calls[0].system).toContain("Gas geyser");
  expect(model.calls[0].system).toContain("The guest is staying"); // the stay-state rule line
});

// @req PAY-05
test("in stay state a refund question is handed to the host without calling the model", async () => {
  const token = await newChat();
  await inStay(token);
  const model = new ScriptedModel([respond("should never be sent")]);

  const result = await runGuestTurn({ service, model, token, text: "I want a refund for last night", today: TODAY });
  if (!("messages" in result)) throw new Error("expected messages");

  expect(model.calls).toHaveLength(0);
  expect(result.escalated).toBe(true);
  expect(result.messages.map((m) => m.sender)).toEqual(["guest", "ai"]);
  expect(result.messages[1].body).toBe(holdingMessage("en"));
  expect(await conversationRow(token)).toMatchObject({ escalated: true, escalation_reason: "money" });
});

// @req PAY-05
test("in stay state an extra-charge question is handed to the host too", async () => {
  const token = await newChat();
  await inStay(token);
  const model = new ScriptedModel([respond("should never be sent")]);
  await runGuestTurn({ service, model, token, text: "Why was I charged extra for the bonfire?", today: TODAY });
  expect(model.calls).toHaveLength(0);
  expect(await conversationRow(token)).toMatchObject({ escalation_reason: "money" });
});

test("outside stay state the same wording is not intercepted — the prompt rule handles it there", async () => {
  const token = await newChat(); // enquiry
  const model = new ScriptedModel([respond("The host handles refunds.", true, "money")]);
  await runGuestTurn({ service, model, token, text: "What is your refund policy?", today: TODAY });
  expect(model.calls).toHaveLength(1);
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 lib/chat/agent.test.ts`
Expected: FAIL — the PAY-04 test misses "The guest is staying"; the PAY-05 tests find `model.calls` of length 1, not 0. (The existing tests still pass.)

- [ ] **Step 7: Implement the pre-check** — in `web/lib/chat/agent.ts`

Add the import next to the other chat imports:

```typescript
import { isMoneyRequest } from "./money";
```

Immediately after the existing line `if (isHumanRequest(body)) return handOff("human");` add:

```typescript
  // 7.2. Stay state: refunds, cancellations and new charges are the host's,
  // never the model's — handed off before the model is ever called (PAY-05).
  if (conversation.aiState === "stay" && isMoneyRequest(body)) return handOff("money");
```

- [ ] **Step 8: Add the stay-state prompt rule** — in `web/lib/chat/context.ts`, directly after the existing line

```typescript
  if (!settings.switches.take_booking_requests) rules.push(`Do not take or encourage a booking request; ${declineRule}`);
```

add:

```typescript
  if (inStay) {
    rules.push(
      'The guest is staying: refunds, cancellations and any new or extra charge are the host\'s to handle — call `respond` with escalate: true and escalation_reason: "money".',
    );
  }
```

- [ ] **Step 9: Run to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 lib/chat`
Expected: PASS — the 4 new agent tests, `money.test.ts`, and every existing chat test (`context`, `tools`, `test-chat`, `conversations`, language, capabilities) unchanged.

- [ ] **Step 10: Commit**

```bash
git add web/lib/chat/money.ts web/lib/chat/money.test.ts web/lib/chat/agent.ts web/lib/chat/context.ts web/lib/chat/agent.test.ts
git commit -m "feat: the AI resumes in stay state and hands refund/charge questions to the host"
```

---

### Task 3: Status-aware booking actions (Server Actions and UI)

**Files:**
- Modify: `web/app/dashboard/bookings/actions.ts`, `web/app/dashboard/bookings/[id]/booking-actions.tsx`, `web/app/dashboard/bookings/[id]/page.tsx`, `web/app/dashboard/bookings/[id]/booking-actions.test.tsx`, `web/app/dashboard/bookings/bookings.integration.test.ts`

**Interfaces:**
- Consumes: `markBookingPaid`, `checkInBooking`, `checkOutBooking`, `approveBooking`, `rejectBooking`, `DecisionResult`, `BookingStatus` (Task 1 / M10).
- Produces: `markPaidAction(id)`, `checkInAction(id)`, `checkOutAction(id)` — each `Promise<{ error: string | null }>`; `<BookingActions bookingId status />`.

- [ ] **Step 1: Write the failing component tests** — replace the contents of `web/app/dashboard/bookings/[id]/booking-actions.test.tsx`

```tsx
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookingActions } from "./booking-actions";
import * as actions from "../actions";

vi.mock("../actions", () => ({
  approveBookingAction: vi.fn(),
  rejectBookingAction: vi.fn(),
  markPaidAction: vi.fn(),
  checkInAction: vi.fn(),
  checkOutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const approve = vi.mocked(actions.approveBookingAction);
const reject = vi.mocked(actions.rejectBookingAction);
const paid = vi.mocked(actions.markPaidAction);
const checkIn = vi.mocked(actions.checkInAction);
const checkOut = vi.mocked(actions.checkOutAction);

describe("BookingActions", () => {
  beforeEach(() => { for (const fn of [approve, reject, paid, checkIn, checkOut]) fn.mockReset(); });

  // @req BOOK-05
  test("a requested booking offers approve and reject; approving confirms first, then calls the action", async () => {
    approve.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="requested" />);
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(screen.getByText(/lock these dates/i)).toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("b1"));
  });

  // @req BOOK-05
  test("rejecting also confirms first", async () => {
    reject.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm rejection/i }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith("b1"));
  });

  test("cancelling the confirmation does nothing", () => {
    render(<BookingActions bookingId="b1" status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(approve).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
  });

  test("a server error is shown and the buttons come back", async () => {
    approve.mockResolvedValue({ error: "Those dates were just taken by another booking." });
    render(<BookingActions bookingId="b1" status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));
    expect(await screen.findByText(/just taken/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeEnabled();
  });

  // @req PAY-01
  test("an approved booking offers 'Mark payment received', and says the AI resumes", async () => {
    paid.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="approved" />);
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mark payment received/i }));
    expect(screen.getByText(/AI resumes/i)).toBeInTheDocument();
    expect(paid).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm payment received/i }));
    await waitFor(() => expect(paid).toHaveBeenCalledWith("b1"));
  });

  // @req PAY-06
  test("a paid booking offers check-in; a staying booking offers check-out", async () => {
    checkIn.mockResolvedValue({ error: null });
    const first = render(<BookingActions bookingId="b1" status="paid" />);
    fireEvent.click(screen.getByRole("button", { name: /^check in$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm check-in/i }));
    await waitFor(() => expect(checkIn).toHaveBeenCalledWith("b1"));
    first.unmount();

    checkOut.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="staying" />);
    expect(screen.queryByRole("button", { name: /^check in$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^check out$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm check-out/i }));
    await waitFor(() => expect(checkOut).toHaveBeenCalledWith("b1"));
  });

  // @req PAY-06
  test("a finished or declined booking offers nothing", () => {
    for (const status of ["checked_out", "rejected"] as const) {
      const { container, unmount } = render(<BookingActions bookingId="b1" status={status} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run --maxWorkers=1 "bookings/\[id\]/booking-actions" ` (if the bracket path filter matches nothing, use `booking-actions`).
Expected: FAIL — `BookingActions` takes no `status`, and `markPaidAction`/`checkInAction`/`checkOutAction` don't exist.

- [ ] **Step 3: Implement the Server Actions** — replace `web/app/dashboard/bookings/actions.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";
import {
  approveBooking, checkInBooking, checkOutBooking, markBookingPaid, rejectBooking, type DecisionResult,
} from "@/lib/bookings/host";
import { revalidatePublicPages } from "@/lib/public/revalidate";
import { dashboardContext } from "../_lib/context";

const MESSAGE: Record<Exclude<DecisionResult, { ok: true }>["reason"], string> = {
  not_found: "Booking not found.",
  already_handled: "This booking has already moved on. Refresh to see where it is now.",
  dates_taken: "Those dates were just taken by another booking. You can reject this request instead.",
};

type Result = { error: string | null };

// Every action re-derives the host from the request (dashboardContext) and
// runs through the caller's own RLS client — the functions are security
// invoker, so a booking in another organisation resolves to "not found".
async function decide(
  run: (supabase: Awaited<ReturnType<typeof dashboardContext>>["supabase"]) => Promise<DecisionResult>,
  after?: (organizationSlug: string) => void,
): Promise<Result> {
  const { supabase, organization } = await dashboardContext();
  const result = await run(supabase);
  if (!result.ok) return { error: MESSAGE[result.reason] };
  revalidatePath("/dashboard", "layout");
  after?.(organization.slug);
  return { error: null };
}

export async function approveBookingAction(bookingId: string): Promise<Result> {
  // Approval locks dates: the public stay picker's cached availability (1h)
  // must reflect the new block immediately.
  return decide((s) => approveBooking(s, String(bookingId)), revalidatePublicPages);
}

export async function rejectBookingAction(bookingId: string): Promise<Result> {
  return decide((s) => rejectBooking(s, String(bookingId)));
}

export async function markPaidAction(bookingId: string): Promise<Result> {
  return decide((s) => markBookingPaid(s, String(bookingId)));
}

export async function checkInAction(bookingId: string): Promise<Result> {
  return decide((s) => checkInBooking(s, String(bookingId)));
}

export async function checkOutAction(bookingId: string): Promise<Result> {
  return decide((s) => checkOutBooking(s, String(bookingId)));
}
```

- [ ] **Step 4: Implement the status-aware component** — replace `web/app/dashboard/bookings/[id]/booking-actions.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { BookingStatus } from "@/lib/bookings/host";
import { approveBookingAction, checkInAction, checkOutAction, markPaidAction, rejectBookingAction } from "../actions";

type ActionKey = "approve" | "reject" | "paid" | "checkin" | "checkout";
type Result = { error: string | null };

// Every step confirms first, and the confirmation says what will happen.
const ACTIONS: Record<ActionKey, { label: string; confirmLabel: string; text: string; run: (id: string) => Promise<Result> }> = {
  approve: {
    label: "Approve",
    confirmLabel: "Confirm approval",
    text: "Approve and lock these dates? The AI will go quiet in this chat and the guest will see your payment details.",
    run: approveBookingAction,
  },
  reject: {
    label: "Reject",
    confirmLabel: "Confirm rejection",
    text: "Reject this request? The guest is told it wasn't accepted and the calendar stays as it is.",
    run: rejectBookingAction,
  },
  paid: {
    label: "Mark payment received",
    confirmLabel: "Confirm payment received",
    text: "Mark payment received? The AI resumes in this chat and the guest is told they're confirmed.",
    run: markPaidAction,
  },
  checkin: {
    label: "Check in",
    confirmLabel: "Confirm check-in",
    text: "Mark this guest as checked in?",
    run: checkInAction,
  },
  checkout: {
    label: "Check out",
    confirmLabel: "Confirm check-out",
    text: "Mark this guest as checked out? This completes the stay.",
    run: checkOutAction,
  },
};

// The next step(s) at each stage of the pipeline; the first is the primary action.
const AVAILABLE: Partial<Record<BookingStatus, ActionKey[]>> = {
  requested: ["approve", "reject"],
  approved: ["paid"],
  paid: ["checkin"],
  staying: ["checkout"],
};

export function BookingActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = AVAILABLE[status];
  if (!available) return null;

  function run(key: ActionKey) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await ACTIONS[key].run(bookingId);
        if (result.error) { setError(result.error); setConfirming(null); return; }
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
        setConfirming(null);
      }
    });
  }

  if (confirming) {
    const action = ACTIONS[confirming];
    return (
      <div className="booking-confirm" role="group" aria-label="Confirm">
        <p>{action.text}</p>
        <div className="booking-confirm-actions">
          <Button type="button" variant={confirming === "reject" ? "secondary" : "primary"} disabled={pending} onClick={() => run(confirming)}>
            {pending ? "Working…" : action.confirmLabel}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-actions">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="booking-confirm-actions">
        {available.map((key, index) => (
          <Button key={key} type="button" variant={index === 0 ? "primary" : "secondary"} onClick={() => setConfirming(key)}>
            {ACTIONS[key].label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Pass the status from the detail page** — in `web/app/dashboard/bookings/[id]/page.tsx` replace

```tsx
        {booking.status === "requested" && <BookingActions bookingId={booking.id} />}
```

with

```tsx
        <BookingActions bookingId={booking.id} status={booking.status} />
```

- [ ] **Step 6: Extend the integration test** — append to `web/app/dashboard/bookings/bookings.integration.test.ts` (imports at the top gain `markPaidAction, checkInAction, checkOutAction` from `./actions`)

```typescript
// @req PAY-01
// @req PAY-06
test("the full pipeline through the real Server Actions: approve -> paid -> check in -> check out", async () => {
  const { host, service, propertyId } = fixture;
  const { bookingId, conversationId } = await insertRequestedBooking(service, {
    propertyId, organizationId: host.organizationId, start: addDays(START, 40), end: addDays(START, 43),
  });
  const status = async () => (await service.from("bookings").select("status").eq("id", bookingId).single()).data!.status;

  expect((await markPaidAction(bookingId)).error).toMatch(/already moved on/i); // not approved yet
  expect(await approveBookingAction(bookingId)).toEqual({ error: null });
  expect(await markPaidAction(bookingId)).toEqual({ error: null });
  expect(await status()).toBe("paid");
  const { data: conversation } = await service.from("conversations").select("ai_state").eq("id", conversationId!).single();
  expect(conversation!.ai_state).toBe("stay");

  expect((await checkOutAction(bookingId)).error).toMatch(/already moved on/i); // premature
  expect(await checkInAction(bookingId)).toEqual({ error: null });
  expect(await status()).toBe("staying");
  expect(await checkOutAction(bookingId)).toEqual({ error: null });
  expect(await status()).toBe("checked_out");
  expect((await checkInAction("00000000-0000-0000-0000-000000000000")).error).toMatch(/not found/i);
});
```

Also change the existing import line to `import { approveBookingAction, checkInAction, checkOutAction, markPaidAction, rejectBookingAction } from "./actions";`. The existing assertion `expect((await approveBookingAction(a.bookingId)).error).toMatch(/already/i)` still matches the new message.

- [ ] **Step 7: Run to verify they pass**

Run: `cd web && npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 app/dashboard`
Expected: PASS — the status-aware component tests, the extended integration test, and every existing dashboard test (inbox, nav, home, settings, bookings view).

- [ ] **Step 8: Commit**

```bash
git add web/app/dashboard/bookings
git commit -m "feat: status-aware booking actions — mark paid, check in, check out"
```

---

### Task 4: Gates, browser walk, tracker

**Files:** `docs/TRACKER.md` (regenerated). No other new code.

- [ ] **Step 1: Lint, full web suite, scripts**

```bash
cd web && npm run lint && npx vitest run --maxWorkers=1 --testTimeout=120000 --hookTimeout=120000 && cd .. && npm run test:scripts
```
Expected: all green. A `beforeAll` timeout means re-run that file alone with the flags above before suspecting a regression.

- [ ] **Step 2: Audit (gate stays M10) and tracker**

Run: `npm run audit -- --milestone M10`. Expected: passes; `grep -E "PAY-0" docs/TRACKER.md` shows `PAY-01 … PAY-06` all `done`. If one is `todo`, find the test that actually proves it and add its `// @req PAY-xx` line (one per ID) — never edit the auditor. Mapping: PAY-01/02/03 `stay.test.ts` + integration + `booking-actions.test.tsx`; PAY-03 also the stay-write test; PAY-04/05 `agent.test.ts`; PAY-06 `stay.test.ts` + integration + component test.

- [ ] **Step 3: Build and token grep**

```bash
cd web && npm run build
cd .. && MISSING=""; for u in '.bg-accent' '.bg-surface' '.hover\:bg-surface-muted' '.text-ink' '.text-accent-contrast' '.border-hairline' '.rounded-pill'; do grep -qF "$u" web/.next/static/chunks/*.css || MISSING="$MISSING $u"; done; echo "missing:[$MISSING]"
```
Expected: build succeeds; `missing:[]`.

- [ ] **Step 4: Browser walk on a production build** (`npm run build` then `npm run start -- -p 3100` from `web/`, not `next dev`)

Seed a throwaway host + published property (a script run once and deleted; credentials to a temp file, never printed). Then at 1440px and a phone width (a single same-origin iframe via `javascript_tool`; the Chrome window won't shrink and multi-iframe capture freezes the renderer): guest submits a request on the public page → host approves → **Mark payment received** shows the confirmation text, then the badge reads *Paid* and the primary action becomes **Check in** → the guest's `/c/<token>` card reads "Payment received" and the chat shows the acknowledgement → in that chat a guest message "How do I use the geyser?" gets an AI reply, while "I want a refund" gets the holding message and the conversation shows as escalated in the host inbox → **Check in** → badge *Staying* → **Check out** → badge *Checked out*, no actions left. Verify the DB after the walk (`ai_state = 'stay'`, statuses). Check the console for app errors (ignore the `cz-shortcut-listen` Chrome-extension hydration warning). Fix any visual roughness in the changed screens (booking detail actions, badges) before merging; confirm the mobile bottom bar still fits six tabs.

- [ ] **Step 5: Commit the tracker**

```bash
git add docs/TRACKER.md
git commit -m "chore: M11a tracker coverage — PAY-01..06 done"
```

---

## Milestone finish

1. **Final whole-branch review.** Emphasis:
   - Can any path write an `ai` message into a `payment` conversation? (Only `approve_booking`, before the flip; `mark_booking_paid` writes after the flip into `stay`.)
   - Can a host affect another org's booking, or anon call any of the three functions? (RLS + revoked execute; `stay.test.ts` proves it — also confirm none is `security definer`.)
   - Can a refund/charge question reach the model in stay state? (The pre-check runs before `buildContext`/`runModel`; only the matcher's narrowness is the risk — review the pattern list for both false negatives and false positives.)
   - Does anything other than `mark_booking_paid` set `ai_state` to `stay`? (`grep -rn "ai_state" web/lib web/app --include=*.ts --include=*.tsx | grep -v test`.)
2. **Delete the merged worktree directory before the final audit**, then re-run the full `ci.yml` sequence on the merged tree (gate `--milestone M10`).
3. Merge to `main`; `npx supabase db push --dry-run` (only `20261003020000_m11a_payment_stay.sql` pending) then `npx supabase db push`; push `main`; watch CI to green; curl the live `/dashboard/bookings` (expect 307 → `/login`, not 500).
4. Update the `milestone-progress` memory with what M11a shipped and note that M11b (CNIC, `CNIC-01 … CNIC-15`) is next and is where the audit gate moves to M11.
