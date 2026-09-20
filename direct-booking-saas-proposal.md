# Direct Booking Platform for Pakistani Hosts
### Project Proposal v2

---

## 1. What we are building

A standalone booking platform for Pakistani guesthouse, cabin and serviced apartment owners who take bookings outside Airbnb.

This is not an Airbnb tool and it is not an Airbnb add-on. It is a self-contained system for hosts who already sell through WhatsApp, Instagram, Facebook, referrals and repeat guests, but have no proper booking system behind it.

Each host gets:

- A public catalogue page listing all their properties
- One shareable link for their Instagram bio, WhatsApp status and Facebook page
- A live availability calendar guests can see and book against
- An AI agent that answers guest questions about each property
- A unified inbox where the host can watch every AI conversation live, take over any chat, and hand it back
- A booking request flow, with payment handled by the host directly
- Automatic guest CNIC collection for Hotel Eye compliance

---

## 2. Why now

**Airbnb just raised host fees.** Airbnb has moved from a split fee (about 3 percent from the host, about 14 percent from the guest) to a single host-only fee of about 15.5 percent taken entirely from the host payout. For hosts outside the EEA this becomes mandatory on 15 September 2026.

On a 100,000 PKR month that is roughly 15,500 PKR gone instead of 3,000 PKR. Every host is feeling this right now, and it makes the case for owning your own booking channel far easier to argue than it was six months ago.

**Hotel Eye is now enforced.** Punjab has made registration on the Hotel Eye system mandatory for all guest houses and residential service providers, with guest CNIC data entered on arrival. Failure to comply is treated as a criminal offence under the Punjab Information of Temporary Residence Act 2015. The system is already in use in Islamabad and Sindh districts are enforcing it under the National Action Plan.

Every host must collect a CNIC from every guest, every single check-in, by law, with no decent tooling for it. That is a recurring pain with a legal penalty attached, which is the kind of problem people pay to remove.

**Nobody serves this market.** Western tools (Lodgify, Hostaway, Guesty, Hospitable) cost 12 to 40 USD per property per month, bill in USD, assume card payments, and have no concept of Hotel Eye.

---

## 3. Who we are selling to

**Target customer:** operators running roughly 5 to 25 rooms or units.

- Guesthouse and cabin owners in Murree, Bhurban, Nathiagali, Naran, Swat, Hunza and Skardu
- Serviced apartment operators in Islamabad, Lahore and Karachi
- Small property managers handling several owners' units

**Why not the single apartment owner:** the average Pakistani short term rental listing grosses roughly 150 to 300 USD per month at around 23 percent occupancy. That host has about 7 bookings a month and no real operational pain. Selling to them means 400 separate sales for a small revenue number. One 20-unit operator is worth twenty of them and is a single conversation.

**The critical qualifying question.** We are a booking system, not a marketplace. We do not generate demand. The host must already have their own audience through Instagram, WhatsApp, Facebook, tour operators or repeat guests. If a host's bookings come entirely from Airbnb search, they are not our customer and we should not sell to them.

This is the single biggest risk in the project and it is a sales discipline problem, not an engineering one.

---

## 4. Trust is the core product problem

Airbnb's real product is not software. It is trust. A guest sends money to a stranger because Airbnb sits in the middle and will refund them.

Our hosts have no such backing. A guest landing on a page they have never heard of, being asked to transfer an advance to a personal bank account, has every reason to hesitate. This is the thing most likely to stop bookings converting, so we design around it deliberately.

**How we build trust into the product:**

- **Small advance, rest on arrival.** Default to a 20 to 30 percent advance with the balance paid in cash at check-in. This is already how Pakistani guesthouses operate, so it matches guest expectations and lowers the guest's exposure.
- **The host is visible.** Real name, real photo, real phone number, property address, years hosting. Anonymity is what scares people.
- **Verified badges.** See below.
- **Real reviews from past guests**, collected after checkout.
- **Clear cancellation and refund terms** shown before the guest commits.

### The "also listed on Airbnb" badge

A host can add their Airbnb listing URL. We display a plain text badge on the property page stating that the property is also listed on Airbnb, with a link the guest can click to see the listing, its reviews and its rating. This borrows credibility the host has already earned.

Three rules on this:

1. **It must be verified.** Anyone can paste any URL. If we display an unverified badge we are vouching for something we never checked, and if a guest is defrauded we carry part of that. Verification method to be decided, likely asking the host to temporarily place a short code in their Airbnb listing description that we check once.
2. **Plain text only, no Airbnb logo or branding.** Saying a property is also listed on Airbnb is a factual statement. Using their mark implies endorsement and is a trademark problem.
3. **The link is one way.** We link out to Airbnb as proof. We never pull data from it and we never encourage a host to move an Airbnb guest over. What a host does with their own Airbnb guests is their business and outside our product.

---

## 5. Scope

### In scope

A self-contained booking and guest operations system that lives entirely on our infrastructure, with its own calendar, its own inbox and its own guest records.

### Out of scope

| Not building | Reason |
|---|---|
| WhatsApp Business API | Out of scope for this project. The AI runs on our web chat only. Revisit later if customers demand it. |
| Any integration with the Airbnb inbox, messaging or account | No public API. Any workaround risks the host's account. |
| Scraping Airbnb listing data | Brittle, against their terms, and unnecessary. Hosts enter their own details. |
| Holding or processing guest payments | Requires SBP licensing and drags us into refunds, cancellations and disputes. The host collects directly. |
| Automatic submission to the Hotel Eye portal | No public API. We prepare the record, the host submits it. |
| Generating demand for hosts | We are not a marketplace. This must be said out loud in every sales conversation. |

### Airbnb calendar sync: optional, decide later

If a host also lists on Airbnb, there is a risk of double booking. Airbnb supports free iCal import and export, so we could read their Airbnb calendar to block our dates and publish our own `.ics` feed for them to import.

This is cheap to build and genuinely useful, but it is **not** required for launch and it is not what the product is about. Two known limits if we do it: iCal refreshes every few hours rather than instantly, and it only carries that platform's own bookings.

**Decision: leave it out of Phase 1. Add it in Phase 2 only if customers ask.**

---

## 6. How the product works

### The guest journey

1. Guest clicks the host's link from Instagram, WhatsApp or Facebook
2. Sees the host's catalogue of properties
3. Opens a property, sees photos, price, amenities and a live availability calendar
4. Chats with the AI agent about the property, the area, the rules, anything
5. Picks dates and submits a booking request
6. **AI hands off to the host for payment**
7. Host confirms payment received and marks the booking confirmed
8. **AI reactivates** and handles the guest for the rest of the stay
9. Guest uploads CNIC for Hotel Eye
10. After checkout, guest is asked for a review

### The three AI states

This is a core design decision and should be built as an explicit state machine, not as scattered conditionals.

| State | AI status | Who is talking |
|---|---|---|
| **Enquiry** | Active | AI answers questions, quotes price, checks availability, takes the booking request |
| **Payment** | Suspended automatically | Host only. AI does not discuss, quote, confirm or handle money under any circumstance. |
| **Stay** | Reactivated by host after confirming payment | AI handles check-in details, wifi, house questions, local recommendations, checkout |

Suspending the AI around money is deliberate. It removes any possibility of the AI confirming a payment that never arrived, quoting a wrong amount, or making a refund commitment we cannot honour. It is a safety boundary, not a missing feature.

### The host inbox

The host sees every conversation in one place, exactly like a normal chat inbox.

- Live view: the host can sit in a chat and watch the AI reply in real time
- Per-chat AI toggle: the host flips the AI off for that one conversation, types himself, then flips it back on
- The AI reads the messages the host sent while it was off, so it stays in context when it resumes
- Clear visual marker on every message showing whether it came from the AI or the host
- Unread counts, search, and filter by property or booking status
- Escalation: if the AI does not know an answer or the guest asks for a human, the host is alerted and the AI pauses that chat on its own

---

## 7. Feature list

### Phase 1: Core product (target 6 to 8 weeks)

**Host onboarding**
- Sign up, create organisation
- Add properties: name, description, photos, nightly rate, rules, max guests, address
- Property knowledge base: wifi password, gate code, geyser and generator instructions, AC, parking, checkout time, directions, nearby food and attractions
- Optional Airbnb listing URL for the trust badge, with verification

**Public catalogue**
- One page per host listing all properties, for example `stay.ourapp.com/hunza-view`
- One page per property with photos, price, amenities, live availability calendar, host profile, reviews and badges
- Mobile first. Nearly all traffic will be an Instagram bio tap on a phone.
- Fast on slow connections. Aggressive image compression, lazy loading.

**Availability calendar**
- Host blocks dates manually
- Confirmed bookings block automatically
- Guests see real availability before requesting, so we stop wasting everyone's time on unavailable dates
- Minimum stay and seasonal pricing rules

**AI agent**
- Chat on every property page
- Answers only from that property's knowledge base plus live availability and pricing
- English, Urdu and Roman Urdu
- Never invents an answer about price or availability, always reads live data
- Automatically suspends at the payment stage
- Escalates to the host and pauses when it does not know something or the guest asks for a person

**Host inbox**
- All conversations in one view, live
- Per-chat AI on and off toggle with context retention
- AI versus host message labelling
- Alerts on escalation and on new booking requests

**Booking flow**
- Guest picks dates, sees live availability, submits a request
- Host approves or rejects
- On approval the AI suspends and the host handles payment directly by Raast, bank transfer, JazzCash or Easypaisa
- Host marks payment received, booking is confirmed, AI reactivates
- Guest gets a confirmation with check-in details

**Hotel Eye capture**
- After confirmation the guest uploads a CNIC or passport photo plus name, phone and stay dates
- Host dashboard shows a clean, copyable record per guest
- CSV export

**Host dashboard**
- Properties, bookings, guests, calendar, inbox
- Booking status pipeline: requested, approved, paid, staying, checked out

### Phase 2: Retention features

- Upsells at booking and during the stay: late checkout, airport pickup, extra bed, driver, meals. This is how the host earns our fee back and it is our strongest retention lever.
- Post-checkout review collection, displayed on the property page
- Repeat guest database and rebooking offers
- Cleaner and staff notifications on checkout
- Analytics: occupancy, revenue, enquiry to booking conversion, most common guest questions
- Airbnb iCal sync, only if customers ask for it

### Phase 3: Later

- Team accounts and role permissions
- Owner statements for managers handling other people's units
- Booking.com channel connection
- Dynamic pricing suggestions

---

## 8. Technical approach

**Stack**
- Frontend and backend: Next.js
- Database, auth, storage and realtime: Supabase
- LLM: Gemini Flash or DeepSeek. Inference for a few hundred messages a month costs cents per property, so model cost is not a constraint on pricing.
- Hosting: Vercel

**Notes**
- The inbox needs realtime. Supabase realtime channels should cover it without extra infrastructure.
- The AI state (enquiry, payment, stay) belongs on the conversation record, enforced server side. The AI must be incapable of replying during the payment state, not merely instructed not to.
- Knowledge base retrieval is per property. A guest asking about Property A must never receive Property B's gate code.

**Security.** We will store CNIC and passport images. That makes us a custodian of sensitive personal data with real liability. Non-negotiable and part of Phase 1, not later: encryption at rest, signed time limited URLs, strict per-organisation access control, a defined retention period with automatic deletion, and a written privacy policy the guest sees before uploading.

---

## 9. Pricing and billing

**Price:** 2,500 to 3,500 PKR per month for a small operator, moving to per-unit pricing above roughly 10 units, targeting 1,200 to 1,500 PKR per unit at volume.

**Collection.** Stripe through a US LLC is the preferred rail but cannot be the only one. Most Pakistani debit cards are not enabled for international recurring payments and many hosts will not enter card details on a foreign site. We need a local fallback from day one: bank transfer, Easypaisa, JazzCash, or PayPro which supports recurring PKR billing.

**Recommendation:** push annual prepay with a discount. It removes eleven chances for a payment to fail and fixes cash position early.

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Host has no audience of their own, so the catalogue gets no traffic | High | Qualify hard in sales. Never promise demand. Walk away from Airbnb-dependent hosts. |
| Guests do not trust an unknown site enough to send an advance | High | Small advance with balance on arrival, visible host identity, verified badges, real reviews |
| CNIC data breach | High | Encryption, access control, retention limits, legal review before launch |
| We badge a listing that is not really the host's | Medium | Verification required before the badge shows. No unverified badges, ever. |
| AI quotes a wrong price or confirms an unpaid booking | Medium | AI reads live data only, and is hard blocked during the payment state |
| Monthly payment collection fails | Medium | Local rails plus annual prepay |
| Small total market | Medium | Target multi-unit operators, not single-property owners |
| Host churns after one slow season | Medium | Upsell features and repeat guest tooling in Phase 2 |

---

## 11. Validation step before we write code

One week. No development.

Find 10 to 15 guesthouse and serviced apartment operators in Murree, Naran, Hunza, Skardu and Islamabad. Ask three questions:

1. How many of last month's bookings came from WhatsApp, Instagram or referrals rather than Airbnb?
2. How do you currently handle Hotel Eye?
3. What did you pay anyone last month to help you run this property?

**Go signal:** direct bookings are a meaningful share of their volume, and Hotel Eye comes up as a complaint without us prompting it.

**Stop signal:** they depend entirely on Airbnb for demand, or Hotel Eye is not actually a problem for them.

If we get the go signal, Phase 1 starts the same week.

---

## 12. Open questions for discussion

1. How do we verify the Airbnb badge? Temporary code in the listing description, or something simpler?
2. Do we let the AI quote a final price, or only a nightly rate with the total confirmed by the host?
3. What happens if a guest asks the AI about a refund during the stay? Proposal: automatic escalation to the host, AI does not answer.
4. CNIC retention period. 90 days, or whatever the provincial requirement turns out to be? Needs a legal check.
5. Do we offer any guest-side guarantee at all, or is the platform explicitly a tool for the host with no guest protection? This affects trust, liability and how we write the terms of service.
6. Who owns sales and the field validation week?
