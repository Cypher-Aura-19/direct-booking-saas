# M2 Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every Phase 1 database table, the double-booking exclusion constraint, the AI payment-state safety constraint, row-level security on every table, and a test that proves a host from one organisation cannot read another organisation's rows.

**Architecture:** Ten tables in the `public` schema, created by ten ordered SQL migrations under `supabase/migrations/`. Every host-owned table is protected by an RLS policy driven by two SQL helper functions (`owns_organization`, `owns_property`) that walk the ownership chain back to `auth.users`, so a policy is always one function call, never a hand-copied subquery. The AI payment-state block (DB-09) is enforced by a `BEFORE INSERT` trigger, not an RLS policy — triggers fire regardless of which role performs the insert, including the service-role key server routes will use from M7 onward, so the money-block stays non-overridable even by our own backend code. Tests connect directly to the local Postgres instance with the `pg` driver and either stay as the superuser (for schema and constraint tests, which have nothing to do with RLS) or switch the session to `authenticated`/`anon` with a forged `request.jwt.claims` GUC (for the two tests that specifically prove RLS enforcement) — this is Supabase's own documented RLS-testing technique and avoids the network overhead and flakiness of driving everything through real HTTP sign-ins.

**Tech Stack:** Supabase CLI 2.117.0 (local Postgres 17), `pg` 8.23.0, `@supabase/supabase-js` 2.117.0, Node's built-in test runner (already the root convention from M1).

## Global Constraints

Copied verbatim or directly derived from `docs/superpowers/specs/2026-09-20-phase-1-design.md` and `docs/superpowers/plans/2026-09-20-m1-foundation.md`. These apply to every task below.

- **The AI money-block is not host-overridable.** It must be enforced by a database constraint/trigger that fires for every role, including the service-role key, not by an RLS policy (which the service role bypasses) and not by application code (which can have bugs). This is a deliberate liability shield, not a suggestion.
- **Row-level security is enabled on every table, with no exceptions.** A table added later without RLS is a regression — Task 9's sweep test exists specifically to catch that.
- **All monetary values are integer cents** (`*_cents` columns). Never store money as `float`/`numeric` with implied decimal places, and never as a bare integer without the `_cents` suffix — the suffix is the contract that prevents a future column from being misread as whole currency units.
- **Every test that proves a requirement carries a `// @req <ID>` comment** immediately above it, with an ID that exists in `docs/requirements.md`. The auditor (`scripts/audit.mjs`) scans every `*.test.mjs` file in the repo regardless of which npm script runs it, so this applies to `tests/db/**` exactly as it did to `tests/**` in M1.
- **This machine is shared with unrelated projects.** Never stop, restart, remove or reconfigure a Docker container, volume or network you did not create. A second Supabase stack (project id `platform`) may be running here and must stay running. If a port collides, change *our* port and report it — do not clear the obstacle.
- **Node's test runner needs glob arguments, not directories.** `node --test some/dir/` fails under Node 24.11.1 with `MODULE_NOT_FOUND`. Always use a glob: `node --test "tests/**/*.test.mjs"`.
- **`npm test` now requires the local Supabase stack to be running.** Run `npm run db:start` first. This is a new, real constraint this milestone introduces — call it out in the task 9 commit and in any README note, since M1 did not require this.
- **On Windows, invoke `npx` as `npx.cmd`.** `execFileSync("npx", ...)` fails on Windows because `npx` is a shell shim, not a direct executable.

**Commit after every task.** Never mark a step done without running the command and reading its output.

---

## File Structure

```
/
├─ package.json                              add: pg, @supabase/supabase-js devDependencies
├─ .github/workflows/ci.yml                  modify: start/stop the Supabase stack around the test step
├─ supabase/
│  ├─ seed.sql                                NEW — empty, so `db reset` has a file to find
│  └─ migrations/
│     ├─ 20260922010000_organizations.sql
│     ├─ 20260922020000_properties.sql
│     ├─ 20260922030000_property_photos_and_pricing.sql
│     ├─ 20260922040000_availability_blocks.sql
│     ├─ 20260922050000_conversations.sql
│     ├─ 20260922060000_messages.sql
│     ├─ 20260922070000_guests_and_documents.sql
│     └─ 20260922080000_bookings.sql
└─ tests/
   └─ db/
      ├─ helpers.mjs                          pg + supabase-js test utilities (no filesystem/pure-function split needed — this is glue code, not audited logic)
      ├─ organizations.test.mjs               DB-01, DB-14, SEC-02
      ├─ properties.test.mjs                  DB-02, DB-15
      ├─ property-photos-and-pricing.test.mjs DB-03, DB-04
      ├─ availability-blocks.test.mjs         DB-05, DB-06
      ├─ conversations.test.mjs               DB-07, DB-16
      ├─ messages.test.mjs                    DB-08, DB-09
      ├─ guests-and-documents.test.mjs        DB-11, DB-12
      ├─ bookings.test.mjs                    DB-10
      └─ rls-sweep.test.mjs                   DB-13
```

**Why raw `pg` instead of the Supabase JS client for most tests:** schema shape, check constraints, the exclusion constraint and the payment-state trigger have nothing to do with RLS — they're true regardless of which role touches the table. Testing them through a superuser Postgres connection is direct and fast. RLS enforcement itself is only two behaviours (DB-14: a host can't cross-read; DB-15: anon sees only published) and those get the real role-switching treatment.

---

## Task 1: Test harness, `organizations` table, and the cross-organisation RLS proof

**Files:**
- Create: `tests/db/helpers.mjs`
- Create: `tests/db/organizations.test.mjs`
- Create: `supabase/seed.sql`
- Create: `supabase/migrations/20260922010000_organizations.sql`
- Modify: `package.json` (add `pg`, `@supabase/supabase-js`)

**Interfaces:**
- Consumes: local Supabase stack (`npm run db:start`), already provisioned in M1
- Produces: `supabaseEnv()`, `withDb(fn)`, `actAsAuthenticated(db, userId)`, `createTestHost()`, `insertOrg(db, ownerId, overrides?)` — every later task's tests import these from `tests/db/helpers.mjs`. The `organizations` table and the `owns_organization(org_id uuid)` SQL function, which every later table's RLS policy calls.

- [ ] **Step 1: Install the test dependencies**

Run: `npm install --save-dev pg@8.23.0 @supabase/supabase-js@2.117.0`
Expected: both appear in root `package.json` devDependencies and `package-lock.json` updates.

- [ ] **Step 2: Add the empty seed file**

`supabase/config.toml` already points `[db.seed] sql_paths` at `./seed.sql`, but the file doesn't exist. `supabase db reset` will run repeatedly through this milestone, so create it now.

Create `supabase/seed.sql`:

```sql
-- Intentionally empty. Phase 1 has no fixture data that belongs in every
-- environment; test data is created and torn down by the test suite itself.
```

- [ ] **Step 3: Write the test harness**

Create `tests/db/helpers.mjs`:

```js
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

let cachedEnv;

// Reads connection info from the running local stack instead of hardcoding
// ports or keys, so this keeps working if either ever changes.
export function supabaseEnv() {
  if (cachedEnv) return cachedEnv;
  const raw = execFileSync(NPX, ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
  });
  const status = JSON.parse(raw);
  cachedEnv = {
    dbUrl: status.DB_URL,
    apiUrl: status.API_URL,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
  return cachedEnv;
}

// Runs `fn` inside a transaction that is always rolled back, so tests never
// need to clean up the rows they insert. Only real auth.users rows created
// via createTestHost() live outside this transaction and need cleanup().
export async function withDb(fn) {
  const { dbUrl } = supabaseEnv();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    try {
      await client.query("rollback");
    } catch {
      // Transaction may already be aborted by an expected failed query.
    }
    await client.end();
  }
}

// Switches the current session to the `authenticated` role with a forged
// JWT claim, exactly as PostgREST would for a real logged-in host. This is
// Supabase's own documented technique for testing RLS without a live
// HTTP round trip through GoTrue for every assertion.
export async function actAsAuthenticated(db, userId) {
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

let counter = 0;

// Creates a real row in auth.users via the local GoTrue admin API. Callers
// must call cleanup() so repeated local test runs don't accumulate users.
export async function createTestHost() {
  const { apiUrl, serviceRoleKey } = supabaseEnv();
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `test-host-${Date.now()}-${counter++}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Test-password-123!",
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  return {
    userId,
    async cleanup() {
      await admin.auth.admin.deleteUser(userId);
    },
  };
}

// Inserts an organisation owned by `ownerId`. Runs under whatever role is
// active on `db` — pass a plain superuser connection for schema tests, or
// call actAsAuthenticated first to exercise RLS.
export async function insertOrg(db, ownerId, overrides = {}) {
  const org = {
    slug: `org-${Date.now()}-${counter++}`,
    name: "Test Org",
    ...overrides,
  };
  const { rows } = await db.query(
    `insert into public.organizations (owner_id, slug, name)
     values ($1, $2, $3) returning id`,
    [ownerId, org.slug, org.name],
  );
  return rows[0].id;
}
```

- [ ] **Step 4: Write the failing tests**

Create `tests/db/organizations.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, actAsAuthenticated, createTestHost, insertOrg } from "./helpers.mjs";

// @req DB-01
test("organizations table stores slug, profile, payment instructions, policies, badge and account status", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const { rows } = await db.query(
        `insert into public.organizations (owner_id, slug, name)
         values ($1, $2, 'Test Org')
         returning slug, profile, payment_instructions, policies, badge_status, account_status`,
        [host.userId, `org-${Date.now()}`],
      );
      const org = rows[0];
      assert.equal(org.slug.startsWith("org-"), true);
      assert.deepEqual(org.profile, {});
      assert.deepEqual(org.payment_instructions, {});
      assert.deepEqual(org.policies, {});
      assert.equal(org.badge_status, "none");
      assert.equal(org.account_status, "pending");
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-14
// @req SEC-02
test("a host authenticated as organisation A cannot read organisation B's row", async () => {
  const hostA = await createTestHost();
  const hostB = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, hostA.userId);
      const orgAId = await insertOrg(db, hostA.userId);

      await actAsAuthenticated(db, hostB.userId);
      const { rows } = await db.query(
        `select id from public.organizations where id = $1`,
        [orgAId],
      );
      assert.deepEqual(rows, [], "host B should not see host A's organization row");
    });
  } finally {
    await hostA.cleanup();
    await hostB.cleanup();
  }
});
```

- [ ] **Step 5: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.organizations" does not exist`.

- [ ] **Step 6: Write the migration**

Create `supabase/migrations/20260922010000_organizations.sql`:

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  profile jsonb not null default '{}'::jsonb,
  payment_instructions jsonb not null default '{}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  badge_status text not null default 'none'
    check (badge_status in ('none', 'pending', 'approved', 'rejected')),
  account_status text not null default 'pending'
    check (account_status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Every later table's RLS policy calls this instead of repeating the
-- subquery, so the ownership chain is defined exactly once.
create function public.owns_organization(org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org_id and o.owner_id = auth.uid()
  );
$$;

create policy "organizations_all_own" on public.organizations
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

- [ ] **Step 7: Apply the migration**

Run: `npx supabase db reset`
Expected: prints each migration applied, including `20260922010000_organizations.sql`, then seeds (no-op) successfully.

- [ ] **Step 8: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 2 tests.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json supabase/seed.sql supabase/migrations/20260922010000_organizations.sql tests/db
git commit -m "feat: add organizations table, RLS ownership helper, and DB test harness"
```

---

## Task 2: `properties` table and the public-catalogue RLS proof

**Files:**
- Create: `supabase/migrations/20260922020000_properties.sql`
- Create: `tests/db/properties.test.mjs`
- Modify: `tests/db/helpers.mjs` — add `actAsAnon`, `insertProperty`

**Interfaces:**
- Consumes: `withDb`, `actAsAuthenticated`, `createTestHost`, `insertOrg` from Task 1
- Produces: `owns_property(prop_id uuid)` SQL function (used by every remaining table), `actAsAnon(db)`, `insertProperty(db, organizationId, overrides?)`

- [ ] **Step 1: Extend the test harness**

Add to `tests/db/helpers.mjs` (after `actAsAuthenticated`):

```js
export async function actAsAnon(db) {
  await db.query("set local role anon");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ role: "anon" }),
  ]);
}
```

Add after `insertOrg`:

```js
export async function insertProperty(db, organizationId, overrides = {}) {
  const p = {
    name: "Test Property",
    property_type: "villa",
    address: "Lahore",
    base_rate_cents: 500000,
    max_guests: 4,
    published: false,
    ...overrides,
  };
  const { rows } = await db.query(
    `insert into public.properties
       (organization_id, name, property_type, address, base_rate_cents, max_guests, published)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [organizationId, p.name, p.property_type, p.address, p.base_rate_cents, p.max_guests, p.published],
  );
  return rows[0].id;
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/db/properties.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withDb,
  actAsAuthenticated,
  actAsAnon,
  createTestHost,
  insertOrg,
} from "./helpers.mjs";

// @req DB-02
test("properties table carries its own knowledge base and AI settings", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const { rows } = await db.query(
        `insert into public.properties
           (organization_id, name, property_type, address, base_rate_cents, max_guests, knowledge_base, ai_settings)
         values ($1, 'Sunset Villa', 'villa', 'Lahore', 500000, 4, $2, $3)
         returning knowledge_base, ai_settings`,
        [
          orgId,
          JSON.stringify({ wifi_password: "guestwifi123", gate_code: "4821" }),
          JSON.stringify({ quote_nightly_rate: true }),
        ],
      );
      assert.equal(rows[0].knowledge_base.gate_code, "4821");
      assert.equal(rows[0].ai_settings.quote_nightly_rate, true);
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-15
test("the anon role can read only published properties", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const published = await db.query(
        `insert into public.properties
           (organization_id, name, property_type, address, base_rate_cents, max_guests, published)
         values ($1, 'Published Villa', 'villa', 'Lahore', 500000, 4, true) returning id`,
        [orgId],
      );
      await db.query(
        `insert into public.properties
           (organization_id, name, property_type, address, base_rate_cents, max_guests, published)
         values ($1, 'Draft Villa', 'villa', 'Lahore', 500000, 4, false)`,
        [orgId],
      );

      await actAsAnon(db);
      const { rows } = await db.query(
        `select id from public.properties where organization_id = $1`,
        [orgId],
      );
      assert.deepEqual(rows.map((r) => r.id), [published.rows[0].id]);
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.properties" does not exist`.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/20260922020000_properties.sql`:

```sql
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  property_type text not null,
  address text not null,
  base_rate_cents integer not null,
  max_guests integer not null,
  published boolean not null default false,
  knowledge_base jsonb not null default '{}'::jsonb,
  ai_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index properties_organization_id_idx on public.properties (organization_id);

alter table public.properties enable row level security;

create function public.owns_property(prop_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id = prop_id and public.owns_organization(p.organization_id)
  );
$$;

create policy "properties_all_own" on public.properties
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));

create policy "properties_select_published_anon" on public.properties
  for select
  to anon
  using (published = true);
```

- [ ] **Step 5: Apply the migration**

Run: `npx supabase db reset`
Expected: both migrations applied in order.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 4 tests total.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260922020000_properties.sql tests/db
git commit -m "feat: add properties table with knowledge base, AI settings, and public RLS"
```

---

## Task 3: `property_photos` and `seasonal_pricing_rules`

**Files:**
- Create: `supabase/migrations/20260922030000_property_photos_and_pricing.sql`
- Create: `tests/db/property-photos-and-pricing.test.mjs`

**Interfaces:**
- Consumes: `withDb`, `createTestHost`, `insertOrg`, `insertProperty` from Tasks 1–2
- Produces: nothing new consumed later — both tables are leaves

- [ ] **Step 1: Write the failing tests**

Create `tests/db/property-photos-and-pricing.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-03
test("property_photos table stores explicit ordering and a cover flag", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const { rows } = await db.query(
        `insert into public.property_photos (property_id, storage_path, position, is_cover)
         values ($1, 'photos/a.jpg', 0, true) returning position, is_cover`,
        [propertyId],
      );
      assert.equal(rows[0].position, 0);
      assert.equal(rows[0].is_cover, true);
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-04
test("seasonal_pricing_rules table stores a date range, rate and minimum stay", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const { rows } = await db.query(
        `insert into public.seasonal_pricing_rules (property_id, start_date, end_date, rate_cents, minimum_stay)
         values ($1, '2026-12-20', '2027-01-05', 800000, 3)
         returning rate_cents, minimum_stay`,
        [propertyId],
      );
      assert.equal(rows[0].rate_cents, 800000);
      assert.equal(rows[0].minimum_stay, 3);
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-04
test("seasonal_pricing_rules rejects an end date that is not after the start date", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      await assert.rejects(
        () =>
          db.query(
            `insert into public.seasonal_pricing_rules (property_id, start_date, end_date, rate_cents)
             values ($1, '2027-01-05', '2026-12-20', 800000)`,
            [propertyId],
          ),
        (err) => err.code === "23514",
      );
    });
  } finally {
    await host.cleanup();
  }
});
```

Note: these tests never call `actAsAuthenticated` — they stay on the superuser connection, which bypasses RLS. That's deliberate: these tests prove schema shape and constraints, which are true regardless of role. RLS enforcement itself is proven only in Tasks 1, 2 and 9.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.property_photos" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260922030000_property_photos_and_pricing.sql`:

```sql
create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null,
  position integer not null,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index property_photos_property_id_idx on public.property_photos (property_id);

alter table public.property_photos enable row level security;

create policy "property_photos_all_own" on public.property_photos
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));

create table public.seasonal_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  rate_cents integer not null,
  minimum_stay integer not null default 1,
  created_at timestamptz not null default now(),
  constraint seasonal_pricing_rules_dates_valid check (end_date > start_date)
);

create index seasonal_pricing_rules_property_id_idx on public.seasonal_pricing_rules (property_id);

alter table public.seasonal_pricing_rules enable row level security;

create policy "seasonal_pricing_rules_all_own" on public.seasonal_pricing_rules
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 7 tests total.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922030000_property_photos_and_pricing.sql tests/db/property-photos-and-pricing.test.mjs
git commit -m "feat: add property_photos and seasonal_pricing_rules tables"
```

---

## Task 4: `availability_blocks` and the double-booking exclusion constraint

**Files:**
- Create: `supabase/migrations/20260922040000_availability_blocks.sql`
- Create: `tests/db/availability-blocks.test.mjs`

**Interfaces:**
- Consumes: `withDb`, `createTestHost`, `insertOrg`, `insertProperty`
- Produces: nothing new consumed later

- [ ] **Step 1: Write the failing tests**

Create `tests/db/availability-blocks.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-05
test("availability_blocks table stores a date range for a property", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const { rows } = await db.query(
        `insert into public.availability_blocks (property_id, start_date, end_date)
         values ($1, '2026-12-01', '2026-12-10')
         returning start_date, end_date`,
        [propertyId],
      );
      assert.equal(rows[0].start_date.toISOString().slice(0, 10), "2026-12-01");
      assert.equal(rows[0].end_date.toISOString().slice(0, 10), "2026-12-10");
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-06
test("an exclusion constraint rejects overlapping blocks on the same property", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      await db.query(
        `insert into public.availability_blocks (property_id, start_date, end_date)
         values ($1, '2026-12-01', '2026-12-10')`,
        [propertyId],
      );

      await db.query("savepoint before_overlap");
      await assert.rejects(
        () =>
          db.query(
            `insert into public.availability_blocks (property_id, start_date, end_date)
             values ($1, '2026-12-05', '2026-12-15')`,
            [propertyId],
          ),
        (err) => err.code === "23P01",
      );
      await db.query("rollback to savepoint before_overlap");

      const otherPropertyId = await insertProperty(db, orgId, { name: "Other Property" });
      const { rows } = await db.query(
        `insert into public.availability_blocks (property_id, start_date, end_date)
         values ($1, '2026-12-05', '2026-12-15') returning id`,
        [otherPropertyId],
      );
      assert.ok(rows[0].id, "overlapping dates on a different property must be allowed");
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.availability_blocks" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260922040000_availability_blocks.sql`:

```sql
-- Needed for the exclusion constraint below: GiST needs an operator class
-- for `=` on uuid, which only exists once btree_gist is installed.
create extension if not exists btree_gist with schema extensions;

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default 'manual_block' check (reason in ('manual_block', 'booking')),
  created_at timestamptz not null default now(),
  constraint availability_blocks_dates_valid check (end_date > start_date),
  exclude using gist (
    property_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
);

alter table public.availability_blocks enable row level security;

create policy "availability_blocks_all_own" on public.availability_blocks
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 9 tests total.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922040000_availability_blocks.sql tests/db/availability-blocks.test.mjs
git commit -m "feat: add availability_blocks with a double-booking exclusion constraint"
```

---

## Task 5: `conversations` table and unguessable guest tokens

**Files:**
- Create: `supabase/migrations/20260922050000_conversations.sql`
- Create: `tests/db/conversations.test.mjs`

**Interfaces:**
- Consumes: `withDb`, `createTestHost`, `insertOrg`, `insertProperty`
- Produces: `conversations` table, consumed by Task 6 (`messages`) and Task 8 (`bookings`)

- [ ] **Step 1: Write the failing tests**

Create `tests/db/conversations.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-07
test("conversations table stores guest token, AI state, AI enabled flag and escalation reason", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const { rows } = await db.query(
        `insert into public.conversations (property_id)
         values ($1)
         returning guest_token, ai_state, ai_enabled, escalated, escalation_reason`,
        [propertyId],
      );
      assert.equal(typeof rows[0].guest_token, "string");
      assert.equal(rows[0].ai_state, "enquiry");
      assert.equal(rows[0].ai_enabled, true);
      assert.equal(rows[0].escalated, false);
      assert.equal(rows[0].escalation_reason, null);
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-16
test("guest conversation tokens are unguessable and unique", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const a = await db.query(
        `insert into public.conversations (property_id) values ($1) returning guest_token`,
        [propertyId],
      );
      const b = await db.query(
        `insert into public.conversations (property_id) values ($1) returning guest_token`,
        [propertyId],
      );
      const tokenA = a.rows[0].guest_token;
      const tokenB = b.rows[0].guest_token;

      assert.notEqual(tokenA, tokenB);
      assert.match(tokenA, /^[0-9a-f]{64}$/, "expected a 256-bit hex token, not a guessable sequence");

      await assert.rejects(
        () =>
          db.query(
            `insert into public.conversations (property_id, guest_token) values ($1, $2)`,
            [propertyId, tokenA],
          ),
        (err) => err.code === "23505",
      );
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.conversations" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260922050000_conversations.sql`:

```sql
-- Needed for gen_random_bytes(), used below to mint the guest token.
create extension if not exists pgcrypto with schema extensions;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  guest_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  ai_state text not null default 'enquiry' check (ai_state in ('enquiry', 'payment', 'stay')),
  ai_enabled boolean not null default true,
  escalated boolean not null default false,
  escalation_reason text,
  created_at timestamptz not null default now()
);

create index conversations_property_id_idx on public.conversations (property_id);

alter table public.conversations enable row level security;

create policy "conversations_all_own" on public.conversations
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
```

Guests reach conversations only through a server route using the service-role key (which bypasses RLS entirely), per the architecture in `docs/superpowers/specs/2026-09-20-phase-1-design.md` — no anon-key policy is added here. That server route is M7's job, not M2's.

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 11 tests total.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922050000_conversations.sql tests/db/conversations.test.mjs
git commit -m "feat: add conversations table with unguessable guest tokens"
```

---

## Task 6: `messages` table and the payment-state safety trigger

**Files:**
- Create: `supabase/migrations/20260922060000_messages.sql`
- Create: `tests/db/messages.test.mjs`

**Interfaces:**
- Consumes: `withDb`, `createTestHost`, `insertOrg`, `insertProperty`, `conversations` table from Task 5
- Produces: `owns_conversation(conv_id uuid)` SQL function (not currently reused, kept for symmetry with `owns_property` and available to later milestones' policies on conversation-scoped tables)

- [ ] **Step 1: Write the failing tests**

Create `tests/db/messages.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-08
test("messages table records a sender of guest, ai or host", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const conv = await db.query(
        `insert into public.conversations (property_id) values ($1) returning id`,
        [propertyId],
      );
      const conversationId = conv.rows[0].id;

      for (const sender of ["guest", "ai", "host"]) {
        const { rows } = await db.query(
          `insert into public.messages (conversation_id, sender, body)
           values ($1, $2, 'hi') returning sender`,
          [conversationId, sender],
        );
        assert.equal(rows[0].sender, sender);
      }

      await assert.rejects(
        () =>
          db.query(
            `insert into public.messages (conversation_id, sender, body) values ($1, 'system', 'hi')`,
            [conversationId],
          ),
        (err) => err.code === "23514",
      );
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-09
test("a constraint forbids an ai message on a conversation in payment state", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const conv = await db.query(
        `insert into public.conversations (property_id, ai_state) values ($1, 'payment') returning id`,
        [propertyId],
      );
      const conversationId = conv.rows[0].id;

      await db.query("savepoint before_ai_message");
      await assert.rejects(() =>
        db.query(
          `insert into public.messages (conversation_id, sender, body) values ($1, 'ai', 'your total is...')`,
          [conversationId],
        ),
      );
      await db.query("rollback to savepoint before_ai_message");

      const { rows } = await db.query(
        `insert into public.messages (conversation_id, sender, body)
         values ($1, 'host', 'sending payment link') returning sender`,
        [conversationId],
      );
      assert.equal(rows[0].sender, "host");
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.messages" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260922060000_messages.sql`:

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender text not null check (sender in ('guest', 'ai', 'host')),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id);

alter table public.messages enable row level security;

create function public.owns_conversation(conv_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv_id and public.owns_property(c.property_id)
  );
$$;

create policy "messages_all_own" on public.messages
  for all
  to authenticated
  using (public.owns_conversation(conversation_id))
  with check (public.owns_conversation(conversation_id));

-- Enforces the Phase 1 core design decision that the AI can never speak
-- while a conversation is in payment state. A BEFORE INSERT trigger fires
-- for every role including service_role, unlike an RLS policy — this is
-- what makes the block non-overridable by the AI backend code M7 adds.
create function public.forbid_ai_message_during_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.sender = 'ai' and exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.ai_state = 'payment'
  ) then
    raise exception 'AI cannot send messages while the conversation is in payment state'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger messages_forbid_ai_during_payment
  before insert on public.messages
  for each row
  execute function public.forbid_ai_message_during_payment();
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 13 tests total.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922060000_messages.sql tests/db/messages.test.mjs
git commit -m "feat: add messages table with a non-overridable payment-state trigger"
```

---

## Task 7: `guests` and `guest_documents`

**Files:**
- Create: `supabase/migrations/20260922070000_guests_and_documents.sql`
- Create: `tests/db/guests-and-documents.test.mjs`

**Interfaces:**
- Consumes: `withDb`, `createTestHost`, `insertOrg`
- Produces: `guests` table, consumed by Task 8 (`bookings`)

- [ ] **Step 1: Write the failing tests**

Create `tests/db/guests-and-documents.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg } from "./helpers.mjs";

// @req DB-11
test("guests table is scoped to an organisation", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const { rows } = await db.query(
        `insert into public.guests (organization_id, name, phone)
         values ($1, 'Ali Khan', '0300-1234567')
         returning organization_id, name, phone`,
        [orgId],
      );
      assert.equal(rows[0].organization_id, orgId);
      assert.equal(rows[0].name, "Ali Khan");
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-12
test("guest_documents table stores an image reference and a retention expiry", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const guest = await db.query(
        `insert into public.guests (organization_id, name) values ($1, 'Ali Khan') returning id`,
        [orgId],
      );
      const { rows } = await db.query(
        `insert into public.guest_documents (guest_id, organization_id, image_path, cnic_number)
         values ($1, $2, 'cnic/ali.jpg', '35202-1234567-1')
         returning image_path, retention_expires_at`,
        [guest.rows[0].id, orgId],
      );
      assert.equal(rows[0].image_path, "cnic/ali.jpg");
      assert.ok(rows[0].retention_expires_at, "expected a default retention expiry");
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.guests" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260922070000_guests_and_documents.sql`:

```sql
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create index guests_organization_id_idx on public.guests (organization_id);

alter table public.guests enable row level security;

create policy "guests_all_own" on public.guests
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));

-- organization_id is denormalised here (rather than joined through guests)
-- so the RLS policy is a single equality check, not a nested subquery —
-- this table is read on every Hotel Eye export and should stay cheap to plan.
create table public.guest_documents (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  image_path text not null,
  cnic_number text,
  stay_start date,
  stay_end date,
  retention_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

create index guest_documents_guest_id_idx on public.guest_documents (guest_id);
create index guest_documents_organization_id_idx on public.guest_documents (organization_id);

alter table public.guest_documents enable row level security;

create policy "guest_documents_all_own" on public.guest_documents
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 15 tests total.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922070000_guests_and_documents.sql tests/db/guests-and-documents.test.mjs
git commit -m "feat: add guests and guest_documents tables"
```

---

## Task 8: `bookings` table

**Files:**
- Create: `supabase/migrations/20260922080000_bookings.sql`
- Create: `tests/db/bookings.test.mjs`

**Interfaces:**
- Consumes: `withDb`, `createTestHost`, `insertOrg`, `insertProperty`, `properties`/`conversations`/`guests` tables
- Produces: `bookings` table — the last table in M2. M6 will later add `booking_id` to `availability_blocks` via a new migration once approval-driven blocking exists; that is out of scope here (YAGNI: M2 has no booking-approval flow yet).

- [ ] **Step 1: Write the failing test**

Create `tests/db/bookings.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-10
test("bookings table carries the status pipeline and a server-computed price", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const { rows } = await db.query(
        `insert into public.bookings (property_id, start_date, end_date, total_price_cents)
         values ($1, '2026-12-01', '2026-12-05', 2000000)
         returning status, total_price_cents`,
        [propertyId],
      );
      assert.equal(rows[0].status, "requested");
      assert.equal(rows[0].total_price_cents, 2000000);

      await db.query("savepoint before_bad_status");
      await assert.rejects(
        () =>
          db.query(
            `insert into public.bookings (property_id, start_date, end_date, total_price_cents, status)
             values ($1, '2026-12-10', '2026-12-12', 1000000, 'cancelled')`,
            [propertyId],
          ),
        (err) => err.code === "23514",
      );
      await db.query("rollback to savepoint before_bad_status");
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test "tests/db/*.test.mjs"`
Expected: FAIL — `relation "public.bookings" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260922080000_bookings.sql`:

```sql
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'paid', 'staying', 'checked_out', 'rejected')),
  total_price_cents integer not null,
  created_at timestamptz not null default now(),
  constraint bookings_dates_valid check (end_date > start_date)
);

create index bookings_property_id_idx on public.bookings (property_id);
create index bookings_conversation_id_idx on public.bookings (conversation_id);
create index bookings_guest_id_idx on public.bookings (guest_id);

alter table public.bookings enable row level security;

create policy "bookings_all_own" on public.bookings
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
```

- [ ] **Step 4: Apply the migration**

Run: `npx supabase db reset`

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 16 tests total.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260922080000_bookings.sql tests/db/bookings.test.mjs
git commit -m "feat: add bookings table with the status pipeline"
```

---

## Task 9: RLS-everywhere sweep, CI wiring, and the milestone audit

**Files:**
- Create: `tests/db/rls-sweep.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `withDb`; every table from Tasks 1–8
- Produces: nothing further — this closes the milestone

- [ ] **Step 1: Write the failing test**

Create `tests/db/rls-sweep.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb } from "./helpers.mjs";

// @req DB-13
test("row level security is enabled on every table in the public schema", async () => {
  await withDb(async (db) => {
    const { rows } = await db.query(`
      select relname
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relkind = 'r'
        and pg_class.relrowsecurity = false
    `);
    assert.deepEqual(
      rows,
      [],
      `tables without row level security: ${rows.map((r) => r.relname).join(", ")}`,
    );
  });
});
```

This test needs no fixtures — it is already meaningful against the tables built in Tasks 1–8, and will keep guarding every table any future milestone adds.

- [ ] **Step 2: Run the test and confirm it passes immediately**

Run: `node --test "tests/db/*.test.mjs"`
Expected: PASS, 17 tests total — every table already has RLS enabled from its own migration, so this is a regression guard, not new behaviour to build.

- [ ] **Step 3: Update CI to run the database tests**

`npm test` now includes `tests/db/**`, which needs a live Postgres instance. M1's CI never started the local stack. Modify `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
          cache-dependency-path: |
            package-lock.json
            web/package-lock.json

      - name: Install root dependencies
        run: npm ci

      - name: Install web dependencies
        run: npm ci --prefix web

      - name: Start Supabase
        run: npx supabase start

      - name: Lint
        run: npm run lint

      - name: Test
        run: npm test

      - name: Audit requirements
        run: npm run audit -- --milestone M2

      - name: Fail if the tracker is stale
        run: git diff --exit-code docs/TRACKER.md

      - name: Build
        run: npm run build

      - name: Verify design tokens compile to real utilities
        shell: bash
        run: |
          MISSING=""
          for u in '.bg-accent' '.bg-surface' '.hover\:bg-surface-muted' '.text-ink' '.text-accent-contrast' '.border-hairline' '.rounded-pill'; do
            grep -qF "$u" web/.next/static/chunks/*.css || MISSING="$MISSING $u"
          done
          if [ -n "$MISSING" ]; then
            echo "Tokens defined but not compiling to utilities:$MISSING"
            echo "A token in the wrong @theme namespace produces no utility."
            exit 1
          fi
          echo "All token utilities present in compiled CSS."

      - name: Stop Supabase
        if: always()
        run: npx supabase stop
```

Three changes from M1's version: a new "Start Supabase" step before "Lint" (migrations apply automatically on a fresh stack, so no separate `db reset` is needed in CI), `--milestone M1` became `--milestone M2` on the audit step, and a "Stop Supabase" cleanup step at the end with `if: always()` so a failed test run still tears the containers down.

- [ ] **Step 4: Confirm locally before pushing**

Run: `npm run db:status`
Expected: the local stack is already running from earlier tasks. If not, run `npm run db:start` first.

Run: `npm test`
Expected: PASS — both `test:scripts` (now including `tests/db/**`) and `test:web`.

Run: `npm run audit -- --milestone M2`
Expected: `M2 is not complete` should NOT appear; all of DB-01 through DB-16 show as covered. Output ends with `Audit passed.`

Run: `git diff docs/TRACKER.md`
Expected: the working tree already matches what `npm run audit` just wrote (the previous command regenerated it). If there's a diff, that's the file to commit.

- [ ] **Step 5: Commit**

```bash
git add tests/db/rls-sweep.test.mjs .github/workflows/ci.yml docs/TRACKER.md
git commit -m "feat: add RLS sweep test and start the Supabase stack in CI for M2"
```

- [ ] **Step 6: Push and confirm CI is green**

Run: `git push`
Expected: the CI run on GitHub starts the Supabase stack, runs all tests including `tests/db/**`, passes the M2 audit, and goes green. The first run will be slow (Docker pulls the Postgres/GoTrue/Storage images from scratch) — this is expected and not a regression to chase down.

---

## Milestone exit audit

M2 is not closed until every line below is true, with output pasted:

- [ ] `npm test` — green, output pasted, including all `tests/db/**` tests
- [ ] `npm run audit -- --milestone M2` — passes, no untested M2 requirement
- [ ] `docs/TRACKER.md` is committed and matches what the auditor generates
- [ ] CI is green on `main`, including the new Start/Stop Supabase steps
- [ ] `select relname from pg_class join pg_namespace ... where relrowsecurity = false` returns zero rows against the local stack (this is exactly what the DB-13 test asserts, but re-run it by hand once as a sanity check, not just in the suite)
- [ ] Manually attempt to insert an `ai` message into a `payment`-state conversation via `psql` as the `postgres` superuser (not through the test suite) and confirm the trigger still fires — this is the concrete proof that the block is not RLS-bypassable, which is the entire point of DB-09
- [ ] No `TODO` or stub remains in any file created by this milestone
