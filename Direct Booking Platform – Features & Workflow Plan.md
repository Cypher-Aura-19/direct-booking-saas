# Direct Booking Platform – Features & Workflow Plan

## 1. Overview & how to use this doc

This doc turns the written proposal into a working feature list and step-by-step workflows, so we can poke at the details, spot gaps, and change our minds before any code gets written. Treat it as a living plan: edit it directly, drop comments on anything that feels off, and we'll keep tightening it.

Three things interact in this product, and every workflow below is really just choreography between them:

- **The guest** — never logs into anything complicated. Just clicks a link, chats, picks dates, pays a deposit, shows up.
- **The host** — the paying customer. Manages properties, approves bookings, collects payment personally, and can jump into any AI conversation at any time.
- **The AI agent** — answers guest questions from that property's own knowledge base, but is hard-blocked from touching money. This boundary is enforced by the system itself, not just by instructions to the AI.

We'll focus first on Phase 1 (the part that actually ships first), then sanity-check Phase 2/3 so we're not building ourselves into a corner.

## 2. Phase 1 feature list (core product)

Grouped by area, so each can be scoped and built somewhat independently.

**Host onboarding**

- Sign up, create an organisation
- Add a property: name, description, photos, nightly rate, max guests, rules, address
- Property knowledge base: wifi password, gate code, generator/geyser/AC instructions, checkout time, directions, nearby food and attractions
- Optional: add an Airbnb listing URL to unlock the verified trust badge

**Public catalogue (guest-facing)**

- One catalogue page per host, listing all their properties (e.g. `stay.ourapp.com/hunza-view`)
- One page per property: photos, price, amenities, live calendar, host profile, reviews, trust badges
- Mobile-first — nearly everyone arrives from an Instagram bio tap
- Optimised for slow connections: compressed images, lazy loading

**Availability calendar**

- Host can block dates manually
- Confirmed bookings block dates automatically
- Guests only see real, current availability before requesting
- Minimum-stay rules and seasonal pricing

**AI agent**

- Live chat on every property page
- Answers only from that property's own knowledge base plus live pricing/availability — never another property's data, never invented answers
- Speaks English, Urdu, and Roman Urdu
- Sends an automatic "checking with the host now" message, then goes silent once a booking enters the payment step, until the host confirms payment
- Escalates to the host and pauses itself when it doesn't know something or the guest asks for a human

**Host inbox**

- Every AI conversation visible in one live inbox
- Per-conversation AI on/off toggle, with the AI staying in context when handed back
- Clear "AI" vs "Host" labels on every message
- Alerts on escalations and new booking requests

**Booking flow**

- Guest picks dates, sees live availability, submits a request
- Host approves or rejects
- On approval: AI suspends, host collects payment directly (Raast, bank transfer, JazzCash, Easypaisa)
- Host marks payment received → booking confirmed → AI reactivates
- Guest receives confirmation with check-in details

**Hotel Eye (CNIC) capture**

- After confirmation, guest uploads CNIC/passport photo + name, phone, stay dates
- Host sees a clean, copyable record per guest
- CSV export

**Host dashboard**

- Properties, bookings, guests, calendar, inbox in one place
- Booking status pipeline: requested → approved → paid → staying → checked out

## 3. Guest journey workflow

Step by step, from the guest's very first tap to leaving a review.

1. Guest taps the host's link in an Instagram bio, WhatsApp status, or Facebook page
2. Lands on the host's catalogue page — sees all of that host's properties
3. Opens one property — sees photos, price, amenities, and a live availability calendar
4. Chats with the AI agent about anything: the property, the area, house rules, whatever they're unsure of
5. Picks dates and submits a booking request
6. **Handoff point** — the AI sends a one-line "checking with the host now" message, then goes silent on money matters while the host takes over to arrange payment
7. Host confirms payment received and marks the booking confirmed
8. **AI reactivates** — handles the rest of the guest's stay: check-in details, wifi, house questions, local tips
9. Guest uploads their CNIC (or passport) for the legally required Hotel Eye record
10. After checkout, the guest is asked to leave a review, which then shows on the property page for future guests

**Decided:** at the start of the Payment state, the AI automatically sends one short message ("checking with the host now, one moment") before it goes quiet on money matters. That way the guest is never left staring at silence right after submitting a request — see the Payment row in section 4 for exactly what that message covers.

## 4. AI state machine: Enquiry → Payment → Stay

This is the safety backbone of the whole product, so it's worth spelling out as an actual state machine rather than scattered logic.

| State | AI status | What triggers entry | What the AI can and can't do |
| --- | --- | --- | --- |
| **Enquiry** | Active | Default state; a guest opens a property chat | Can answer questions, quote nightly price, check live availability, and take a booking request. Cannot invent an answer — always reads live data from that property's own knowledge base. |
| **Payment** | Suspended automatically | Host approves a booking request | Sends one automatic acknowledgment message the moment this state begins, then cannot discuss, quote, confirm, or handle money in any way, under any circumstance. Host is the only one who can speak here from that point on. |
| **Stay** | Reactivated by host | Host marks payment as received | Can handle check-in details, wifi, house questions, local recommendations, and checkout — but still cannot discuss refunds or new charges; those escalate to the host. |

Why this matters: suspending the AI the moment money enters the picture removes any chance of it confirming a payment that never arrived, quoting the wrong amount, or making a refund promise the business can't honor. It's enforced on the server, on the booking record itself — the AI is *incapable* of replying during the Payment state, not merely told not to. That distinction matters a lot for how this gets built: it's a hard gate in the backend logic, not a prompt instruction.

## 5. Host inbox workflow

How the host monitors and steps into AI conversations.

1. Every guest conversation lands in one inbox, across all properties, exactly like a normal messaging app
2. Host can sit inside any chat and watch the AI reply live, in real time
3. If the host wants to jump in personally, they flip a per-chat toggle to take over — the AI goes quiet on that one conversation only
4. Host types as themselves; every message is clearly labelled "Host" so the guest (and the host, scrolling back later) always knows who said what
5. When the host is done, they flip the toggle back — the AI resumes, having read what the host just typed, so it doesn't repeat itself or contradict what was already said
6. **Automatic escalation:** if the AI doesn't know an answer, or the guest explicitly asks for a human, the AI pauses that one chat on its own and alerts the host — the host doesn't have to be watching for this to happen
7. Inbox supports unread counts, search, and filtering by property or booking status, so a host running several properties isn't scrolling through everything at once

Refinement question: what should the guest actually see while a chat is paused waiting on the host (step 6)? A guest who asks something the AI can't answer and then just sees silence is a bad experience — worth deciding whether the AI sends a short "checking with the host, one moment" message automatically.

## 6. Hotel Eye / CNIC compliance workflow

Step by step, from booking confirmation to a ready-to-submit record.

1. Booking moves to "confirmed" once the host has marked payment received
2. Guest is prompted (through the same chat) to upload a photo of their CNIC or passport
3. Guest also confirms name, phone number, and stay dates alongside the photo
4. The record is stored against that booking, encrypted, and only visible to that host's organisation — never shared across hosts
5. Host's dashboard shows a clean, copyable version of each guest's record
6. Host manually enters that record into the government Hotel Eye portal themselves (there's no public API to automate this step — it's a deliberate scope boundary, not an oversight)
7. Host can export all records for a date range as a CSV, useful for audits or bulk entry
8. Records are deleted automatically after a defined retention period (still to be finalized — see open questions)

This is one of the few places in the product touching genuinely sensitive personal data, so the security details aren't optional extras: encryption at rest, signed time-limited URLs (never a permanent public link to someone's ID photo), strict per-organisation access control, and a privacy policy the guest actually sees before they upload anything.

## 7. Phase 2 & Phase 3 features (not in the first build)

Kept separate on purpose, so Phase 1 scope doesn't quietly creep while we're refining it.

**Phase 2 — retention features** (what keeps a host paying month to month)

- Upsells at booking or during the stay: late checkout, airport pickup, extra bed, driver, meals — this is the main way a host earns the subscription fee back, so it's arguably the most important Phase 2 item
- Post-checkout review collection, shown on the property page
- Repeat guest database and rebooking offers
- Cleaner/staff notifications on checkout
- Analytics: occupancy, revenue, enquiry-to-booking conversion, most common guest questions
- Airbnb iCal calendar sync — only if customers actually ask for it; not required for launch

**Phase 3 — later**

- Team accounts and role permissions
- Owner statements, for managers running units on behalf of other owners
- Booking.com channel connection
- Dynamic pricing suggestions

## 8. Open questions to refine next

- [ ] How do we verify the "also on Airbnb" badge? (proposal suggests a temporary code in the listing description)
- [ ] Can the AI quote a final total price, or only the nightly rate, with the host confirming the total?
- [ ] What happens if a guest asks about a refund mid-stay? Working assumption: automatic escalation to the host, AI does not answer.
- [ ] CNIC retention period — 90 days, or whatever the provincial legal requirement turns out to be (needs a legal check)
- [ ] Do we offer any guest-side guarantee at all, or is this explicitly a host tool with no guest protection? Affects trust, liability, and the terms of service.
- [ ] What does the guest actually see while waiting on the host during the Payment state handoff?
- [ ] Who owns sales and the one-week field validation before any code gets written?
