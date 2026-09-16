# Database Schema Design — Direct Booking Platform

| | |
|---|---|
| **Date** | 2026-09-15 |
| **Status** | Approved (Phase 1 scope) |
| **Source proposal** | `direct-booking-saas-proposal.md` |
| **Database** | Postgres via Supabase |

## Contents

1. [Scope](#scope)
2. [Key design decisions](#key-design-decisions)
3. [Entity relationship overview](#entity-relationship-overview)
4. [Table creation order](#table-creation-order)
5. [Schema reference](#schema-reference)
   - [5.1 `organizations`](#51-organizations--the-host-account)
   - [5.2 `properties`](#52-properties--one-listing-plus-its-ai-knowledge-base)
   - [5.3 `property_photos`](#53-property_photos)
   - [5.4 `availability_blocks`](#54-availability_blocks)
   - [5.5 `seasonal_pricing_rules`](#55-seasonal_pricing_rules)
   - [5.6 `guests`](#56-guests)
   - [5.7 `conversations`](#57-conversations--the-ai-state-machine)
   - [5.8 `messages`](#58-messages)
   - [5.9 `bookings`](#59-bookings)
   - [5.10 `guest_documents`](#510-guest_documents--hotel-eye-cnic-capture)
6. [AI state machine reference](#ai-state-machine-reference)
7. [Security & access control](#security--access-control-phase-1-non-negotiable-per-proposal)
8. [Explicitly out of scope](#explicitly-out-of-scope-for-this-schema)

---

## Scope

This schema covers **Phase 1 only** — host onboarding, public catalogue, availability
calendar, AI chat agent, host inbox, booking flow, Hotel Eye/CNIC capture. Phase 2/3
features (reviews, upsells, team accounts/roles, owner statements, channel sync) are
deliberately left out and will be added as new tables/columns when those phases start;
this schema is not pre-designed around them.

## Key design decisions

Confirmed with the product owner before writing the schema — these explain *why* the
tables look the way they do.

| # | Decision | Rationale |
|---|---|---|
| 1 | **Multi-tenancy:** shared schema, every table scoped by `organization_id`, isolated via Postgres Row-Level Security (RLS) | Standard Supabase pattern; appropriate at this scale (tens–low hundreds of hosts). No compliance requirement forces schema-per-tenant. |
| 2 | **No guest accounts** — guests identified by phone number, scoped per host | Avoids guest auth/session complexity entirely in Phase 1. |
| 3 | **One conversation per (guest, property)**, not per booking attempt | A guest's thread is ongoing; the AI's enquiry/payment/stay state lives on it. |
| 4 | **Knowledge base = structured columns on `properties`** + one freeform notes field, no retrieval system | The whole property row is fed to the AI as context — enough at a few hundred messages/month/property. |
| 5 | **Availability = date-range blocks**, not per-night rows | One table covers manual blocks and booking locks; a Postgres `EXCLUDE` constraint makes overlapping bookings physically impossible. |

## Entity relationship overview

```
organizations (host account)
  └─ properties (1 per listing)
       ├─ property_photos
       ├─ availability_blocks  (manual blocks + booking-locked dates)
       └─ seasonal_pricing_rules
  └─ guests (identified by phone, scoped per host)
       └─ conversations (1 per guest+property)
            ├─ messages
            └─ bookings (1 conversation can lead to booking(s))
                 └─ guest_documents (CNIC/passport for Hotel Eye)
```

## Table creation order

The schema reference below is ordered for readability (grouped by subsystem), **not**
migration order. `availability_blocks.booking_id` references `bookings`, which is
documented later in this doc. Create tables in this order when writing actual migrations:

```
1. organizations
2. properties
3. property_photos
4. guests
5. conversations
6. bookings
7. availability_blocks   (references bookings)
8. seasonal_pricing_rules
9. messages
10. guest_documents
```

---

## Schema reference

### 5.1 `organizations` — the host account

One row per host business. Created at signup; everything else hangs off it.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `owner_user_id` | `uuid` → `auth.users` | Phase 1 has exactly one owner per organization, no team members/roles yet. Phase 3 adds a `members` table with roles; this column is untouched by that. |
| `name` | `text` | Business-facing name, e.g. "Hunza View Guesthouse" |
| `slug` | `text` unique | Used in the public catalogue URL: `stay.ourapp.com/{slug}` |
| `contact_phone` | `text` | Shown on every property page — deliberate trust feature (anonymity is what scares guests off, proposal §4) |
| `contact_name` | `text` | Real host name, shown for the same reason |
| `contact_photo_url` | `text`, nullable | |
| `bio` | `text`, nullable | e.g. "Hosting since 2019" — shown for trust |
| `created_at` | `timestamptz` | |

```sql
create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  owner_user_id      uuid not null references auth.users(id),
  name               text not null,
  slug               text not null unique,
  contact_phone      text not null,
  contact_name       text not null,
  contact_photo_url  text,
  bio                text,
  created_at         timestamptz not null default now()
);
```

---

### 5.2 `properties` — one listing, plus its AI knowledge base

Each row is one bookable unit (guesthouse, cabin, apartment). The structured fields below
**are** the AI agent's entire knowledge base for that property — the AI is given the whole
row as context and must never answer from anything outside it. This is how the system
guarantees "a guest asking about Property A must never receive Property B's gate code."

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` → `organizations` | |
| `name` | `text` | |
| `slug` | `text` | Unique per org. Full public URL: `stay.ourapp.com/{org_slug}/{property_slug}` |
| `description` | `text`, nullable | |
| `address` | `text`, nullable | |
| `city` | `text`, nullable | |
| `max_guests` | `int` | |
| `nightly_rate_pkr` | `numeric` | Base rate; overridden per-date by `seasonal_pricing_rules` when one matches |
| `minimum_nights` | `int`, default `1` | Default minimum stay; overridable per date range |
| `status` | `text`, default `'draft'` | `draft` \| `published`. Lets a host build a listing incrementally before it's public |
| *— Knowledge base —* | | *Everything the AI agent is allowed to know and say* |
| `wifi_network` | `text`, nullable | |
| `wifi_password` | `text`, nullable | |
| `gate_code` | `text`, nullable | |
| `generator_instructions` | `text`, nullable | |
| `geyser_instructions` | `text`, nullable | |
| `ac_instructions` | `text`, nullable | |
| `parking_instructions` | `text`, nullable | |
| `checkin_time` | `time`, nullable | |
| `checkout_time` | `time`, nullable | |
| `directions` | `text`, nullable | |
| `nearby_recommendations` | `text`, nullable | |
| `house_rules` | `text`, nullable | |
| `additional_notes` | `text`, nullable | Freeform catch-all for anything not covered by a dedicated field above |
| *— Airbnb trust badge —* | | |
| `airbnb_listing_url` | `text`, nullable | |
| `airbnb_verification_code` | `text`, nullable | Temporary code the host places in their Airbnb listing description; checked once to prove ownership |
| `airbnb_verified` | `boolean`, default `false` | Badge is **only** shown when true. Displaying on URL alone is a fraud/liability risk the proposal explicitly warns against |
| `airbnb_verified_at` | `timestamptz`, nullable | |
| `created_at` | `timestamptz` | |

```sql
create table properties (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations(id),
  name                      text not null,
  slug                      text not null,
  description               text,
  address                   text,
  city                      text,
  max_guests                int not null,
  nightly_rate_pkr          numeric not null,
  minimum_nights            int not null default 1,
  status                    text not null default 'draft',

  wifi_network              text,
  wifi_password             text,
  gate_code                 text,
  generator_instructions    text,
  geyser_instructions       text,
  ac_instructions           text,
  parking_instructions      text,
  checkin_time              time,
  checkout_time             time,
  directions                text,
  nearby_recommendations    text,
  house_rules               text,
  additional_notes          text,

  airbnb_listing_url        text,
  airbnb_verification_code  text,
  airbnb_verified           boolean not null default false,
  airbnb_verified_at        timestamptz,

  created_at                timestamptz not null default now(),
  unique (organization_id, slug)
);
```

---

### 5.3 `property_photos`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `property_id` | `uuid` → `properties` | |
| `storage_path` | `text` | Path to the object in Supabase Storage — not a public URL, served via the storage API so access/compression/transformation stay controlled |
| `sort_order` | `int`, default `0` | Display order on the property page; first photo is the "hero" image |
| `created_at` | `timestamptz` | |

```sql
create table property_photos (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id),
  storage_path  text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
```

---

### 5.4 `availability_blocks`

Both manual host blocks and confirmed-booking blocks live in one table. A Postgres
`EXCLUDE` constraint — not application code — guarantees two ranges on the same property
can never overlap. This is the actual double-booking prevention mechanism.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `property_id` | `uuid` → `properties` | |
| `start_date` | `date` | |
| `end_date` | `date` | Exclusive (the checkout date) — a 2-night stay Oct 5→7 is stored as `start_date=Oct 5, end_date=Oct 7` |
| `reason` | `text` | `manual_block` (host blocked for personal use) \| `booking` (dates locked by an approved booking) |
| `booking_id` | `uuid` → `bookings`, nullable | Set only when `reason = 'booking'`. Traces the block back to its booking |
| `created_at` | `timestamptz` | |

**Constraints:**
- `check (end_date > start_date)`
- `exclude using gist (property_id with =, daterange(start_date, end_date) with &&)` — no two rows for the same property can have overlapping ranges, even under concurrent requests. Requires the `btree_gist` extension.

```sql
create extension if not exists btree_gist;

create table availability_blocks (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id),
  start_date    date not null,
  end_date      date not null,
  reason        text not null,
  booking_id    uuid references bookings(id),
  created_at    timestamptz not null default now(),
  check (end_date > start_date),
  exclude using gist (
    property_id with =,
    daterange(start_date, end_date) with &&
  )
);
```

---

### 5.5 `seasonal_pricing_rules`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `property_id` | `uuid` → `properties` | |
| `start_date` | `date` | |
| `end_date` | `date` | Exclusive, same convention as `availability_blocks` |
| `nightly_rate_pkr` | `numeric` | Overrides `properties.nightly_rate_pkr` for nights in this range (e.g. peak season in Naran) |
| `minimum_nights` | `int`, nullable | Overrides `properties.minimum_nights` for this range; `null` = use the property default |
| `created_at` | `timestamptz` | |

```sql
create table seasonal_pricing_rules (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references properties(id),
  start_date        date not null,
  end_date          date not null,
  nightly_rate_pkr  numeric not null,
  minimum_nights    int,
  created_at        timestamptz not null default now()
);
```

---

### 5.6 `guests`

Guests have no login. They're recognized only by phone number, scoped per host — the same
phone number talking to two different hosts creates two independent rows; there is no
cross-host guest identity.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` → `organizations` | |
| `phone` | `text` | Normalized phone number; the matching key used to recognize a repeat guest |
| `name` | `text`, nullable | |
| `created_at` | `timestamptz` | |

Unique on `(organization_id, phone)`.

```sql
create table guests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  phone             text not null,
  name              text,
  created_at        timestamptz not null default now(),
  unique (organization_id, phone)
);
```

---

### 5.7 `conversations` — the AI state machine

One ongoing thread per guest+property. A guest re-opening a property page later continues
the same conversation rather than starting a new one.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` → `organizations` | Denormalized from `property_id`/`guest_id` purely so RLS policies and queries don't need a join to check tenant ownership |
| `property_id` | `uuid` → `properties` | |
| `guest_id` | `uuid` → `guests` | |
| `ai_state` | `text`, default `'enquiry'` | `enquiry` \| `payment` \| `stay` — mirrors the linked booking's lifecycle stage |
| `ai_enabled` | `boolean`, default `true` | Whether the AI is currently allowed to send messages here |
| `ai_disabled_reason` | `text`, nullable | `null` \| `payment_state` \| `host_takeover` \| `escalation` — lets the host inbox show *why* the AI is silent |
| `last_message_at` | `timestamptz`, nullable | |
| `created_at` | `timestamptz` | |

Unique on `(property_id, guest_id)`.

**Safety-critical constraint:** `check (ai_state != 'payment' or ai_enabled = false)` — makes
it impossible, at the database level, for `ai_enabled` to ever be `true` while
`ai_state = 'payment'`. The AI must be "architecturally incapable" of replying during
payment, not merely instructed not to — this constraint is what enforces that guarantee.

```sql
create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id),
  property_id         uuid not null references properties(id),
  guest_id            uuid not null references guests(id),
  ai_state            text not null default 'enquiry',
  ai_enabled          boolean not null default true,
  ai_disabled_reason  text,
  last_message_at     timestamptz,
  created_at          timestamptz not null default now(),
  unique (property_id, guest_id),
  check (ai_state != 'payment' or ai_enabled = false)
);
```

---

### 5.8 `messages`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `conversation_id` | `uuid` → `conversations` | |
| `sender` | `text` | `ai` \| `host` \| `guest` |
| `body` | `text` | |
| `created_at` | `timestamptz` | Supabase Realtime subscribes to inserts here (filtered by `conversation_id`) to power the host's live inbox |

```sql
create table messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id),
  sender            text not null,
  body              text not null,
  created_at        timestamptz not null default now()
);
```

---

### 5.9 `bookings`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `organization_id` | `uuid` → `organizations` | |
| `property_id` | `uuid` → `properties` | |
| `guest_id` | `uuid` → `guests` | |
| `conversation_id` | `uuid` → `conversations` | The thread this booking request originated from |
| `check_in` | `date` | |
| `check_out` | `date` | Exclusive, same convention as `availability_blocks` |
| `guest_count` | `int` | |
| `total_price_pkr` | `numeric` | Computed at request time from `nightly_rate_pkr` / `seasonal_pricing_rules`. Stored, not recomputed later, so a future rate change doesn't retroactively alter a past booking's price |
| `advance_amount_pkr` | `numeric` | The 20–30% deposit amount (proposal §4's trust-building default) |
| `status` | `text`, default `'requested'` | `requested` → `approved` → `paid` → `staying` → `checked_out`, with side branches `rejected` / `cancelled` |
| `payment_confirmed_at` | `timestamptz`, nullable | |
| `payment_confirmed_by` | `uuid` → `auth.users`, nullable | Which host user marked payment received — accountability trail, since this is a manual, host-only action the AI never touches |
| `created_at` | `timestamptz` | |

**Constraint:** `check (check_out > check_in)`

**Status pipeline behavior:**
- The `availability_blocks` row for a booking is created only when `status` becomes
  `approved` — **not** at `requested`. This lets multiple guests request the same dates;
  the host picks one to approve, and the `exclude` constraint on `availability_blocks`
  then makes it impossible to approve a second, overlapping request.
- Approving a booking flips the linked conversation's `ai_state` to `payment`.
- Marking it `paid`/`staying` flips `ai_state` to `stay`.

```sql
create table bookings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id),
  property_id           uuid not null references properties(id),
  guest_id              uuid not null references guests(id),
  conversation_id       uuid not null references conversations(id),
  check_in              date not null,
  check_out             date not null,
  guest_count           int not null,
  total_price_pkr       numeric not null,
  advance_amount_pkr    numeric not null,
  status                text not null default 'requested',
  payment_confirmed_at  timestamptz,
  payment_confirmed_by  uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  check (check_out > check_in)
);
```

---

### 5.10 `guest_documents` — Hotel Eye (CNIC) capture

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` → `bookings` | |
| `organization_id` | `uuid` → `organizations` | Denormalized for RLS: this table holds sensitive CNIC/passport data and must be strictly isolated per host |
| `document_type` | `text` | `cnic` \| `passport` |
| `storage_path` | `text` | Private Supabase Storage bucket. Never served via public URL — always short-lived signed URLs, per the proposal's non-negotiable Phase 1 security requirements |
| `guest_full_name` | `text` | Name exactly as it appears on the ID document, for the Hotel Eye record — may differ from `guests.name` |
| `guest_phone` | `text`, nullable | |
| `uploaded_at` | `timestamptz` | |
| `retention_expires_at` | `timestamptz`, nullable | Set at upload = `uploaded_at` + retention policy period. A scheduled job deletes rows/files past this date. Exact period still an open question (pending legal review) — column exists now so deletion doesn't require a future migration |

```sql
create table guest_documents (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references bookings(id),
  organization_id       uuid not null references organizations(id),
  document_type         text not null,
  storage_path          text not null,
  guest_full_name       text not null,
  guest_phone           text,
  uploaded_at           timestamptz not null default now(),
  retention_expires_at  timestamptz
);
```

---

## AI state machine reference

| Situation | `ai_state` | `ai_enabled` | `ai_disabled_reason` |
|---|---|---|---|
| Normal enquiry, AI answering guest questions | `enquiry` | `true` | `null` |
| Host manually takes over a chat | `enquiry` / `stay` | `false` | `host_takeover` |
| AI doesn't know an answer, or guest asks for a human | `enquiry` / `stay` | `false` | `escalation` |
| Booking approved, payment pending | `payment` | `false` (forced by constraint) | `payment_state` |
| Host confirms payment received | `stay` | `true` | `null` |

When a host flips `ai_enabled` back to `true`, no special handling is needed for context —
the AI's next reply is generated from the full `messages` history, so it automatically sees
whatever the host said while it was off.

---

## Security & access control (Phase 1 non-negotiable, per proposal)

| Area | Approach |
|---|---|
| **Row-Level Security** | Every table scoped by `organization_id`; a host's Supabase session can only read/write its own organization's rows. Public catalogue/property pages use a separate, narrow read policy exposing only `properties` where `status = 'published'` — guest/booking/document tables are never publicly readable. |
| **Storage buckets** | `property_photos` and `guest_documents` are both private. Photos are served via transformed/signed URLs for performance; `guest_documents` additionally requires strict per-organization access control given it holds government ID data. |
| **Encryption at rest** | Handled by Supabase/Postgres infrastructure defaults; no additional application-level encryption designed here unless a future legal review requires it. |
| **Retention/deletion** | Prepared for via `guest_documents.retention_expires_at`, but the scheduled deletion job and exact retention period are not yet implemented — tracked as an open question in the source proposal (§12, Q4). |

## Explicitly out of scope for this schema

Per the source proposal's scope section, none of the following have tables here, and none
should be added speculatively:

- WhatsApp Business API integration
- Any Airbnb inbox/messaging/account integration or data scraping
- Payment processing/holding (guest payment is entirely off-platform, host-to-guest)
- Automatic Hotel Eye portal submission (we store the record; host submits it manually)
- Reviews, upsells, team roles/members, owner statements, channel sync — all Phase 2/3, to be designed when those phases actually start
