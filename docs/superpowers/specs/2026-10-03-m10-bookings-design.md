# M10 Booking Request and Approval — Design

| | |
|---|---|
| **Status** | Design approved 2026-10-03, pending implementation plan |
| **Milestone** | M10 (BOOK-01 … BOOK-12) |
| **Parent spec** | `2026-09-20-phase-1-design.md` (pages, payment-state rules, D-09) |
| **Builds on** | M2 (`bookings`, `availability_blocks`, payment-state trigger), M6 (`quoteStay`), M7 (guest chat), M9 (inbox) |

## Goal

A guest picks dates on a public property page, sees the live price, and submits a booking request with their name and phone. The host sees the request, approves or rejects it. Approval locks the dates, moves the conversation into the `payment` state (the AI goes structurally silent), and shows the guest the host's payment instructions. Rejection changes nothing on the calendar.

Out of scope (M11): mark paid, check in, check out, CNIC capture, the `stay` transition. M10 only *displays* those pipeline stages. Also out of scope: taking payment, guest-initiated cancellation, email alerts.

## Decisions

| # | Decision | Why |
|---|---|---|
| M10-1 | Guests submit through a **request form on the stay picker**, not through the AI | A model must never control a booking write, and free-text name/phone collection is error-prone. The AI keeps answering questions and can point to the form. |
| M10-2 | Approval is **one Postgres function** (`approve_booking`), a single transaction | Block + status + conversation state + acknowledgement succeed or fail together. A crash can't leave dates locked with the AI still talking. |
| M10-3 | A `requested` booking **holds no dates** | Per the parent spec, approval creates the block. Overlapping requests are allowed; the exclusion constraint arbitrates at approval. |
| M10-4 | The acknowledgement is a **fixed template**, inserted as the last `ai`-labelled message **before** the state flips to `payment` | The M2 trigger forbids AI messages *while in* `payment`; inserting first keeps that trigger fully intact and un-bypassed. It is not model output. |
| M10-5 | **One open request per conversation**, and a request is only accepted on a conversation still in `enquiry`; otherwise a fresh conversation is started | Spam guard, and the forward-only state machine (`payment`/`stay` can't go back) can't be tripped. |
| M10-6 | **Advance percentage stays per-property** (M6) | The parent spec lists it on the payment settings page, but M6 already stores it per property. Duplicating it would create two sources of truth. The payment page holds only instructions. |
| M10-7 | **Price is always recomputed server-side** with `quoteStay` against live blocks and a server-computed `today` | BOOK-04. Client-sent price/dates-validity are ignored. |

## Data model — migration `20261003010000_m10_bookings.sql`

- `bookings.block_id uuid references availability_blocks(id) on delete set null` — the lock created at approval.
- Partial unique index `bookings_one_open_per_conversation` on `bookings(conversation_id) where status in ('requested','approved')`.
- `public.approve_booking(booking_id uuid) returns void` — `security invoker` (RLS via `owns_property` still applies), plpgsql:
  1. `select … for update` the booking; raise unless it exists and `status = 'requested'`.
  2. Insert `availability_blocks (reason = 'booking')`; an overlap raises SQLSTATE `23P01`, aborting everything.
  3. Set the booking to `approved` and store `block_id`.
  4. If it has a conversation: insert the acknowledgement message (`sender = 'ai'`), **then** set `ai_state = 'payment'`.
- `public.reject_booking(booking_id uuid) returns void` — sets `rejected` only if currently `requested`; touches nothing else (BOOK-10).
- Both functions: `revoke execute … from public, anon; grant execute … to authenticated` (the Supabase anon-by-name gotcha).
- **No new RLS policy, no anon grant.** `bookings`/`guests` stay zero-grant for anon; every guest-side read/write goes through server code with the service-role client, exactly like M7.

## Library — `web/lib/bookings/`

- `requests.ts` — `parseBookingRequest(input)` (name 1–80 chars; phone 7–15 digits with optional leading `+`; dates are `YYYY-MM-DD`); `createBookingRequest(service, { propertyId, token | null, name, phone, checkIn, checkOut, today })` → loads the property's live blocks/rules, runs `quoteStay`, returns a typed rejection (`unavailable`, `min_stay` with the required nights, `invalid`) or inserts guest + booking and returns `{ bookingId, token }`. Reuses the caller's chat token if it resolves to an `enquiry` conversation on that property, else starts a new conversation.
- `host.ts` — `listBookings(supabase, orgId, { status? })`, `getBooking(supabase, id)`, `approveBooking(supabase, id)` / `rejectBooking(supabase, id)` (map `23P01` → "Those dates were just taken by another booking").
- `guest.ts` — `getGuestBookingView(service, token)`: status, dates, total, advance amount, and — **only when `approved`** — the org's payment instructions.
- `payment-instructions.ts` — parse/validate the org's bank / Easypaisa / JazzCash fields (`organizations.payment_instructions` jsonb already exists).

## UI (existing tokens, pills, two-pane patterns — no new visual language)

| Surface | Change |
|---|---|
| Stay picker (`/s/[org]/[property]`) | After a quote: name + phone + **Request to book**; success state; WhatsApp stays as secondary. Inline typed errors for unavailable / min-stay. |
| `/dashboard/bookings` | Five-stage pipeline (requested, approved, paid, staying, checked out) with status filter and designed empty state. M10 acts only on `requested`. |
| `/dashboard/bookings/[id]` | Guest, dates, server-computed price, link to the conversation, **Approve** / **Reject** with confirm. |
| Inbox conversation (M9) | Booking card pinned at the top. |
| `/dashboard/settings/payment` | Payment instructions form. |
| Dashboard nav + home | Bookings nav item (desktop + mobile bar); "Waiting booking requests" row links to `/dashboard/bookings?status=requested`. |
| `/c/[token]` | Booking status card: requested → approved (+ payment instructions and advance) → declined. |

Mobile: single-pane behaviour as M9; the booking list rows stack, actions are full-width on narrow screens.

## Error handling

- Unavailable / min-stay / invalid input → typed errors, never a 500; nothing is written.
- Approve on a stale or already-decided booking → "This request was already handled."
- Approve when the dates were taken → constraint abort, booking stays `requested`, clear message; the host can reject it.
- Service-role key stays server-only; the guest view never returns another conversation's data (token-scoped).

## Requirement coverage

| ID | Proof |
|---|---|
| BOOK-01 | `createBookingRequest` inserts a `requested` booking for a valid range |
| BOOK-02 | rejected on overlap with an existing block |
| BOOK-03 | rejected below the minimum stay (incl. seasonal override) |
| BOOK-04 | stored total equals `quoteStay`; a tampered client price is ignored |
| BOOK-05 | host lists pending requests; approve and reject actions via RLS client; cross-org denied |
| BOOK-06 | approval inserts the `booking` block for exactly `[start,end)` |
| BOOK-07 | approval sets `ai_state = 'payment'` |
| BOOK-08 | exactly one acknowledgement message; a second approve attempt adds none |
| BOOK-09 | after approval, inserting an `ai` message directly fails (trigger) |
| BOOK-10 | reject leaves `availability_blocks` and conversation state untouched |
| BOOK-11 | pipeline component renders all five stages |
| BOOK-12 | guest view includes payment instructions only when approved |

Plus: overlapping double-approval (second fails cleanly), one-open-per-conversation, anon cannot read/write `bookings`/`guests` or call the functions, and a component test per new screen. Real local Supabase, no mocks; one `// @req` line per ID.

## Delivery constraints (carried from earlier milestones)

Run the full `ci.yml` sequence locally before any push (lint, `npm test`, audit `--milestone M10`, tracker diff, build, token grep); bump CI's audit gate M9 → M10; apply the migration locally with `supabase db reset`; delete merged worktrees before the final audit; `supabase db push` and curl the live routes at the end; browser-walk at 1440px and a phone width.
