# Phase 1 Sprint Roadmap — Direct Booking Platform

| | |
|---|---|
| **Date** | 2026-09-16 |
| **Team** | 2 people, full-stack, working in parallel |
| **Sprint length** | 1 week |
| **Total sprints** | 5 (Sprints 1–5), plus Sprint 0 already complete |
| **Source proposal** | `direct-booking-saas-proposal.md`, §7 Phase 1 feature list |
| **Source schema** | `docs/superpowers/specs/2026-09-15-database-schema-design.md` |

## How this is organized

Each sprint is a **vertical, end-to-end slice** — not "backend week" then "frontend week." Every sprint ships something a host or guest could actually click through, with both people working full-stack in parallel on different parts of that slice. Roles below (Dev A / Dev B) are a suggested split, not a rigid assignment — swap as needed.

---

## Sprint 0 — Database schema ✅ Already complete

Not counted in the 5 sprints below since it's done. Recap: all 10 Phase 1 tables, constraints (including the AI payment-state safety constraint and the double-booking exclusion constraint), and Row-Level Security are implemented, tested (60 pgTAP assertions), and committed. This is a real head start — Sprint 1 starts with a working database, not a blank one.

---

## Sprint 1 (Week 1) — Foundation & Host Onboarding

**Goal:** A host can sign up, create their organization, and add a property with its full knowledge base. Nothing public-facing yet — this sprint is entirely the host side.

**Dev A (backend/infra):**
- Scaffold the Next.js app (App Router), connect it to the existing local Supabase project
- Supabase Auth wiring: host signup/login (email+password to start)
- Server actions/API routes for organization CRUD and property CRUD, using the authenticated user's session (so RLS from Sprint 0 does the access-control work — no separate authorization logic needed)
- Deploy pipeline: Vercel project connected to the repo, environment variables wired to Supabase

**Dev B (frontend):**
- Auth pages (signup/login/logout)
- "Create organization" onboarding form (name, slug, contact info)
- Property form covering all the knowledge-base fields from the schema (wifi, gate code, checkout time, etc.) — this is the biggest single form in the product, worth getting the UX right early
- Bare-bones host dashboard shell: list of the host's properties, nav structure that later sprints hang off of

**End-of-sprint demo:** A host signs up, creates an org, adds a property with a full knowledge base, and sees it listed in their dashboard.

---

## Sprint 2 (Week 2) — Public Catalogue & Availability

**Goal:** Anyone (no login) can browse a host's published properties and see a real, live availability calendar. Hosts can manage photos and block dates.

**Dev A (backend/infra):**
- Photo upload to Supabase Storage (`property_photos`), image compression/resizing pipeline
- Availability calendar logic: host date-blocking endpoint, booking-derived blocks (wired up now even though bookings don't exist until Sprint 4 — the `availability_blocks` table already supports both)
- Seasonal pricing CRUD (host-side)
- Public read endpoints for published properties/photos/availability/pricing — these hit the public RLS policies from Sprint 0 directly via the anon key, no server route needed

**Dev B (frontend):**
- Public host catalogue page (`stay.ourapp.com/{org_slug}`)
- Public property page: photos, price, amenities, live calendar — mobile-first, this is where nearly all real traffic lands (Instagram bio taps)
- Host-side photo manager (upload, reorder, delete) and availability/pricing management UI

**End-of-sprint demo:** A published property is browsable by an anonymous visitor on mobile, showing real photos and a real calendar reflecting host-set blocks.

---

## Sprint 3 (Week 3) — AI Agent, Guest Chat & Host Inbox

**Goal:** A guest can chat with the AI about a property; the host sees the conversation live and can take over.

**Dev A (backend/infra):**
- LLM integration (Gemini Flash or DeepSeek) — server route that builds the prompt from a single property's row (per the "whole row is the knowledge base" design decision), calls the model, writes to `messages`
- Guest-facing actions (start conversation, send message) implemented as Next.js server routes using the **service role** key, per the RLS design decision from Sprint 0 — guests never get a Supabase session
- Escalation logic: detect "I don't know" / guest asks for a human → flip `ai_enabled=false, ai_disabled_reason='escalation'`
- Supabase Realtime wiring for the `messages` table

**Dev B (frontend):**
- Guest-facing chat widget embedded on the property page
- Host inbox: conversation list, live message view (Realtime subscription), per-chat AI on/off toggle, visual AI-vs-host message labelling, unread counts and escalation alerts

**End-of-sprint demo:** A guest asks the AI a question about a live property (in English, Urdu, or Roman Urdu) and gets a correct, property-specific answer; the host watches it happen in real time and can jump into that one conversation.

---

## Sprint 4 (Week 4) — Booking Flow, Payment State Machine & Hotel Eye

**Goal:** The full booking lifecycle works end-to-end, including the money-safety AI state machine and CNIC capture.

**Dev A (backend/infra):**
- Booking request submission (guest, via service-role server route) with server-computed `total_price_pkr`/`advance_amount_pkr` from the property's rate + any matching seasonal rule
- Host approve/reject action: on approval, create the `availability_blocks` row and flip the conversation to `ai_state='payment'` (the database constraint from Sprint 0 guarantees the AI can't stay active through this transition)
- "Mark payment received" action: flips booking to `paid`/`staying`, conversation back to `ai_state='stay'`
- CNIC/passport upload to Supabase Storage (private bucket, signed URLs), `guest_documents` write with `retention_expires_at` set

**Dev B (frontend):**
- Guest booking flow UI: date selection against the live calendar, request submission, confirmation screen with check-in details
- Host booking management: requested/approved/paid/staying/checked-out pipeline view, approve/reject buttons, "mark paid" button
- CNIC upload UI (guest-facing) and the host's guest-document record view with CSV export

**End-of-sprint demo:** A guest requests a booking, the host approves it (AI visibly goes silent in that conversation), the host marks it paid (AI comes back for check-in questions), and the guest uploads a CNIC that shows up cleanly in the host's dashboard.

---

## Sprint 5 (Week 5) — Trust Features, Hardening & Launch

**Goal:** The product is trustworthy-looking and production-ready, not just functionally complete.

**Dev A (backend/infra):**
- Airbnb badge verification flow (temp-code check against the host's Airbnb listing description)
- Retention/deletion scheduled job for `guest_documents` past `retention_expires_at` (finally resolving the open question from the schema spec — needs the retention period confirmed first)
- Security pass: confirm signed URLs are short-lived, confirm no service-role key is ever exposed client-side, review all RLS policies against real usage
- Production Supabase project setup (`supabase link` + `supabase db push` to move Sprint 0's schema off local Docker and onto a real hosted project) and production deploy

**Dev B (frontend):**
- Trust elements on property pages: verified Airbnb badge display, host profile polish, cancellation/refund terms display
- Mobile performance pass: image lazy-loading, Lighthouse audit on a slow-connection profile (this is explicitly called out in the proposal as important — most traffic is a phone on a mobile network)
- Bug bash across the full guest and host journeys built in Sprints 1–4

**End-of-sprint demo:** A full cold-start walkthrough — new host signs up, sets up a property, gets a real guest booking through chat, collects payment and CNIC, all on the production URL — with nothing left mocked or stubbed.

---

## What's deliberately excluded from these 5 sprints

Per the proposal's explicit Phase 1/2/3 split and out-of-scope list: reviews, upsells, repeat-guest tooling, analytics, Airbnb iCal sync, team accounts, WhatsApp Business API, and any Airbnb inbox/account integration. None of these should creep into Sprints 1–5 — they're deferred by design, not by oversight.

## Before Sprint 1 starts

The proposal's own validation step (§11 — talking to 10–15 real operators, one week, no code) is not represented as a sprint here because it's not engineering work. If that hasn't happened yet, it should gate Sprint 1, not run in parallel with it — the whole point is to confirm there's a customer before building five weeks of product for them.
