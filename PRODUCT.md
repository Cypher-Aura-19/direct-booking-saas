# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **The host (paying customer).** Operators of Pakistani guesthouses, cabins and serviced apartments with roughly 5–25 units. They already sell through WhatsApp, Instagram, Facebook and repeat guests but have no booking system behind it. They run the business from a mid-range Android phone, often outdoors, between other jobs. Job: see whether anything needs them right now, approve bookings, set up properties, take over guest chats, keep Hotel Eye (CNIC) records.
- **The guest.** Never logs in. Taps a link from an Instagram bio or WhatsApp, usually on mobile data in a hill station. Job: decide whether a stranger's place is real and safe, ask questions, request dates, pay an advance directly to the host.

## Product Purpose

Gives hosts who already have an audience their own direct-booking channel: a public catalogue and property pages, an AI chat agent that answers from each property's knowledge base, a live calendar, one inbox, and Hotel Eye CNIC capture. Success means a host takes bookings without paying Airbnb's 15.5% host fee and stays compliant with Punjab's Hotel Eye registration.

## Positioning

Not a marketplace and not an Airbnb clone. It never generates demand and never holds guest money. The AI agent is blocked from anything to do with money by a database constraint that no host can override. That rule is both a liability shield and a selling point.

## Operating Context

- Guest arrival path: an Instagram or WhatsApp tap → the public property page on a `stay.` subdomain → embedded chat → booking request → advance paid by bank transfer, Easypaisa or JazzCash directly to the host.
- Host daily loop: dashboard home ("does anything need me?"), inbox, calendar, properties, settings. Bottom tab bar on mobile (Home, Inbox, Calendar, More); sidebar on desktop.
- The host copies CNIC details into the government Hotel Eye portal by hand.

## Capabilities and Constraints

- Stack: Next.js 16, Supabase, Tailwind v4, Vercel.
- Light-first (D-16); dark mode optional later.
- English, Urdu (Nastaliq, RTL, weights 400/700 only) and Roman Urdu. All layout uses CSS logical properties.
- Public guest pages must render within 3 seconds on throttled slow 3G.
- Out of scope for Phase 1: guest reviews, WhatsApp Business API, Airbnb integration, holding payments, cross-host search.
- Authoritative spec: `docs/superpowers/specs/2026-09-20-phase-1-design.md`.

## Brand Commitments

- Product name: **Qayam** (Urdu قیام, "a stay, a place to rest"). Chosen 2026-09-25 when the user asked Claude to name the app. It replaces the placeholder "Direct Booking Platform".
- 2026-09-25: the user rejected the original orange-accent token set (spec §8) and asked for a new palette. The spec's non-visual principles still apply: calm, spacious, hierarchy from typography, one job per screen, written empty states.
- The Airbnb trust badge is plain text with no Airbnb branding (TRUST-04).

## Evidence on Hand

- Design reference: `docs/reference/inspiration-staygo-orbix.webp`. It was supplied for its neatness, calm and spaciousness only, not as a component library to copy.
- There are no real customers, testimonials, prices or usage numbers. Do not fabricate any.

## Product Principles

1. The host dashboard gets out of the way. It answers "does anything need me?" first.
2. The guest page makes a place feel real and safe to a stranger.
3. The platform never touches money, and the UI never implies that it does.
4. Built for a phone in sunlight on a slow connection.
5. Urdu is a first-class language, not a retrofit.

## Accessibility & Inclusion

44px minimum touch targets. RTL mirroring for Urdu. Readable outdoors on mid-range Android screens.
