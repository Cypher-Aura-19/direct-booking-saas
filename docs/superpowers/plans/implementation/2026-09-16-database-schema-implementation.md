# Phase 1 Database Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Phase 1 database schema (`docs/superpowers/specs/2026-09-15-database-schema-design.md`) as a working, tested Supabase/Postgres project: 10 tables, their constraints, and Row-Level Security policies.

**Architecture:** Supabase CLI-managed Postgres migrations under `supabase/migrations/`, one migration per table (in the creation order the spec defines), each verified by a pgTAP test file under `supabase/tests/database/`. A final task adds RLS to every table. No application code (Next.js) is built in this plan — this plan produces the database layer only.

**Tech Stack:** Supabase CLI, local Postgres via `supabase start` (Docker), pgTAP for SQL-level testing (`supabase test db`), git for version control.

## Global Constraints

- Table names, column names, types, defaults, and constraints must match `docs/superpowers/specs/2026-09-15-database-schema-design.md` exactly — that document is the source of truth this plan implements.
- Tables must be created in the spec's documented order (`organizations` → `properties` → `property_photos` → `guests` → `conversations` → `bookings` → `availability_blocks` → `seasonal_pricing_rules` → `messages` → `guest_documents`) because `availability_blocks.booking_id` references `bookings`.
- All primary keys are `uuid default gen_random_uuid()`; all monetary columns are `numeric` PKR amounts; all date ranges use the exclusive-end-date convention (`end_date`/`check_out` is the checkout date, not included in the stay).
- **Guest-facing (unauthenticated) reads and writes — starting a conversation, sending a guest message, submitting a booking request, uploading a CNIC — happen through server-side Next.js routes using the Supabase **service role** key, which bypasses RLS entirely.** This is a direct consequence of the spec's "no guest accounts" decision: guests never hold a Supabase auth session, so they cannot satisfy `auth.uid()`-based policies. RLS in this plan exists for two purposes only: (1) letting an authenticated host's browser session query only their own organization's data directly, and (2) letting the **public** (anonymous, no login) browser safely read published listing data (properties, photos, availability, pricing, organization profile) directly via the anon key without a server round-trip. If this assumption is wrong for how the frontend will be built, flag it before Task 11 (RLS) — earlier tasks don't depend on it.
- Every task's migration must be applied via `supabase db reset` (which replays all migrations from scratch) before its test is run, so tests always run against the exact schema state the migrations produce.

---

### Task 1: Project scaffolding and extensions

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/migrations/00000000000001_extensions.sql`
- Test: `supabase/tests/database/00001_extensions_test.sql`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a running local Supabase Postgres instance with `pgcrypto` (for `gen_random_uuid()`) and `btree_gist` (required by the `availability_blocks` exclude constraint in Task 7) extensions enabled. All later tasks assume `supabase start` is running and these extensions exist.

- [ ] **Step 1: Initialize git and the Supabase project**

```bash
git init
supabase init
```

This creates `supabase/config.toml`, `supabase/migrations/`, and `supabase/seed.sql`. Commit the scaffold:

```bash
git add supabase .gitignore
git commit -m "chore: initialize supabase project scaffold"
```

- [ ] **Step 2: Start the local Supabase stack**

```bash
supabase start
```

Expected: Docker containers start; the command prints local API URL, DB URL, and keys. Leave this running for the rest of the plan — every `supabase db reset` and `supabase test db` command below needs it.

- [ ] **Step 3: Write the failing test**

```sql
-- supabase/tests/database/00001_extensions_test.sql
begin;
select plan(2);

select has_extension('pgcrypto');
select has_extension('btree_gist');

select * from finish();
rollback;
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: `00001_extensions_test.sql` reports `not ok 2 - Extension btree_gist should exist` (pgcrypto is enabled by default in Supabase's base image, btree_gist is not).

- [ ] **Step 5: Write the migration**

```sql
-- supabase/migrations/00000000000001_extensions.sql
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00001_extensions_test.sql` — 2/2 ok.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/00000000000001_extensions.sql supabase/tests/database/00001_extensions_test.sql
git commit -m "feat(db): enable pgcrypto and btree_gist extensions"
```

---

### Task 2: `organizations` table

**Files:**
- Create: `supabase/migrations/00000000000002_organizations.sql`
- Test: `supabase/tests/database/00002_organizations_test.sql`

**Interfaces:**
- Consumes: `extensions.pgcrypto` (Task 1) for `gen_random_uuid()`
- Produces: `organizations(id, owner_user_id, name, slug, contact_phone, contact_name, contact_photo_url, bio, created_at)`. Every later table with an `organization_id` column references `organizations(id)`.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00002_organizations_test.sql
begin;
select plan(6);

select has_table('organizations');
select columns_are('organizations', array[
  'id', 'owner_user_id', 'name', 'slug',
  'contact_phone', 'contact_name', 'contact_photo_url', 'bio',
  'created_at'
]);
select col_is_pk('organizations', 'id');

-- slug must be unique
select lives_ok(
  $$ insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
     values (gen_random_uuid(), 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan') $$,
  'can insert a valid organization'
);
select throws_ok(
  $$ insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
     values (gen_random_uuid(), 'Other Host', 'hunza-view', '03007654321', 'Sara Ahmed') $$,
  '23505',
  'duplicate slug is rejected'
);

-- required fields
select throws_ok(
  $$ insert into organizations (owner_user_id, slug, contact_phone, contact_name)
     values (gen_random_uuid(), 'no-name-org', '03001111111', 'No Name') $$,
  '23502',
  'name is required'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: `00002_organizations_test.sql` fails — `relation "organizations" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000002_organizations.sql
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00002_organizations_test.sql` — 6/6 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000002_organizations.sql supabase/tests/database/00002_organizations_test.sql
git commit -m "feat(db): add organizations table"
```

---

### Task 3: `properties` and `property_photos` tables

**Files:**
- Create: `supabase/migrations/00000000000003_properties.sql`
- Test: `supabase/tests/database/00003_properties_test.sql`

**Interfaces:**
- Consumes: `organizations(id)` (Task 2)
- Produces: `properties(id, organization_id, name, slug, description, address, city, max_guests, nightly_rate_pkr, minimum_nights, status, wifi_network, wifi_password, gate_code, generator_instructions, geyser_instructions, ac_instructions, parking_instructions, checkin_time, checkout_time, directions, nearby_recommendations, house_rules, additional_notes, airbnb_listing_url, airbnb_verification_code, airbnb_verified, airbnb_verified_at, created_at)` and `property_photos(id, property_id, storage_path, sort_order, created_at)`. Later tasks (`conversations`, `bookings`, `availability_blocks`, `seasonal_pricing_rules`) reference `properties(id)`.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00003_properties_test.sql
begin;
select plan(9);

select has_table('properties');
select columns_are('properties', array[
  'id', 'organization_id', 'name', 'slug', 'description', 'address', 'city',
  'max_guests', 'nightly_rate_pkr', 'minimum_nights', 'status',
  'wifi_network', 'wifi_password', 'gate_code', 'generator_instructions',
  'geyser_instructions', 'ac_instructions', 'parking_instructions',
  'checkin_time', 'checkout_time', 'directions', 'nearby_recommendations',
  'house_rules', 'additional_notes',
  'airbnb_listing_url', 'airbnb_verification_code', 'airbnb_verified', 'airbnb_verified_at',
  'created_at'
]);

select has_table('property_photos');
select columns_are('property_photos', array[
  'id', 'property_id', 'storage_path', 'sort_order', 'created_at'
]);

-- fixture
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');

select lives_ok(
  $$ insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
     select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view' $$,
  'can insert a minimal valid property'
);

select col_has_default('properties', 'status');
select is(
  (select status from properties where slug = 'deluxe-cabin'),
  'draft',
  'status defaults to draft'
);
select is(
  (select airbnb_verified from properties where slug = 'deluxe-cabin'),
  false,
  'airbnb_verified defaults to false'
);

-- slug unique per organization
select throws_ok(
  $$ insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
     select id, 'Duplicate Slug Cabin', 'deluxe-cabin', 2, 5000 from organizations where slug = 'hunza-view' $$,
  '23505',
  'duplicate slug within the same organization is rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "properties" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000003_properties.sql
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

create table property_photos (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id),
  storage_path  text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00003_properties_test.sql` — 9/9 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000003_properties.sql supabase/tests/database/00003_properties_test.sql
git commit -m "feat(db): add properties and property_photos tables"
```

---

### Task 4: `guests` table

**Files:**
- Create: `supabase/migrations/00000000000004_guests.sql`
- Test: `supabase/tests/database/00004_guests_test.sql`

**Interfaces:**
- Consumes: `organizations(id)` (Task 2)
- Produces: `guests(id, organization_id, phone, name, created_at)`. Later tasks (`conversations`, `bookings`) reference `guests(id)`.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00004_guests_test.sql
begin;
select plan(5);

select has_table('guests');
select columns_are('guests', array['id', 'organization_id', 'phone', 'name', 'created_at']);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');

select lives_ok(
  $$ insert into guests (organization_id, phone, name)
     select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view' $$,
  'can insert a guest with just a phone number and name'
);

-- same phone, same org -> rejected
select throws_ok(
  $$ insert into guests (organization_id, phone, name)
     select id, '03211234567', 'Bilal Again' from organizations where slug = 'hunza-view' $$,
  '23505',
  'duplicate phone within the same organization is rejected'
);

-- same phone, different org -> allowed (no cross-host guest identity)
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('22222222-2222-2222-2222-222222222222', 'Naran Cabins', 'naran-cabins', '03009999999', 'Sara Ahmed');

select lives_ok(
  $$ insert into guests (organization_id, phone, name)
     select id, '03211234567', 'Bilal' from organizations where slug = 'naran-cabins' $$,
  'same phone number is allowed under a different organization'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "guests" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000004_guests.sql
create table guests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  phone             text not null,
  name              text,
  created_at        timestamptz not null default now(),
  unique (organization_id, phone)
);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00004_guests_test.sql` — 5/5 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000004_guests.sql supabase/tests/database/00004_guests_test.sql
git commit -m "feat(db): add guests table"
```

---

### Task 5: `conversations` table (the AI state machine)

**Files:**
- Create: `supabase/migrations/00000000000005_conversations.sql`
- Test: `supabase/tests/database/00005_conversations_test.sql`

**Interfaces:**
- Consumes: `properties(id)` (Task 3), `guests(id)` (Task 4)
- Produces: `conversations(id, organization_id, property_id, guest_id, ai_state, ai_enabled, ai_disabled_reason, last_message_at, created_at)`, with the safety-critical constraint `check (ai_state != 'payment' or ai_enabled = false)`. Later tasks (`bookings`, `messages`) reference `conversations(id)`.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00005_conversations_test.sql
begin;
select plan(9);

select has_table('conversations');
select columns_are('conversations', array[
  'id', 'organization_id', 'property_id', 'guest_id',
  'ai_state', 'ai_enabled', 'ai_disabled_reason', 'last_message_at', 'created_at'
]);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';

-- defaults
select lives_ok(
  $$ insert into conversations (organization_id, property_id, guest_id)
     select o.id, p.id, g.id
     from organizations o, properties p, guests g
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  'can insert a conversation with just organization/property/guest'
);
select is(
  (select ai_state from conversations limit 1), 'enquiry', 'ai_state defaults to enquiry'
);
select is(
  (select ai_enabled from conversations limit 1), true, 'ai_enabled defaults to true'
);

-- one conversation per (property, guest)
select throws_ok(
  $$ insert into conversations (organization_id, property_id, guest_id)
     select o.id, p.id, g.id
     from organizations o, properties p, guests g
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  '23505',
  'a second conversation for the same guest+property is rejected'
);

-- the safety-critical constraint: ai_enabled can never be true while ai_state = payment
select throws_ok(
  $$ update conversations set ai_state = 'payment', ai_enabled = true $$,
  '23514',
  'ai_state=payment with ai_enabled=true violates the check constraint'
);
select lives_ok(
  $$ update conversations set ai_state = 'payment', ai_enabled = false $$,
  'ai_state=payment with ai_enabled=false is allowed'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "conversations" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000005_conversations.sql
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00005_conversations_test.sql` — 9/9 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000005_conversations.sql supabase/tests/database/00005_conversations_test.sql
git commit -m "feat(db): add conversations table with AI state machine constraint"
```

---

### Task 6: `bookings` table

**Files:**
- Create: `supabase/migrations/00000000000006_bookings.sql`
- Test: `supabase/tests/database/00006_bookings_test.sql`

**Interfaces:**
- Consumes: `properties(id)` (Task 3), `guests(id)` (Task 4), `conversations(id)` (Task 5)
- Produces: `bookings(id, organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr, status, payment_confirmed_at, payment_confirmed_by, created_at)`. Task 7 (`availability_blocks`) references `bookings(id)`.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00006_bookings_test.sql
begin;
select plan(6);

select has_table('bookings');
select columns_are('bookings', array[
  'id', 'organization_id', 'property_id', 'guest_id', 'conversation_id',
  'check_in', 'check_out', 'guest_count', 'total_price_pkr', 'advance_amount_pkr',
  'status', 'payment_confirmed_at', 'payment_confirmed_by', 'created_at'
]);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';
insert into conversations (organization_id, property_id, guest_id)
select o.id, p.id, g.id from organizations o, properties p, guests g
where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567';

select lives_ok(
  $$ insert into bookings (organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr)
     select o.id, p.id, g.id, c.id, '2026-10-05', '2026-10-07', 2, 16000, 4000
     from organizations o, properties p, guests g, conversations c
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  'can insert a valid booking'
);

select col_has_default('bookings', 'status');
select is(
  (select status from bookings limit 1), 'requested', 'status defaults to requested'
);

select throws_ok(
  $$ insert into bookings (organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr)
     select o.id, p.id, g.id, c.id, '2026-10-07', '2026-10-05', 2, 16000, 4000
     from organizations o, properties p, guests g, conversations c
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  '23514',
  'check_out before check_in is rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "bookings" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000006_bookings.sql
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00006_bookings_test.sql` — 6/6 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000006_bookings.sql supabase/tests/database/00006_bookings_test.sql
git commit -m "feat(db): add bookings table"
```

---

### Task 7: `availability_blocks` table (double-booking prevention)

**Files:**
- Create: `supabase/migrations/00000000000007_availability_blocks.sql`
- Test: `supabase/tests/database/00007_availability_blocks_test.sql`

**Interfaces:**
- Consumes: `properties(id)` (Task 3), `bookings(id)` (Task 6), `btree_gist` extension (Task 1)
- Produces: `availability_blocks(id, property_id, start_date, end_date, reason, booking_id, created_at)` with an `exclude using gist` constraint preventing overlapping ranges on the same property.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00007_availability_blocks_test.sql
begin;
select plan(6);

select has_table('availability_blocks');
select columns_are('availability_blocks', array[
  'id', 'property_id', 'start_date', 'end_date', 'reason', 'booking_id', 'created_at'
]);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';

select lives_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-05', '2026-10-07', 'manual_block' from properties where slug = 'deluxe-cabin' $$,
  'can insert a manual block'
);

-- overlapping range on the same property is rejected
select throws_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-06', '2026-10-09', 'manual_block' from properties where slug = 'deluxe-cabin' $$,
  '23P01',
  'an overlapping date range on the same property is rejected'
);

-- non-overlapping range on the same property is fine
select lives_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-07', '2026-10-10', 'manual_block' from properties where slug = 'deluxe-cabin' $$,
  'a non-overlapping, back-to-back date range is allowed (end_date is exclusive)'
);

-- same dates on a different property are fine
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Garden Room', 'garden-room', 2, 5000 from organizations where slug = 'hunza-view';
select lives_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-05', '2026-10-07', 'manual_block' from properties where slug = 'garden-room' $$,
  'the same date range on a different property is allowed'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "availability_blocks" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000007_availability_blocks.sql
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00007_availability_blocks_test.sql` — 6/6 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000007_availability_blocks.sql supabase/tests/database/00007_availability_blocks_test.sql
git commit -m "feat(db): add availability_blocks table with overlap-prevention constraint"
```

---

### Task 8: `seasonal_pricing_rules` table

**Files:**
- Create: `supabase/migrations/00000000000008_seasonal_pricing_rules.sql`
- Test: `supabase/tests/database/00008_seasonal_pricing_rules_test.sql`

**Interfaces:**
- Consumes: `properties(id)` (Task 3)
- Produces: `seasonal_pricing_rules(id, property_id, start_date, end_date, nightly_rate_pkr, minimum_nights, created_at)`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00008_seasonal_pricing_rules_test.sql
begin;
select plan(4);

select has_table('seasonal_pricing_rules');
select columns_are('seasonal_pricing_rules', array[
  'id', 'property_id', 'start_date', 'end_date', 'nightly_rate_pkr', 'minimum_nights', 'created_at'
]);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';

select lives_ok(
  $$ insert into seasonal_pricing_rules (property_id, start_date, end_date, nightly_rate_pkr)
     select id, '2026-06-01', '2026-08-31', 12000 from properties where slug = 'deluxe-cabin' $$,
  'can insert a seasonal rate override without a minimum_nights override'
);
select is(
  (select minimum_nights from seasonal_pricing_rules limit 1), null,
  'minimum_nights is nullable and defaults to null (use the property default)'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "seasonal_pricing_rules" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000008_seasonal_pricing_rules.sql
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00008_seasonal_pricing_rules_test.sql` — 4/4 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000008_seasonal_pricing_rules.sql supabase/tests/database/00008_seasonal_pricing_rules_test.sql
git commit -m "feat(db): add seasonal_pricing_rules table"
```

---

### Task 9: `messages` table

**Files:**
- Create: `supabase/migrations/00000000000009_messages.sql`
- Test: `supabase/tests/database/00009_messages_test.sql`

**Interfaces:**
- Consumes: `conversations(id)` (Task 5)
- Produces: `messages(id, conversation_id, sender, body, created_at)`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00009_messages_test.sql
begin;
select plan(4);

select has_table('messages');
select columns_are('messages', array['id', 'conversation_id', 'sender', 'body', 'created_at']);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';
insert into conversations (organization_id, property_id, guest_id)
select o.id, p.id, g.id from organizations o, properties p, guests g
where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567';

select lives_ok(
  $$ insert into messages (conversation_id, sender, body)
     select id, 'guest', 'Is Oct 5-7 available?' from conversations limit 1 $$,
  'can insert a guest message'
);
select lives_ok(
  $$ insert into messages (conversation_id, sender, body)
     select id, 'ai', 'Yes, those dates are available at PKR 8,000/night.' from conversations limit 1 $$,
  'can insert an ai message'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "messages" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000009_messages.sql
create table messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id),
  sender            text not null,
  body              text not null,
  created_at        timestamptz not null default now()
);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00009_messages_test.sql` — 4/4 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000009_messages.sql supabase/tests/database/00009_messages_test.sql
git commit -m "feat(db): add messages table"
```

---

### Task 10: `guest_documents` table (Hotel Eye / CNIC capture)

**Files:**
- Create: `supabase/migrations/00000000000010_guest_documents.sql`
- Test: `supabase/tests/database/00010_guest_documents_test.sql`

**Interfaces:**
- Consumes: `bookings(id)` (Task 6), `organizations(id)` (Task 2)
- Produces: `guest_documents(id, booking_id, organization_id, document_type, storage_path, guest_full_name, guest_phone, uploaded_at, retention_expires_at)`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00010_guest_documents_test.sql
begin;
select plan(4);

select has_table('guest_documents');
select columns_are('guest_documents', array[
  'id', 'booking_id', 'organization_id', 'document_type', 'storage_path',
  'guest_full_name', 'guest_phone', 'uploaded_at', 'retention_expires_at'
]);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';
insert into conversations (organization_id, property_id, guest_id)
select o.id, p.id, g.id from organizations o, properties p, guests g
where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567';
insert into bookings (organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr)
select o.id, p.id, g.id, c.id, '2026-10-05', '2026-10-07', 2, 16000, 4000
from organizations o, properties p, guests g, conversations c
where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567';

select lives_ok(
  $$ insert into guest_documents (booking_id, organization_id, document_type, storage_path, guest_full_name, retention_expires_at)
     select b.id, o.id, 'cnic', 'cnic/2026/10/bilal.jpg', 'Bilal Ahmed', now() + interval '90 days'
     from bookings b, organizations o where o.slug = 'hunza-view' $$,
  'can insert a guest document with a retention expiry'
);
select is(
  (select document_type from guest_documents limit 1), 'cnic', 'document_type is stored as given'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `relation "guest_documents" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000010_guest_documents.sql
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

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00010_guest_documents_test.sql` — 4/4 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000010_guest_documents.sql supabase/tests/database/00010_guest_documents_test.sql
git commit -m "feat(db): add guest_documents table"
```

---

### Task 11: Row-Level Security on every table

**Files:**
- Create: `supabase/migrations/00000000000011_row_level_security.sql`
- Test: `supabase/tests/database/00011_row_level_security_test.sql`

**Interfaces:**
- Consumes: all 10 tables (Tasks 2–10)
- Produces: RLS enabled on every table, a `private.owned_organization_ids()` helper function, and policies implementing: (a) public (anon + authenticated) read access to published listing data — `organizations`, published `properties`, their `property_photos`, `availability_blocks`, and `seasonal_pricing_rules`; (b) full read/write access for an authenticated host to rows belonging to organizations they own; (c) no direct public access at all to `guests`, `conversations`, `messages`, `bookings`, `guest_documents` — those are written/read by guests only through server-side routes using the service role key, per this plan's Global Constraints.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/00011_row_level_security_test.sql
begin;
select plan(6);

select is_rls_enabled('public', 'properties');
select is_rls_enabled('public', 'guests');

-- fixtures: two hosts, one published property each
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values
  ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan'),
  ('22222222-2222-2222-2222-222222222222', 'Naran Cabins', 'naran-cabins', '03009999999', 'Sara Ahmed');

insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr, status)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000, 'published' from organizations where slug = 'hunza-view';
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr, status)
select id, 'Hidden Draft', 'hidden-draft', 4, 8000, 'draft' from organizations where slug = 'hunza-view';

insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03221234567', 'Zara' from organizations where slug = 'naran-cabins';

-- anonymous (public) visitor: sees only the published property, never drafts
set local role anon;
select results_eq(
  $$ select slug from properties order by slug $$,
  $$ values ('deluxe-cabin'::text) $$,
  'anon can see only published properties'
);

-- anonymous visitor: cannot see any row in guests at all
select is_empty(
  $$ select 1 from guests $$,
  'anon sees zero rows in guests regardless of RLS filtering'
);

reset role;

-- authenticated host A: sees only their own guests, not host B's
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  $$ select phone from guests order by phone $$,
  $$ values ('03211234567'::text) $$,
  'host A sees only their own organization''s guests'
);

-- authenticated host A: can see their own draft property, host B never could anyway (no host B property here)
select results_eq(
  $$ select slug from properties order by slug $$,
  $$ values ('deluxe-cabin'::text), ('hidden-draft'::text) $$,
  'host A sees both their own published and draft properties'
);

reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
supabase db reset
supabase test db
```

Expected: fails — `is_rls_enabled` reports `false` for both tables, and the anon/authenticated role queries return every row (RLS not yet enabled means no filtering happens).

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/00000000000011_row_level_security.sql

create schema if not exists private;

create or replace function private.owned_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from organizations where owner_user_id = auth.uid();
$$;

-- organizations: public profile info is meant to be visible (host name/photo/phone
-- are a deliberate trust feature), only the owner can modify it.
alter table organizations enable row level security;

create policy "public can view organizations"
  on organizations for select
  to anon, authenticated
  using (true);

create policy "owner can manage their organization"
  on organizations for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- properties: public can see only published listings; the owning host sees/manages all.
alter table properties enable row level security;

create policy "public can view published properties"
  on properties for select
  to anon, authenticated
  using (status = 'published');

create policy "host can manage their own properties"
  on properties for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

-- property_photos: visible whenever the parent property is publicly visible.
alter table property_photos enable row level security;

create policy "public can view photos of published properties"
  on property_photos for select
  to anon, authenticated
  using (exists (
    select 1 from properties p
    where p.id = property_photos.property_id and p.status = 'published'
  ));

create policy "host can manage photos of their own properties"
  on property_photos for all
  to authenticated
  using (exists (
    select 1 from properties p
    where p.id = property_photos.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from properties p
    where p.id = property_photos.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ));

-- availability_blocks: guests need to see blocked dates on a published property's
-- calendar before requesting a booking.
alter table availability_blocks enable row level security;

create policy "public can view availability of published properties"
  on availability_blocks for select
  to anon, authenticated
  using (exists (
    select 1 from properties p
    where p.id = availability_blocks.property_id and p.status = 'published'
  ));

create policy "host can manage availability of their own properties"
  on availability_blocks for all
  to authenticated
  using (exists (
    select 1 from properties p
    where p.id = availability_blocks.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from properties p
    where p.id = availability_blocks.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ));

-- seasonal_pricing_rules: guests need to see priced-in date ranges to get a correct quote.
alter table seasonal_pricing_rules enable row level security;

create policy "public can view pricing of published properties"
  on seasonal_pricing_rules for select
  to anon, authenticated
  using (exists (
    select 1 from properties p
    where p.id = seasonal_pricing_rules.property_id and p.status = 'published'
  ));

create policy "host can manage pricing of their own properties"
  on seasonal_pricing_rules for all
  to authenticated
  using (exists (
    select 1 from properties p
    where p.id = seasonal_pricing_rules.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from properties p
    where p.id = seasonal_pricing_rules.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ));

-- guests, conversations, messages, bookings, guest_documents: never publicly readable
-- or writable. Guest-facing access goes through server routes using the service role
-- key (which bypasses RLS). These policies exist only for the authenticated host dashboard.

alter table guests enable row level security;

create policy "host can manage their own guests"
  on guests for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

alter table conversations enable row level security;

create policy "host can manage their own conversations"
  on conversations for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

alter table messages enable row level security;

create policy "host can manage messages in their own conversations"
  on messages for all
  to authenticated
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and c.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and c.organization_id in (select private.owned_organization_ids())
  ));

alter table bookings enable row level security;

create policy "host can manage their own bookings"
  on bookings for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

alter table guest_documents enable row level security;

create policy "host can manage their own guest documents"
  on guest_documents for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
supabase db reset
supabase test db
```

Expected: `00011_row_level_security_test.sql` — 6/6 ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00000000000011_row_level_security.sql supabase/tests/database/00011_row_level_security_test.sql
git commit -m "feat(db): enable row-level security on all tables"
```

---

## Plan-level verification

After Task 11, run the full test suite once end-to-end to confirm nothing earlier regressed:

```bash
supabase db reset
supabase test db
```

Expected: all 11 test files pass (organizations, properties/property_photos, guests, conversations, bookings, availability_blocks, seasonal_pricing_rules, messages, guest_documents, row_level_security — plus extensions). This is the Phase 1 database schema, fully implemented and tested; the next plan (not part of this one) is the Next.js application layer that reads and writes through it.
