# Phase 1 Sprint Roadmap — Direct Booking Platform

| | |
|---|---|
| **Date** | 2026-09-16 (revised same day: team changed from 2 people → solo → AI-executed) |
| **Executor** | Claude (this agent), same task-by-task/TDD approach used for Sprint 0 |
| **Sprint length** | 1 working day per sprint |
| **Total sprints** | 10 (Sprints 1–10 = 10 working days / ~2 calendar weeks), plus Sprint 0 already complete |
| **Source proposal** | `direct-booking-saas-proposal.md`, §7 Phase 1 feature list |
| **Source schema** | `docs/superpowers/specs/2026-09-15-database-schema-design.md` |

## Revision history

1. **Original:** 5 sprints, 1 week each, 2-person team (parallel backend/frontend work).
2. **Revision 1 (solo):** team dropped to 1 person, which roughly halves weekly capacity. Split the same scope into 10 one-week sprints, each a single vertical feature slice (server + UI together, since one person builds both anyway).
3. **Revision 2 (this one — AI-executed):** the person is no longer doing the implementation work by hand — Claude is, the same way Sprint 0's database layer was actually built (task-by-task, TDD, real local Supabase, committed as it goes). Human-week estimates don't apply to that execution mode. **Each of the 10 sprints from Revision 1 becomes one working day** — same scope, same order, same demo criteria per sprint, just executed at agent pace instead of human coding pace. Total Phase 1: **10 working days**, not 10 weeks.

## How this is organized

Same principle as before: every sprint ships something that actually works end to end, not a layer (“just the API” or “just the UI”) with nothing to show for it. Before finalizing this revision, five technical unknowns were researched rather than assumed — findings below feed directly into the affected sprints.

## Research findings behind this plan

| Question | Finding | Affects |
|---|---|---|
| Is the `@supabase/ssr` cookie pattern (`getAll`/`setAll`) used in the already-written Sprint 1 auth code still current? | Yes — confirmed current as of Sep 2026 via Supabase's own docs. No changes needed to the existing plan. | Sprint 1 |
| Best way to serve property photos efficiently? | Supabase Storage has built-in image transformation (resize/quality via URL params), usable as a custom `next/image` loader — no separate compression pipeline needed. | Sprint 3 |
| Which LLM: Gemini Flash or DeepSeek? | Gemini Flash: $0.75/$3.75 per 1M input/output tokens (promo through end of 2026). DeepSeek Flash is far cheaper (~$0.003–0.3 in / $0.6–1.2 out per 1M) but its tokenizer is optimized for English/Chinese, not South Asian languages. Given the proposal's own "cost isn't the constraint" framing and the hard requirement for solid Urdu/Roman Urdu, **Gemini Flash is primary**; DeepSeek stays as a documented cost-fallback, not the default. | Sprint 5 |
| Any gotchas with Supabase Realtime for the live host inbox? | Yes — a documented timing gap between a client reporting `SUBSCRIBED` and the backend replication listener being ready; a message sent in that gap can be missed. The inbox must fetch existing messages *after* subscribing (or reconcile on load), not assume subscribe-then-fetch is gap-free. | Sprint 6 |
| Does Hotel Eye (hoteleye.punjab.gov.pk) have a public API to submit guest records automatically? | No official API confirmed (PITB/Punjab Police sources). Third-party "auto-sync" tools exist but aren't official integrations. The proposal's original decision — prepare a clean record, host submits it manually — is correct and unchanged. | Sprint 8 |

---

## Sprint 0 — Database schema ✅ Already complete

Unchanged from the original plan. All 10 Phase 1 tables, constraints (including the AI payment-state safety constraint and the double-booking exclusion constraint), and Row-Level Security are implemented, tested (60 pgTAP assertions), and pushed to GitHub.

---

## Sprint 1 (Day 1) — Foundation & Auth

**Goal:** The app exists, talks to Supabase, and a host can sign up, log in, and log out.

- Scaffold the Next.js app, connect it to the existing local Supabase project
- Supabase Auth: signup/login/logout pages, session-refresh middleware

**Already planned in detail:** this is Tasks 1–3 of `docs/superpowers/plans/implementation/2026-09-16-sprint-1-foundation-onboarding.md` (that plan was written for the old 2-person Sprint 1; it splits cleanly at the Task 3/4 boundary into this sprint and the next one — no need to rewrite it).

**End-of-sprint demo:** Sign up, get redirected into the app, log out, log back in.

---

## Sprint 2 (Day 2) — Host Organization & Property CRUD

**Goal:** A host can create their organization and add/edit a property with its full AI knowledge base.

- Organization creation (onboarding form + server action)
- Dashboard shell with the auth/onboarding guard chain
- Property creation form and the full knowledge-base edit page
- RLS cross-tenant regression test (proving the app respects Sprint 0's access control, not just the raw database)
- Deployment prep (env var docs, Vercel checklist)

**Already planned in detail:** Tasks 4–8 of the same `sprint-1-foundation-onboarding.md` plan.

**End-of-sprint demo:** Full loop — sign up → create org → create a property → fill in its knowledge base → log out → log back in → it's all still there.

---

## Sprint 3 (Day 3) — Public Catalogue

**Goal:** Anyone (no login) can browse a host's published properties on their phone.

- Photo upload to Supabase Storage; serve via Supabase's built-in Storage image transformation (resize/quality via URL params) through a custom `next/image` loader — no separate compression library needed
- Public host catalogue page (`stay.ourapp.com/{org_slug}`)
- Public property page: photos, price, amenities, host profile — mobile-first, since nearly all real traffic is an Instagram bio tap on a phone
- Host-side photo manager (upload, reorder, delete)

Public reads hit Sprint 0's public RLS policies directly via the anon key — no server route needed for this part, which keeps this sprint mostly UI + storage work.

**End-of-sprint demo:** Publish a property, open its public URL in an incognito/mobile browser, see real photos and details with no login.

---

## Sprint 4 (Day 4) — Availability & Pricing

**Goal:** The calendar on the public property page is real and live, not a mockup.

- Host date-blocking UI + backend (writes to `availability_blocks`)
- Seasonal pricing CRUD (host-side)
- Live calendar rendered on the public property page from Sprint 3, reflecting real blocks and seasonal rates

**End-of-sprint demo:** Block a date range as the host, refresh the public property page, see those dates correctly marked unavailable.

---

## Sprint 5 (Day 5) — AI Agent & Guest Chat

**Goal:** A guest can chat with the AI about a property and get a correct, property-specific answer.

- LLM integration — **Gemini Flash primary** (better multilingual coverage for Urdu/Roman Urdu; DeepSeek documented as a cheaper fallback if cost ever becomes a real constraint), prompt built from a single property's full row (the "whole row is the knowledge base" design decision from Sprint 0)
- Guest-facing chat widget on the property page
- Guest actions (start conversation, send message) implemented as server routes using the **service role** key — guests never get a Supabase session, per Sprint 0's RLS design
- Escalation logic: AI detects "I don't know" or an explicit request for a human, flips `ai_enabled=false, ai_disabled_reason='escalation'`

**End-of-sprint demo:** Ask the AI a real question (English, Urdu, or Roman Urdu) about a live property and get a correct answer sourced only from that property's data.

---

## Sprint 6 (Day 6) — Host Inbox

**Goal:** The host can watch every AI conversation live and take over any one of them.

- Conversation list + live message view via Supabase Realtime — subscribe first, then fetch/reconcile existing messages, to close the documented `SUBSCRIBED`-vs-replication-ready timing gap that can otherwise drop a message sent right at page load
- Per-chat AI on/off toggle
- Visual AI-vs-host message labelling, unread counts, escalation alerts

**End-of-sprint demo:** Message the AI as a guest in one browser tab, watch it appear live in the host inbox in another, take over the chat, hand it back.

---

## Sprint 7 (Day 7) — Booking Request & Approval

**Goal:** A guest can request a booking, and approving it correctly locks the calendar and silences the AI.

- Guest booking request UI + backend (server-computed price from rate + any seasonal rule)
- Host approve/reject UI
- On approval: create the `availability_blocks` row, flip the conversation to `ai_state='payment'` — Sprint 0's database constraint guarantees the AI can't stay active through this transition

**End-of-sprint demo:** Request a booking as a guest, approve it as the host, watch the AI go visibly silent in that conversation and the calendar lock those dates.

---

## Sprint 8 (Day 8) — Payment Confirmation & Hotel Eye

**Goal:** The full booking lifecycle closes out, including the legally-required CNIC capture.

- "Mark payment received" host action: booking → `paid`/`staying`, conversation → `ai_state='stay'` (AI resumes for check-in questions)
- Booking status pipeline view (requested/approved/paid/staying/checked-out) on the host dashboard
- CNIC/passport upload (guest-facing, private storage) + host document view + CSV export — record preparation only; no portal auto-submission, since Hotel Eye has no public API (confirmed above)

**End-of-sprint demo:** Mark a booking paid, watch the AI come back for check-in questions, upload a CNIC as the guest, see it show up cleanly in the host's dashboard.

---

## Sprint 9 (Day 9) — Trust Features & Hardening

**Goal:** The product looks and behaves like something worth trusting with money and ID documents.

- Airbnb badge verification flow (temp-code check against the host's Airbnb listing description)
- Trust polish: host profile display, cancellation/refund terms shown before booking
- Retention/deletion scheduled job for `guest_documents` past `retention_expires_at`
- Security pass: confirm signed URLs are short-lived, confirm the service-role key is never exposed client-side, review RLS policies against real usage
- Mobile performance pass (lazy-loading, Lighthouse audit on a slow-connection profile)

**End-of-sprint demo:** A verified Airbnb badge shows correctly on a property that has one; a Lighthouse mobile audit comes back clean.

---

## Sprint 10 (Day 10) — Production Launch

**Goal:** The product exists somewhere real, not just on a laptop.

- Hosted Supabase project setup (`supabase link` + `supabase db push` to move Sprint 0's schema off local Docker)
- Production Vercel deploy with real environment variables
- Full cold-start smoke test on the production URL: new host signs up, sets up a property, gets a real guest booking through chat, collects payment and CNIC — nothing mocked
- Bug bash buffer

**End-of-sprint demo:** The walkthrough above, done live on the actual production URL.

**Note:** this sprint is the one exception to "Claude executes it" — creating the hosted Supabase project and running `vercel login`/first deploy both need your own account credentials. Claude prepares everything (migrations ready to push, env vars documented, deploy config committed) and can drive both CLIs once you've logged in, but the login step itself is yours to do.

---

## What's deliberately excluded from these 10 sprints

Unchanged from the original roadmap: reviews, upsells, repeat-guest tooling, analytics, Airbnb iCal sync, team accounts, WhatsApp Business API, and any Airbnb inbox/account integration are all Phase 2/3, deferred by design.

## Before Sprint 1 starts

Also unchanged: the proposal's own validation step (§11 — talking to 10–15 real operators, one week, no code) should gate Sprint 1 if it hasn't happened yet, not run in parallel with it.
