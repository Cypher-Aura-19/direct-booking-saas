# Phase 1 Sprint Roadmap — Direct Booking Platform

| | |
|---|---|
| **Date** | 2026-09-16 (revised same day: team changed from 2 people to solo) |
| **Team** | 1 person, full-stack |
| **Sprint length** | 1 week |
| **Total sprints** | 10 (Sprints 1–10), plus Sprint 0 already complete |
| **Source proposal** | `direct-booking-saas-proposal.md`, §7 Phase 1 feature list |
| **Source schema** | `docs/superpowers/specs/2026-09-15-database-schema-design.md` |

## Revision note

This roadmap originally planned 5 sprints for a 2-person team (parallel backend/frontend work each week). The team is now solo, which roughly halves weekly capacity — no more building the server side and the UI side of a feature at the same time. Rather than stretch each of the original 5 sprints to 2 weeks, the same total scope is now split into 10 one-week sprints, each a **single vertical feature slice** (server + UI together, since one person builds both anyway — there's no backend/frontend split left to preserve). Total Phase 1 timeline is roughly the same either way (~9–10 weeks); this version keeps sprints small and each one finishable in a week, which matters more for solo momentum than hitting an arbitrary 5-sprint number.

## How this is organized

Same principle as before: every sprint ships something you could actually click through end to end, not a layer (“just the API” or “just the UI”) with nothing to show for it.

---

## Sprint 0 — Database schema ✅ Already complete

Unchanged from the original plan. All 10 Phase 1 tables, constraints (including the AI payment-state safety constraint and the double-booking exclusion constraint), and Row-Level Security are implemented, tested (60 pgTAP assertions), and pushed to GitHub.

---

## Sprint 1 (Week 1) — Foundation & Auth

**Goal:** The app exists, talks to Supabase, and a host can sign up, log in, and log out.

- Scaffold the Next.js app, connect it to the existing local Supabase project
- Supabase Auth: signup/login/logout pages, session-refresh middleware

**Already planned in detail:** this is Tasks 1–3 of `docs/superpowers/plans/implementation/2026-09-16-sprint-1-foundation-onboarding.md` (that plan was written for the old 2-person Sprint 1; it splits cleanly at the Task 3/4 boundary into this sprint and the next one — no need to rewrite it).

**End-of-sprint demo:** Sign up, get redirected into the app, log out, log back in.

---

## Sprint 2 (Week 2) — Host Organization & Property CRUD

**Goal:** A host can create their organization and add/edit a property with its full AI knowledge base.

- Organization creation (onboarding form + server action)
- Dashboard shell with the auth/onboarding guard chain
- Property creation form and the full knowledge-base edit page
- RLS cross-tenant regression test (proving the app respects Sprint 0's access control, not just the raw database)
- Deployment prep (env var docs, Vercel checklist)

**Already planned in detail:** Tasks 4–8 of the same `sprint-1-foundation-onboarding.md` plan.

**End-of-sprint demo:** Full loop — sign up → create org → create a property → fill in its knowledge base → log out → log back in → it's all still there.

---

## Sprint 3 (Week 3) — Public Catalogue

**Goal:** Anyone (no login) can browse a host's published properties on their phone.

- Photo upload to Supabase Storage, image compression/resizing
- Public host catalogue page (`stay.ourapp.com/{org_slug}`)
- Public property page: photos, price, amenities, host profile — mobile-first, since nearly all real traffic is an Instagram bio tap on a phone
- Host-side photo manager (upload, reorder, delete)

Public reads hit Sprint 0's public RLS policies directly via the anon key — no server route needed for this part, which keeps this sprint mostly UI + storage work.

**End-of-sprint demo:** Publish a property, open its public URL in an incognito/mobile browser, see real photos and details with no login.

---

## Sprint 4 (Week 4) — Availability & Pricing

**Goal:** The calendar on the public property page is real and live, not a mockup.

- Host date-blocking UI + backend (writes to `availability_blocks`)
- Seasonal pricing CRUD (host-side)
- Live calendar rendered on the public property page from Sprint 3, reflecting real blocks and seasonal rates

**End-of-sprint demo:** Block a date range as the host, refresh the public property page, see those dates correctly marked unavailable.

---

## Sprint 5 (Week 5) — AI Agent & Guest Chat

**Goal:** A guest can chat with the AI about a property and get a correct, property-specific answer.

- LLM integration (Gemini Flash or DeepSeek), prompt built from a single property's full row (the "whole row is the knowledge base" design decision from Sprint 0)
- Guest-facing chat widget on the property page
- Guest actions (start conversation, send message) implemented as server routes using the **service role** key — guests never get a Supabase session, per Sprint 0's RLS design
- Escalation logic: AI detects "I don't know" or an explicit request for a human, flips `ai_enabled=false, ai_disabled_reason='escalation'`

**End-of-sprint demo:** Ask the AI a real question (English, Urdu, or Roman Urdu) about a live property and get a correct answer sourced only from that property's data.

---

## Sprint 6 (Week 6) — Host Inbox

**Goal:** The host can watch every AI conversation live and take over any one of them.

- Conversation list + live message view via Supabase Realtime
- Per-chat AI on/off toggle
- Visual AI-vs-host message labelling, unread counts, escalation alerts

**End-of-sprint demo:** Message the AI as a guest in one browser tab, watch it appear live in the host inbox in another, take over the chat, hand it back.

---

## Sprint 7 (Week 7) — Booking Request & Approval

**Goal:** A guest can request a booking, and approving it correctly locks the calendar and silences the AI.

- Guest booking request UI + backend (server-computed price from rate + any seasonal rule)
- Host approve/reject UI
- On approval: create the `availability_blocks` row, flip the conversation to `ai_state='payment'` — Sprint 0's database constraint guarantees the AI can't stay active through this transition

**End-of-sprint demo:** Request a booking as a guest, approve it as the host, watch the AI go visibly silent in that conversation and the calendar lock those dates.

---

## Sprint 8 (Week 8) — Payment Confirmation & Hotel Eye

**Goal:** The full booking lifecycle closes out, including the legally-required CNIC capture.

- "Mark payment received" host action: booking → `paid`/`staying`, conversation → `ai_state='stay'` (AI resumes for check-in questions)
- Booking status pipeline view (requested/approved/paid/staying/checked-out) on the host dashboard
- CNIC/passport upload (guest-facing, private storage) + host document view + CSV export

**End-of-sprint demo:** Mark a booking paid, watch the AI come back for check-in questions, upload a CNIC as the guest, see it show up cleanly in the host's dashboard.

---

## Sprint 9 (Week 9) — Trust Features & Hardening

**Goal:** The product looks and behaves like something worth trusting with money and ID documents.

- Airbnb badge verification flow (temp-code check against the host's Airbnb listing description)
- Trust polish: host profile display, cancellation/refund terms shown before booking
- Retention/deletion scheduled job for `guest_documents` past `retention_expires_at`
- Security pass: confirm signed URLs are short-lived, confirm the service-role key is never exposed client-side, review RLS policies against real usage
- Mobile performance pass (lazy-loading, Lighthouse audit on a slow-connection profile)

**End-of-sprint demo:** A verified Airbnb badge shows correctly on a property that has one; a Lighthouse mobile audit comes back clean.

---

## Sprint 10 (Week 10) — Production Launch

**Goal:** The product exists somewhere real, not just on a laptop.

- Hosted Supabase project setup (`supabase link` + `supabase db push` to move Sprint 0's schema off local Docker)
- Production Vercel deploy with real environment variables
- Full cold-start smoke test on the production URL: new host signs up, sets up a property, gets a real guest booking through chat, collects payment and CNIC — nothing mocked
- Bug bash buffer

**End-of-sprint demo:** The walkthrough above, done live on the actual production URL.

---

## What's deliberately excluded from these 10 sprints

Unchanged from the original roadmap: reviews, upsells, repeat-guest tooling, analytics, Airbnb iCal sync, team accounts, WhatsApp Business API, and any Airbnb inbox/account integration are all Phase 2/3, deferred by design.

## Before Sprint 1 starts

Also unchanged: the proposal's own validation step (§11 — talking to 10–15 real operators, one week, no code) should gate Sprint 1 if it hasn't happened yet, not run in parallel with it.
