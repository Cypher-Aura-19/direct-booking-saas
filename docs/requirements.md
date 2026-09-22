# Phase 1 Requirement Registry

Derived from `docs/superpowers/specs/2026-09-20-phase-1-design.md`. **This file is the definition of "complete".** Not in this registry means not Phase 1. In this registry means it ships.

## How status works

There is no hand-written status column, deliberately. A requirement is **done when a test is tagged with its ID** and that test passes:

```ts
// @req AI-11
it("refuses to write an ai message while the conversation is in payment state", ...)
```

`scripts/audit.mjs` scans for those tags, cross-references this registry, and generates `docs/TRACKER.md`. Status is **computed, never asserted** — which removes the failure mode of something being marked done because someone believed it was.

Rules enforced by the auditor:

1. Every `@req` tag must reference an ID that exists here. Typos fail the build.
2. Every requirement listed against a milestone must have a tagged test before that milestone can close.
3. A requirement may be tagged by more than one test. All must pass.

## M1 — Foundation

| ID | Requirement |
|---|---|
| FOUND-01 | Repository has a root workspace that delegates to the `web/` Next.js app |
| FOUND-02 | The home page renders its heading and main landmark |
| FOUND-03 | Vitest runs and a component test passes under jsdom |
| FOUND-04 | Local Supabase stack starts and reports healthy services |
| FOUND-05 | Every design token in spec §8 is defined in `globals.css` |
| FOUND-06 | Semantic colours (destructive, warning, success) are distinct from brand accent |
| FOUND-07 | Latin UI font loads and is applied via a CSS variable |
| FOUND-08 | `Noto Nastaliq Urdu` loads at weights 400 and 700 only |
| FOUND-09 | An element marked `lang="ur"` receives `dir="rtl"` and the Nastaliq font stack |
| FOUND-10 | Nastaliq text uses a larger line-height than Latin text |
| FOUND-11 | Button primitive renders primary, secondary and ghost variants from tokens |
| FOUND-12 | Auditor rejects a `@req` tag whose ID is absent from the registry |
| FOUND-13 | Auditor reports a requirement with no tagged test as not done |
| FOUND-14 | Auditor fails when a physical CSS utility (`pl-`, `mr-`, `text-left`) is used instead of its logical equivalent |
| FOUND-15 | Auditor fails when the service-role key is referenced in client-side code |
| FOUND-16 | Auditor regenerates `docs/TRACKER.md` with a completion percentage |
| FOUND-17 | CI runs lint, tests, the auditor and the production build on every push |
| FOUND-18 | The app deploys to a live Vercel URL |

## M2 — Data model

| ID | Requirement |
|---|---|
| DB-01 | `organizations` table with slug, profile, payment instructions, policies, badge status, account status |
| DB-02 | `properties` table carrying its own knowledge base and AI settings |
| DB-03 | `property_photos` table with explicit ordering and a cover flag |
| DB-04 | `seasonal_pricing_rules` table with date range, rate and minimum stay |
| DB-05 | `availability_blocks` table |
| DB-06 | An exclusion constraint makes overlapping blocks on one property impossible |
| DB-07 | `conversations` table with guest token, AI state, AI enabled flag and escalation reason |
| DB-08 | `messages` table with sender of guest, ai or host |
| DB-09 | A constraint forbids an `ai` message on a conversation in `payment` state |
| DB-10 | `bookings` table with the status pipeline and a price column that will be server-computed, never client-supplied, once the M10 booking flow writes it |
| DB-11 | `guests` table scoped to an organisation |
| DB-12 | `guest_documents` table with image reference and retention expiry |
| DB-13 | Row-level security is enabled on every table |
| DB-14 | A host authenticated as organisation A cannot read organisation B's rows — asserted as a failure |
| DB-15 | Public RLS policies expose only published property data to the anon key |
| DB-16 | Guest conversation tokens are unguessable and unique |

## M3 — Auth and onboarding

| ID | Requirement |
|---|---|
| AUTH-01 | A host can sign up with email, password and name |
| AUTH-02 | A host can log in |
| AUTH-03 | A host can log out |
| AUTH-04 | Sessions refresh without the host being logged out mid-use |
| AUTH-05 | Email confirmation lands on a callback route and completes signup |
| AUTH-06 | A host can request a password reset and set a new password |
| AUTH-07 | An unauthenticated visitor to `/dashboard` is redirected to login |
| AUTH-08 | A host without an organisation is redirected to onboarding |
| AUTH-09 | Onboarding creates an organisation with name, slug, city and phone |
| AUTH-10 | The onboarding slug field rejects a slug already in use |
| AUTH-11 | The onboarding slug field rejects reserved words that would collide with app routes |
| AUTH-12 | A host who completes onboarding reaches the dashboard and stays there on re-login |
| AUTH-13 | The dashboard home lists waiting booking requests, escalated chats, unread messages and today's arrivals and departures |
| AUTH-14 | Dashboard navigation renders as a sidebar on desktop and a bottom tab bar on mobile |

## M4 — Properties and knowledge base

| ID | Requirement |
|---|---|
| PROP-01 | A host can create a property with name, type, address, base rate and max guests |
| PROP-02 | A host can edit a property's basics |
| PROP-03 | A host can publish and unpublish a property |
| PROP-04 | An unpublished property is not readable by the public |
| PROP-05 | A host can upload photos to a property |
| PROP-06 | A host can reorder photos |
| PROP-07 | A host can delete a photo |
| PROP-08 | A host can set a cover photo |
| PROP-09 | Knowledge base stores wifi credentials and gate code |
| PROP-10 | Knowledge base stores geyser, generator, AC and parking instructions |
| PROP-11 | Knowledge base stores check-in and checkout times |
| PROP-12 | Knowledge base stores directions, nearby food and attractions |
| PROP-13 | A host can edit organisation name, public slug and catalogue headline |
| PROP-14 | A host cannot read or modify another organisation's property through the app |
| PROP-15 | Property list shows published or draft state and a link to the public page |

## M5 — Public catalogue

| ID | Requirement |
|---|---|
| PUB-01 | A host catalogue page lists that host's published properties |
| PUB-02 | A property page shows gallery, price, amenities and description |
| PUB-03 | A property page shows the host profile |
| PUB-04 | Public pages require no login |
| PUB-05 | The `stay.` subdomain rewrites onto `/s/*` |
| PUB-06 | A request for an unknown organisation slug returns a written not-found page |
| PUB-07 | Images are served through Supabase Storage transformation at an appropriate size |
| PUB-08 | Public pages are laid out mobile-first |
| PUB-09 | There is no route that lists or searches properties across organisations |
| PUB-10 | An organisation with nothing published renders a written empty state, not a blank page |

## M6 — Availability and pricing

| ID | Requirement |
|---|---|
| CAL-01 | A host can block a date range on a property |
| CAL-02 | A host can remove a block |
| CAL-03 | A host can view all properties on one calendar |
| CAL-04 | A host can create a seasonal pricing rule with a date range and rate |
| CAL-05 | A host can set a minimum stay |
| CAL-06 | A host can set the advance percentage |
| CAL-07 | The public property page renders live availability |
| CAL-08 | Blocked dates are shown as unavailable to the public |
| CAL-09 | The price shown for a date range reflects any seasonal rule covering it |
| CAL-10 | Overlapping blocks are rejected |

## M7 — AI agent and guest chat

| ID | Requirement |
|---|---|
| AI-01 | A guest can start a conversation from a property page without logging in |
| AI-02 | A conversation is addressed by an unguessable token in the URL |
| AI-03 | The token is stored in browser storage and restores the chat on return |
| AI-04 | The chat is embedded in the property page, not a floating bubble |
| AI-05 | The chat opens with tappable starter questions |
| AI-06 | The AI answers from that property's knowledge base |
| AI-07 | The AI cannot read another property's knowledge base |
| AI-08 | The AI answers in English |
| AI-09 | The AI answers in Urdu |
| AI-10 | The AI answers in Roman Urdu |
| AI-11 | The AI reads live availability rather than inventing it |
| AI-12 | The AI reads live pricing rather than inventing it |
| AI-13 | The AI escalates when it does not know an answer |
| AI-14 | The AI escalates when the guest asks for a human |
| AI-15 | On escalation the conversation is flagged and the host is alerted |
| AI-16 | On escalation the guest is told the host is being checked with |
| AI-17 | Guest message routes use the service role and never expose it to the browser |
| AI-18 | Mobile chat docks the composer and keeps tap targets at least 44px |

## M8 — AI control panel

| ID | Requirement |
|---|---|
| AIC-01 | Each property has independent AI settings |
| AIC-02 | Switch: quote nightly rate |
| AIC-03 | Switch: quote full stay total |
| AIC-04 | Switch: take booking requests |
| AIC-05 | Switch: answer house rules |
| AIC-06 | Switch: give directions and travel help |
| AIC-07 | Switch: share wifi and gate codes before check-in, defaulting to off |
| AIC-08 | Switch: recommend nearby food and attractions |
| AIC-09 | Switch: answer in Urdu and Roman Urdu |
| AIC-10 | Free-text "never say this" is applied as a prohibition |
| AIC-11 | Every switch is enforced server-side before the model is called |
| AIC-12 | Every switch is re-checked against the model response before it is stored |
| AIC-13 | A disabled capability produces a decline that offers the host instead |
| AIC-14 | The settings page provides a live test chat |
| AIC-15 | No AI setting can permit the AI to act during payment state |

## M9 — Host inbox

| ID | Requirement |
|---|---|
| INBOX-01 | All conversations across all properties appear in one list |
| INBOX-02 | New messages appear live without a page refresh |
| INBOX-03 | Existing messages are reconciled after subscribing, so none are dropped at page load |
| INBOX-04 | A host can toggle the AI off for one conversation only |
| INBOX-05 | While toggled off, the AI does not reply in that conversation |
| INBOX-06 | A host can send a message as themselves |
| INBOX-07 | When the AI is re-enabled it has read what the host sent |
| INBOX-08 | Every message is labelled as guest, AI or host |
| INBOX-09 | Unread counts are shown per conversation |
| INBOX-10 | Conversations can be searched |
| INBOX-11 | Conversations can be filtered by property and by booking status |
| INBOX-12 | In-app alerts are raised for escalations and new booking requests |
| INBOX-13 | A host can resend the guest their conversation link |

## M10 — Booking request and approval

| ID | Requirement |
|---|---|
| BOOK-01 | A guest can submit a booking request for a date range |
| BOOK-02 | A booking request is rejected if the dates are unavailable |
| BOOK-03 | A booking request is rejected if it violates the minimum stay |
| BOOK-04 | The total price is computed server-side, never supplied by the client |
| BOOK-05 | A host sees pending requests and can approve or reject |
| BOOK-06 | Approval creates an availability block covering the dates |
| BOOK-07 | Approval moves the conversation to payment state |
| BOOK-08 | Entering payment state sends exactly one automatic acknowledgement |
| BOOK-09 | No AI message can be written while in payment state |
| BOOK-10 | Rejection leaves the calendar untouched |
| BOOK-11 | The booking pipeline shows requested, approved, paid, staying and checked out |
| BOOK-12 | Payment instructions from org settings are shown to the guest at the payment step |

## M11 — Payment, stay and Hotel Eye

| ID | Requirement |
|---|---|
| PAY-01 | A host can mark payment received |
| PAY-02 | Marking payment received moves the booking to paid |
| PAY-03 | Marking payment received moves the conversation to stay state |
| PAY-04 | In stay state the AI answers check-in and house questions again |
| PAY-05 | In stay state the AI escalates refund and new-charge questions instead of answering |
| PAY-06 | A host can mark check-in and checkout |
| CNIC-01 | After confirmation the guest is prompted to upload identification |
| CNIC-02 | The upload uses a separate link that expires |
| CNIC-03 | The guest supplies name, identification number, phone and stay dates |
| CNIC-04 | The uploaded image is stored privately, never publicly readable |
| CNIC-05 | The image is served to the host only via a short-lived signed URL |
| CNIC-06 | An uploaded document is not displayed back on the guest page |
| CNIC-07 | The privacy policy is shown before any upload |
| CNIC-08 | The host sees each record with copy-to-clipboard fields |
| CNIC-09 | The host can filter records by date range |
| CNIC-10 | The host can export records for a date range as CSV |
| CNIC-11 | Each record carries a retention expiry, defaulting to 90 days after checkout |
| CNIC-12 | A host can shorten the retention period but not extend it beyond the cap |
| CNIC-13 | A scheduled job deletes records past their retention expiry, image included |
| CNIC-14 | The remaining retention period is visible to the host |
| CNIC-15 | One organisation cannot read another organisation's documents |

## M12 — Trust, alerts and hardening

| ID | Requirement |
|---|---|
| TRUST-01 | A host can submit an Airbnb listing URL |
| TRUST-02 | A submitted URL appears in an admin approval queue |
| TRUST-03 | The badge is displayed publicly only after approval |
| TRUST-04 | The badge is plain text with no Airbnb branding |
| TRUST-05 | The badge links out to the listing |
| TRUST-06 | A host can set their public profile: real name, photo, phone, years hosting, bio |
| TRUST-07 | The host profile is shown on catalogue and property pages |
| TRUST-08 | A host can set cancellation and refund terms |
| TRUST-09 | Cancellation terms are shown to the guest before a booking request is submitted |
| TRUST-10 | Email alerts are sent for escalations |
| TRUST-11 | Email alerts are sent for new booking requests |
| TRUST-12 | A host can choose which events send email |
| TRUST-13 | The marketing site explains the product, pricing and how it works |
| TRUST-14 | A published privacy policy exists and is reachable from the upload flow |
| TRUST-15 | Published terms state that the platform is software, not escrow, with no guest guarantee |
| ADMIN-01 | An admin can list organisations |
| ADMIN-02 | An admin can activate an organisation after payment |
| ADMIN-03 | An admin can suspend an organisation |
| ADMIN-04 | A suspended organisation's public pages stop serving |
| ADMIN-05 | Admin routes are unreachable without an admin claim |
| ADMIN-06 | An admin can approve or reject a badge request |

## Cross-cutting

| ID | Requirement |
|---|---|
| SEC-01 | The service-role key never reaches client-side code |
| SEC-02 | Row-level security denies cross-organisation reads on every table |
| SEC-03 | Guest document images are encrypted at rest |
| SEC-04 | Signed URLs for documents are short-lived |
| SEC-05 | The cron retention endpoint requires a shared secret |
| SEC-06 | Conversation tokens carry no guessable structure |
| SEC-07 | A conversation token grants access to that conversation only |
| SEC-08 | No money-affecting action is possible through a guest token |
| PERF-01 | Public property pages render within three seconds on a throttled slow-3G profile |
| PERF-02 | Images are lazily loaded below the fold |
| PERF-03 | Images are served at a size appropriate to the viewport |
| A11Y-01 | Interactive targets are at least 44px on mobile |
| A11Y-02 | All layout uses CSS logical properties, never physical ones |
| A11Y-03 | Text meets contrast requirements against its background |
| I18N-01 | Urdu renders right-to-left |
| I18N-02 | Urdu uses Nastaliq at weights 400 or 700 only |
| I18N-03 | Directional icons mirror under RTL |

## Totals

| Milestone | Requirements |
|---|---|
| M1 Foundation | 18 |
| M2 Data model | 16 |
| M3 Auth and onboarding | 14 |
| M4 Properties | 15 |
| M5 Public catalogue | 10 |
| M6 Availability and pricing | 10 |
| M7 AI agent | 18 |
| M8 AI control panel | 15 |
| M9 Host inbox | 13 |
| M10 Booking | 12 |
| M11 Payment and Hotel Eye | 21 |
| M12 Trust and admin | 21 |
| Cross-cutting | 17 |
| **Total** | **200** |
