# M11a Payment, Stay and Check-in/out — Design

| | |
|---|---|
| **Status** | Design approved 2026-10-03, pending implementation plan |
| **Milestone** | M11a (PAY-01 … PAY-06). M11b (Hotel Eye / CNIC, CNIC-01 … CNIC-15) is a separate spec, plan and deploy that follows. |
| **Parent spec** | `2026-09-20-phase-1-design.md` (payment-state rules, stay state) |
| **Builds on** | M2 (forward-only `ai_state`, AI-in-payment trigger), M7 (guest turn), M8 (pre-check pattern), M10 (`approve_booking`, booking detail actions) |

## Goal

After approving a booking, the host marks payment received. The booking becomes `paid`, the conversation moves from `payment` to `stay`, and the AI resumes: it answers check-in and house questions again, but never discusses refunds or new charges. The host then marks check-in and check-out, moving the booking through `staying` to `checked_out`.

Out of scope (M11b): the ID-upload link, CNIC capture/storage, the Hotel Eye register, CSV export, retention and the deletion job. The "payment received" message will gain its upload link in M11b.

## Decisions

| # | Decision | Why |
|---|---|---|
| M11a-1 | `mark_booking_paid(id)` is **one `security invoker` Postgres function** in a single transaction | Same reasoning as `approve_booking` (M10-2): status, conversation state and the acknowledgement succeed or fail together; RLS (`owns_property`) still gates it because it runs as the host. |
| M11a-2 | The acknowledgement is a **fixed template** inserted as an `ai` message **after** the state flips to `stay` | `messages_forbid_ai_during_payment` only blocks AI messages while *in* `payment`, so this is permitted and the trigger stays untouched. Not model output. |
| M11a-3 | **Check-in / check-out only change the booking status** (`paid → staying → checked_out`); no date gating | Hosts decide in practice (early arrivals, late departures). The conversation stays in `stay` (terminal). |
| M11a-4 | **The AI resumes with no new agent logic** | `runGuestTurn` is already silent only in `payment` or when AI is off, and `buildContext` already unlocks wifi/gate codes for `aiState === "stay"`. M11a proves it with tests. |
| M11a-5 | **Refund / new-charge questions are caught deterministically in `stay` state**, before the model | Same slot and shape as the existing "ask for a person" check (AI-14): a keyword matcher hands off with reason `money` and the holding message, no model call. The prompt's existing "never discuss refunds" rule remains as a backstop. |
| M11a-6 | Wrong-order or repeated calls return `already_handled`, not an error page | Same typed-result pattern as `approveBooking`. |

## Data model — migration `20261003020000_m11a_payment_stay.sql`

No table or column changes. Three functions, all `security invoker`, `set search_path = public`, plpgsql:

- `mark_booking_paid(booking_id uuid) returns void`:
  1. `select … for update` the booking; `P0002` (not found / not visible) unless it exists.
  2. `55000` unless `status = 'approved'`.
  3. `update bookings set status = 'paid'`.
  4. If it has a conversation: `update conversations set ai_state = 'stay'`, **then** insert the template message (`sender = 'ai'`): *"Payment received — you're confirmed. Ask me anything about check-in or the house."*
- `check_in_booking(booking_id uuid)`: `paid → staying`; same error codes.
- `check_out_booking(booking_id uuid)`: `staying → checked_out`; same error codes.
- All three: `revoke execute … from public, anon; grant execute … to authenticated`.
- **No new RLS policy and no table grant change.**

## Library

- `web/lib/bookings/host.ts` (extend): `markBookingPaid`, `checkInBooking`, `checkOutBooking` → `DecisionResult` (`not_found` | `already_handled`), via the same `decision()` mapper.
- `web/lib/chat/money.ts` (new): `isMoneyRequest(text): boolean`. Matches refund / money back / reimburse / extra or additional or new charge(s) / overcharged / deposit / pay more / discount / cancel(lation). Deliberately narrow (a miss is caught by the prompt rule), mirroring `language.ts`'s `isHumanRequest`.
- `web/lib/chat/agent.ts`: after the human-request check, `if (conversation.aiState === "stay" && isMoneyRequest(body)) return handOff("money")`.
- `web/lib/chat/context.ts`: in stay state add one rule line reinforcing "refunds and new charges are the host's; escalate with reason money".

## UI (existing tokens/patterns)

- `bookings/[id]/booking-actions.tsx` becomes **status-aware**, driven by a small config: `requested` → Approve / Reject (unchanged); `approved` → **Mark payment received**; `paid` → **Check in**; `staying` → **Check out**; `checked_out` / `rejected` → none. Every action keeps the inline confirmation that says what will happen (e.g. "Mark payment received? The AI resumes in this chat and the guest is told they're confirmed.").
- `bookings/actions.ts`: `markPaidAction`, `checkInAction`, `checkOutAction` (same `{ error }` shape, `revalidatePath("/dashboard", "layout")`; no public-page revalidation — no availability change).
- The pipeline, status badges, inbox booking card and guest booking card already handle `paid` / `staying` / `checked_out`.

## Error handling

- Stale or repeated action → "This booking has already moved on." (`already_handled`); nothing is written twice and no second message is posted.
- A booking invisible to the caller (another org) → "Booking not found." (`not_found`).
- A function failure rolls the whole transaction back: no half-paid booking, no stray message.

## Requirement coverage

| ID | Proof |
|---|---|
| PAY-01 | `markBookingPaid` via the host's own RLS client; the Server Action end to end; another org denied; anon denied |
| PAY-02 | booking status is `paid` after the call |
| PAY-03 | conversation `ai_state` is `stay` after the call, and exactly one acknowledgement exists; a second call adds none |
| PAY-04 | `runGuestTurn` in a `stay` conversation calls the model and returns its reply, with wifi/gate details present in the prompt context |
| PAY-05 | stay-state refund / extra-charge phrasings hand off with reason `money` without calling the model; the same phrasing is not intercepted outside stay |
| PAY-06 | check-in then check-out move `paid → staying → checked_out`; wrong order and repeats return `already_handled`; the UI offers exactly the next step per status |

Plus: a booking with no conversation can still be marked paid; a full approve → paid → check-in → check-out walk in one test. Real local Supabase for `lib/`, scripted model for the agent (as in M7/M8), component tests for the status-aware actions. One `// @req` line per ID.

## Delivery constraints (carried from M9/M10)

Full `ci.yml` sequence locally on the merged tree before any push (lint, `npm test`, audit `--milestone M11`, tracker diff, build, token grep); bump CI's audit gate M10 → M11 **only when M11b also lands** — until then the gate stays at M10 and M11a's `PAY-*` rows are covered by the tracker without being gated; apply the migration locally with `supabase db reset`; delete merged worktrees before the final audit; `supabase db push` and curl the live routes; browser-walk on a **production build**. Use plain, separate git commands in worktree sessions.
