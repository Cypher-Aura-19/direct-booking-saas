# Direct Booking Platform — Phase 1 Design Spec

| | |
|---|---|
| **Date** | 2026-09-20 |
| **Status** | Approved design, pending implementation plan |
| **Supersedes** | All prior code and specs. Repository restarted from zero on 2026-09-20 |
| **Sources** | `direct-booking-saas-proposal.md`, `Direct Booking Platform – Features & Workflow Plan.md` |
| **Executor** | Claude, task-by-task with TDD. Human reviews and supplies credentials |

## 1. What this is

A standalone booking and guest-operations system for Pakistani guesthouse, cabin and serviced-apartment operators running roughly 5–25 units, who already sell through WhatsApp, Instagram, Facebook and repeat guests but have no booking system behind it.

Three actors, and every workflow is choreography between them:

- **The guest** — never logs in. Taps a link, chats, picks dates, pays an advance directly to the host, shows up.
- **The host** — the paying customer. Manages properties, approves bookings, collects payment personally, can take over any AI conversation.
- **The AI agent** — answers from that one property's knowledge base, and is hard-blocked from money by the database, not by prompt instructions.

Not a marketplace. The platform never generates demand and never holds guest money.

## 2. Decision register

Every decision made during design, with its reasoning. Referenced by ID elsewhere.

| ID | Decision | Rationale |
|---|---|---|
| D-01 | Restart from zero. Old code and git history deleted | User directive. No inherited assumptions |
| D-02 | Next.js + Supabase + Vercel | Auth, Postgres, storage, realtime and row-level security in one box. Fastest path to a paying customer |
| D-03 | Claude implements, human reviews | Milestones sized in agent sessions, not human weeks |
| D-04 | Field validation skipped | **Accepted risk**, not a validated assumption. See R-01 |
| D-05 | Host billing is manual invoicing | Zero billing code in Phase 1. Pakistani payment rails are painful and must not block launch. An admin screen toggles accounts on after payment |
| D-06 | Guest reviews moved out of Phase 1 entirely | Resolves a contradiction between the two source docs. No guests yet means nothing to display |
| D-07 | Guest access by secret link + browser memory, host can resend | No accounts, no SMS cost, works on any phone. OTP recorded as a Phase 2 upgrade path |
| D-08 | Per-property AI control panel: 8 switches plus a free-text "never say this" box | Hosts must be able to answer "can I control what it says?" on a sales call. A full rules builder is a product in itself and was rejected |
| D-09 | The AI money-block cannot be overridden by any host | Liability shield and a selling point. Enforced by a database constraint |
| D-10 | Host alerts by email + in-app | Free, no approval process, consistent with WhatsApp API being out of scope |
| D-11 | CNIC retention 90 days, host may shorten but not extend | **Flagged for legal review before real guest data is accepted.** See O-01 |
| D-12 | No guest-side guarantee | Terms state plainly: software, not escrow or insurer. The platform never touches the money, so it carries no refund liability |
| D-13 | Airbnb badge verified by manual admin approval | No scraping, which the proposal rules out and Airbnb actively blocks. Under 50 hosts, this is minutes of work |
| D-14 | Public pages on a `stay.` subdomain, rewritten onto `/s/*` internally | Keeps the shareable link short for an Instagram bio, and prevents a host slug such as `login` from breaking the app |
| D-15 | Two visual languages sharing one token set | The host dashboard and the guest page have opposite jobs. Same materials, different building |
| D-16 | Light-first, dark optional | Hosts use mid-range Android phones, often outdoors. Rejects the 2026 dark-mode-first trend as wrong for this audience |
| D-17 | RTL and Nastaliq support built into the foundation, not retrofitted | CSS logical properties from day one. Retrofitting RTL later is a rewrite |
| D-18 | Chat embedded in the property page, not a floating bubble | Bubbles are read as ads and ignored. Opens with tappable starter questions, since guided-choice-first converts better than an empty cursor |
| D-19 | No public cross-host search page | Building one would quietly turn the product into the marketplace it says it is not |
| D-20 | Settings split across seven routes rather than one tabbed page | One job per page; easier to build, test and link to |

## 3. Scope

### In scope for Phase 1

Host onboarding and property management, a per-property AI knowledge base, public catalogue and property pages, availability and seasonal pricing, the AI agent with host-configurable limits, a live host inbox with takeover, the booking request and approval lifecycle, Hotel Eye CNIC capture with automatic retention deletion, email alerts, the Airbnb trust badge with manual verification, and an admin surface for manual account activation.

### Out of scope for Phase 1

| Not building | Reason |
|---|---|
| Guest reviews and post-checkout collection | D-06. Phase 2 |
| Upsells, repeat-guest tooling, analytics | Phase 2 |
| Subscription billing | D-05. Manual invoicing instead |
| Phone/OTP guest login | D-07. Phase 2 upgrade path |
| WhatsApp Business API, SMS | D-10. Revisit when customers demand it |
| Airbnb iCal sync | Phase 2, only if customers ask |
| Any Airbnb inbox, account or data integration | No public API; workarounds risk the host's account |
| Holding or processing guest payments | Requires SBP licensing and drags the platform into refunds and disputes |
| Automatic Hotel Eye portal submission | No public API. Confirmed, not assumed |
| Team accounts, owner statements, dynamic pricing | Phase 3 |
| Generating demand for hosts | Not a marketplace. Must be said out loud in every sales conversation |

## 4. Architecture

One Next.js application on Vercel, one Supabase project, four surfaces separated by route group and by access rule.

```
                stay.yourapp.com              www.yourapp.com
                       |                             |
              [middleware rewrite]                   |
                       v                             v
    +------------------------------------------------------------+
    |                    Next.js (App Router)                     |
    |                                                             |
    |  /s/*        public guest pages      anon key, public RLS   |
    |  /c/[token]  guest conversation      service role + token   |
    |  /id/[token] CNIC upload             service role + token   |
    |  /dashboard  host app                session, org-scoped RLS|
    |  /admin      operator app            session + admin claim  |
    |  /api/*      route handlers          service role           |
    +------------------------------------------------------------+
                       |                    |
                       v                    v
              +----------------+    +----------------+
              |    Supabase    |    |  Gemini Flash  |
              | Postgres + RLS |    |   (LLM calls)  |
              | Auth, Storage  |    +----------------+
              | Realtime       |
              +----------------+
```

**Access model — four distinct paths, deliberately:**

1. **Host** holds a Supabase session. Every query is constrained by row-level security to their own organisation. A host can never read another organisation's row.
2. **Guest** holds no session at all. Public property data is readable through the anon key against public RLS policies. Anything guest-specific goes through a server route using the service-role key, authorised by an unguessable conversation token.
3. **Admin** holds a session with an admin claim, and is the only path that crosses organisation boundaries.
4. **Cron** hits `/api/cron/retention` with a shared secret, for CNIC deletion.

The service-role key exists only in server-side code and is never sent to a browser. This is verified by an audit check, not by convention.

**Why the guest has no session:** adding guest accounts would mean auth, password recovery and a second identity system, to serve someone who visits once. The token in the URL is the credential. Its blast radius is one conversation, and nothing money-related is actionable through it.

## 5. The AI safety state machine

The backbone of the product. An explicit state machine on the conversation record, enforced in the database.

| State | AI status | Entered when | Can do | Cannot do |
|---|---|---|---|---|
| **Enquiry** | Active | Guest opens a property chat. Default | Answer from that property's knowledge base, quote live pricing, check live availability, take a booking request | Invent anything. Read another property's data |
| **Payment** | Suspended | Host approves a booking request | Send exactly one automatic acknowledgement as the state opens | Discuss, quote, confirm or handle money in any way. Reply at all after that one message |
| **Stay** | Reactivated | Host marks payment received | Check-in details, wifi, house questions, local recommendations, checkout | Discuss refunds or new charges. Those escalate to the host |

**The enforcement rule.** A database constraint makes it impossible for a message with `sender = 'ai'` to exist on a conversation in the `payment` state. The AI is not instructed to stay quiet — it is structurally incapable of speaking. If the prompt leaks, the model misbehaves, or a future developer forgets the rule, the write fails.

No host setting can relax this (D-09).

**The acknowledgement message** fires once on entry to `payment`, so the guest is never left staring at silence immediately after submitting a request.

**Escalation** is separate from state. In any state, if the AI does not know an answer or the guest asks for a human, it sets `ai_enabled = false` with a reason, alerts the host, and tells the guest it is checking with the host.

## 6. Host-configurable AI limits

Per property, layered on top of the non-negotiable money block.

| Switch | Default | Effect when off |
|---|---|---|
| Quote nightly rate | on | Declines and offers the host |
| Quote full stay total | on | Gives nightly rate only |
| Take booking requests | on | Directs the guest to message the host |
| Answer house rules | on | Escalates |
| Give directions and travel help | on | Escalates |
| Share wifi and gate codes before check-in | **off** | Withheld until the booking reaches `stay` |
| Recommend nearby food and attractions | on | Escalates |
| Answer in Urdu / Roman Urdu | on | Replies in English only |
| Free-text "never say this" | empty | Injected as a hard prohibition |

Every switch is enforced **server-side before the model is called** and re-checked on the response, never by prompt text alone. The AI settings page includes a live test chat so a host sees the effect of a switch immediately.

## 7. Data model outline

The detailed schema lands in the implementation plan. Shape:

- `organizations` — the host business. Slug, profile, payment instructions, policies, badge status, account status
- `properties` — one row per unit, carrying its own knowledge base and AI settings
- `property_photos` — ordered, with a cover flag
- `seasonal_pricing_rules` — date ranges, rates, minimum stay
- `availability_blocks` — manual blocks and confirmed bookings, with an exclusion constraint making a double booking impossible at the database level
- `conversations` — guest token, AI state, AI enabled flag, escalation reason
- `messages` — sender is guest, ai or host, with the payment-state constraint
- `bookings` — the status pipeline and the server-computed price
- `guests` — name, phone, per organisation
- `guest_documents` — CNIC image reference, retention expiry, encrypted at rest

Row-level security on every table. Tests must prove that a host authenticated as organisation A cannot read organisation B's rows — the test asserts the failure, it does not merely exercise the happy path.

## 8. Design direction

The supplied reference (`docs/reference/inspiration-staygo-orbix.webp`) was given for its **neatness, calm and spaciousness**, not as a component library to copy.

### Principles

1. **One accent colour.** Stamp-pad violet for primary actions and active states. Book-cloth green carries the sidebar and dark panels. Photography carries all remaining colour. *(Revised 2026-09-25: the original warm orange was replaced at the user's request; see "Visual world" below.)*
2. **Medium weight, never heavy.** Headings at 500. Large and calm, not loud.
3. **Space is the main tool.** Generous vertical rhythm between sections, few elements per screen. Emptiness is the design, not an absence of design.
4. **Hierarchy from typography**, not from boxes, borders and icon soup.
5. **Every element earns its place.** The dashboard home answers exactly one question: does anything need me right now?
6. **Progressive disclosure.** Common options visible, advanced collapsed.
7. **Written empty states.** A host with no properties gets a sentence that helps, not a grey box.

### Tokens

| Token | Value | Use |
|---|---|---|
| Ink (`text-ink`) | `#141824` | Primary text, blue-black |
| Surface | `#FFFFFF` | Sheets, forms, main content |
| Surface muted | `#F4F6FA` | App background, alternating sections |
| Accent | `#5B34C7` | The single accent: stamp-pad violet |
| Muted (`text-muted`) | `#5D6474` | Supporting text |
| Hairline | `#E2E6EE` | Dividers, outlines |
| Cloth | `#0F3D2E` | Book-cloth green: sidebar, dark panels |
| Radius | 16px cards, 12px fields, 999px buttons | |
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 | Section gaps live at the top of the scale |
| Type | Geist for UI; Geist Mono for register figures (dates, slugs, times) only | |

**Visual world (2026-09-25): "The Guest Register".** The product is named **Qayam** (قیام, "a stay"). The host app is styled as the register book every guesthouse keeps: bottle-green book cloth, cool white paper (never cream), blue-black ink, and violet stamp-pad ink. Statuses (Published, Draft, Needs you, Escalated) are double-ringed rubber stamps. The one authored motion is the stamp pressing down when a state changes. Durable details live in `DESIGN.md` at the repository root.

**Semantic colours are separate from the brand violet** — red destructive, amber warning, green success, all deliberately desaturated. Otherwise "needs attention" and "click here" look identical in the dashboard.

### Two visual languages

| | Host dashboard | Guest-facing pages |
|---|---|---|
| Used by | The same person, daily, for work | A stranger, once, deciding whether to trust |
| Job | Get out of the way | Make a place feel real and safe |
| Layout | Calm and dense. Sidebar on desktop, bottom tab bar on mobile | Photo-led, full-bleed, generous |
| Shares | Every token above | Every token above |

### Urdu, Roman Urdu and RTL

Researched, and built into the foundation rather than retrofitted (D-17):

- Urdu is right-to-left and set in **Nastaliq**, a different shape from Arabic Naskh. Self-host `Noto Nastaliq Urdu`.
- **Weights 300, 500 and 600 render badly in Nastaliq. Use 400 and 700 only.**
- Nastaliq needs substantially more line-height than Latin; its deep descenders collide at normal spacing.
- The font stack switches on the `lang` attribute.
- **All layout uses CSS logical properties** (`padding-inline-start`, never `padding-left`) from the first commit. Directional icons mirror with `scaleX(-1)`.
- Roman Urdu is Latin script and needs nothing special beyond not looking like an error.

### Performance budget

Over half of mobile users abandon past three seconds, and the real arrival path is an Instagram tap on mobile data in a hill station. **Public guest pages must render within three seconds on a throttled slow-3G profile.** This is a measured number in the audit checklist, not an aspiration.

## 9. Frontend page map

42 routes across four surfaces, following four repeating layouts.

### Marketing — `www` (M12)

| Route | Contents |
|---|---|
| `/` | The pitch. Airbnb fee maths, the Hotel Eye legal angle, how it works, pricing, sign-up CTA |
| `/pricing` | Plans, and the bank transfer / Easypaisa reality |
| `/privacy` | **Legally required.** The guest sees this before uploading a CNIC |
| `/terms` | Where D-12 is stated plainly: software, not escrow, no guest guarantee |
| `/contact` | WhatsApp link and email. No form to maintain |

### Auth (M3)

| Route | Contents |
|---|---|
| `/signup` | Email, password, host name |
| `/login` | Email, password |
| `/verify-email` | Holding screen |
| `/forgot-password`, `/reset-password` | Recovery pair |
| `/auth/callback` | Route handler for Supabase email confirmation |
| `/onboarding` | Wizard: organisation name, public slug with live availability check, city and phone, first property. Blocks the dashboard until complete |

### Host dashboard — session + organisation required

Sidebar on desktop; **bottom tab bar on mobile** (Home, Inbox, Calendar, More), because hosts run this from a phone.

| Route | Contents | M |
|---|---|---|
| `/dashboard` | The "does anything need me?" screen. Waiting booking requests, escalated chats, unread messages, today's check-ins and check-outs. Nothing else, no charts | M3 |
| `/dashboard/inbox` | All conversations, all properties. Unread counts, search, filter by property and booking status | M9 |
| `/dashboard/inbox/[id]` | One conversation, live. AI/Host labels, per-chat AI toggle, booking card pinned at top, resend-link button | M9 |
| `/dashboard/calendar` | All properties on one calendar; bookings and blocks together | M6 |
| `/dashboard/bookings` | The pipeline: requested, approved, paid, staying, checked out. Filterable | M10 |
| `/dashboard/bookings/[id]` | Guest, dates, server-computed price, CNIC record, link to the conversation, and the actions: approve, reject, mark paid, check in, check out | M10 |
| `/dashboard/properties` | List, with published/draft state and a view-public-page link | M4 |
| `/dashboard/properties/new` | The minimum to exist: name, type, address, base rate, max guests | M4 |
| `/dashboard/properties/[id]` | Basics plus the publish toggle | M4 |
| `/dashboard/properties/[id]/photos` | Upload, drag to reorder, delete, set cover | M4 |
| `/dashboard/properties/[id]/knowledge` | The AI's brain: wifi, gate code, geyser, generator, AC, parking, check-in and checkout times, directions, nearby food and attractions | M4 |
| `/dashboard/properties/[id]/ai` | The control panel of §6, plus a live test chat | M8 |
| `/dashboard/properties/[id]/calendar` | Block and unblock dates for this property | M6 |
| `/dashboard/properties/[id]/pricing` | Seasonal rates, minimum stay, advance percentage | M6 |
| `/dashboard/guests` | The Hotel Eye register. Date-range filter, search, CSV export, and a visible countdown to each record's deletion | M11 |
| `/dashboard/guests/[id]` | CNIC image behind a short-lived signed URL, plus name, CNIC number, phone and dates as **copy-to-clipboard fields** — the host retypes these into the government portal by hand | M11 |
| `/dashboard/settings` | Organisation name, public slug, catalogue headline | M4 |
| `/dashboard/settings/profile` | Public host profile: real name, photo, phone, years hosting, bio. **A trust feature, not vanity** — anonymity is what scares guests | M12 |
| `/dashboard/settings/payment` | Payment instructions shown to guests: bank account, Easypaisa, JazzCash, advance percentage | M10 |
| `/dashboard/settings/policies` | Cancellation and refund terms, house rules, check-in and checkout times | M12 |
| `/dashboard/settings/trust` | Submit the Airbnb listing URL; see badge status | M12 |
| `/dashboard/settings/notifications` | Which events send email | M12 |
| `/dashboard/settings/account` | Email, password, log out | M3 |

### Guest-facing — `stay.` subdomain

Mobile-first, against the three-second budget.

| Route | Contents | M |
|---|---|---|
| `/s/[org]` | Host catalogue. Published properties, host profile, trust badges | M5 |
| `/s/[org]/[property]` | **The page that sells.** Gallery, price, amenities, live availability calendar, host profile, badges, cancellation terms, embedded AI chat, and a booking panel — sticky sidebar on desktop, bottom sheet on mobile | M5–M7 |
| `/c/[token]` | The guest's own chat on the secret link. Booking status card, check-in details once confirmed, chat below | M7 |
| `/id/[uploadToken]` | CNIC upload on a **separate expiring link**. Camera capture, name, CNIC number, phone. Privacy policy shown before anything uploads | M11 |

### Admin — operator only (M12)

Manual invoicing (D-05) means there must be a switch to turn accounts on.

| Route | Contents |
|---|---|
| `/admin` | Signups, active organisations, usage at a glance |
| `/admin/orgs`, `/admin/orgs/[id]` | **Activate or suspend an account after payment.** This is the Phase 1 billing system |
| `/admin/badge-requests` | The Airbnb badge queue: listing URL, open it, approve or reject |

### Route handlers

`/api/chat` (AI streaming, service role) · `/api/guests/export` (CSV) · `/api/cron/retention` (nightly CNIC deletion) · `/api/images/[...]` (Supabase Storage transform loader)

### System

`not-found.tsx`, `error.tsx`, and a `loading.tsx` per route group. Designed empty states for: no properties, no bookings, no conversations, no guest records, and an unpublished catalogue.

## 10. Milestones

One milestone per agent working session, roughly. Each ends in something demonstrable — never "just the backend".

| M | Name | Goal | Done when |
|---|---|---|---|
| **M1** | Foundation | Repo, Next.js, local Supabase, test runner, deploy pipeline, design tokens, RTL/Nastaliq font stack, logical-property lint rule | The app runs locally and a styled page deploys to a real Vercel URL |
| **M2** | Data model | Every Phase 1 table, the double-booking exclusion constraint, the AI payment-state constraint, row-level security | Tests pass, including one that tries to cross-read another organisation and asserts the failure |
| **M3** | Auth and onboarding | Sign up, log in, create organisation, dashboard shell with the guard chain | Sign up, create org, log out, log back in, still there |
| **M4** | Properties and knowledge base | Property CRUD, photo upload and ordering, the full knowledge base, org settings | A property with photos and a filled knowledge base survives a logout |
| **M5** | Public catalogue | Catalogue and property pages, subdomain rewrite, image transforms, mobile-first layout | The public URL opens fast on a phone on mobile data |
| **M6** | Availability and pricing | Date blocking, seasonal rates, minimum stay, live calendar on the public page | Block a week as host; incognito public page shows those dates gone |
| **M7** | AI agent and guest chat | Gemini Flash, embedded chat, secret-link conversations, English/Urdu/Roman Urdu, per-property grounding, escalation | Ask in Roman Urdu about property A and fail to extract property B's gate code by any means |
| **M8** | AI control panel | The eight switches, the never-say box, server-side enforcement, live test chat | Turn off price quoting, ask the price, the AI declines and offers the host |
| **M9** | Host inbox | Realtime conversation list and thread, takeover toggle, AI/Host labels, unread counts, **in-app** escalation alerts (email alerts land in M12) | Two tabs: message as guest, watch it land live as host, take over, hand back |
| **M10** | Booking request and approval | Guest request, server-computed price, approve/reject, calendar lock, transition to payment state | Approve a booking; the AI visibly goes silent and the dates lock |
| **M11** | Payment, stay and Hotel Eye | Mark paid, AI resumes, status pipeline, CNIC upload on an expiring link, host record view, CSV export, 90-day deletion job | Mark paid, AI resumes, upload a CNIC, see it in the dashboard, export the CSV |
| **M12** | Trust, alerts and hardening | Email alerts, badge admin approval, host profile, policies, marketing site, privacy and terms, security pass, performance pass | An escalation email arrives; the slow-3G budget is met and recorded |
| **M13** | Launch | Hosted Supabase, production deploy, real domain, cold-start smoke test | The entire guest journey runs on the live URL with nothing mocked |

Calendar time depends on review speed, not build speed. Review is the bottleneck.

**This spec is the umbrella.** Each milestone gets its own implementation plan written immediately before it is built, so that plan can account for what the previous milestone actually produced rather than what it was predicted to produce.

## 11. Audit and tracking

The enemy is drift: things marked done that were never finished. Three mechanisms.

### Requirement registry — `docs/requirements.md`

Every Phase 1 requirement carries a permanent ID (`PROP-04`, `AI-11`, `CNIC-03`). Roughly 120–150 of them, derived from the two source documents plus every decision in §2. **This is the definition of complete.** Not in the registry means not Phase 1; in the registry means it ships.

### Tracker — `docs/TRACKER.md`

Every requirement, its milestone, its status, and the file and test that prove it.

```
| ID      | Requirement                          | M   | Status | Proof                |
|---------|--------------------------------------|-----|--------|----------------------|
| AI-11   | AI cannot reply in payment state     | M10 | done   | ai/guard.test.ts:44  |
| CNIC-03 | Documents auto-delete after 90 days  | M11 | todo   | —                    |
```

Updated at the end of every session.

### Auditor — `scripts/audit.mjs`, run on every commit

An actual script, not a habit. It:

- reads the registry and scans the codebase for each requirement ID tagged in tests
- **fails the build** when a requirement is marked `done` but no test references its ID
- lists every requirement with no test at all
- asserts the service-role key never appears in client-side code
- prints a real completion percentage

### Milestone exit audit

A milestone is not closed until: the full suite is green with output pasted, the demo path has been walked by hand, every requirement for that milestone is marked done with proof, and no `TODO` or stub remains in that milestone's code.

**The rule underneath all of it: nothing is marked done without pasted evidence.** No "should work". Command output, or it did not happen.

## 12. Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-01 | **Hosts have no audience of their own, so catalogues get no traffic** | High | Unmitigated by engineering. Field validation was skipped by choice (D-04). This is the single biggest risk in the project and it is a sales discipline problem. Qualify hard; walk away from Airbnb-dependent hosts |
| R-02 | Guests do not trust an unknown site enough to send an advance | High | Small advance with the balance on arrival, visible host identity, verified badge, clear terms |
| R-03 | CNIC data breach | High | Encryption at rest, short-lived signed URLs, strict per-organisation access control, automatic deletion, legal review |
| R-04 | The platform badges a listing that is not the host's | Medium | Manual verification before the badge shows. No unverified badges, ever (D-13) |
| R-05 | The AI quotes a wrong price or confirms an unpaid booking | Medium | Live data only, price computed server-side, and a database-level block during payment (D-09) |
| R-06 | Monthly collection fails | Medium | Manual invoicing plus annual prepay (D-05) |
| R-07 | Small total market | Medium | Target multi-unit operators, not single-property owners |
| R-08 | Host churns after one slow season | Medium | Upsells and repeat-guest tooling in Phase 2 |

## 13. Open items

| ID | Item | Owner | Blocks |
|---|---|---|---|
| O-01 | **Confirm the legal CNIC retention period** under the Punjab Information of Temporary Residence Act 2015. 90 days is an assumption (D-11) | Human, with a lawyer | Accepting real guest data. Not M11 itself |
| O-02 | Register the domain and decide the production brand name | Human | M13 |
| O-03 | Supabase and Vercel production accounts, and the Gemini API key | Human | M13 |
| O-04 | Decide whether to keep or re-run the skipped field validation (D-04) before spending on customer acquisition | Human | Sales, not engineering |
