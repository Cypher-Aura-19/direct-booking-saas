# M5 Public Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest who taps a host's link opens that host's catalogue at `/s/<org>` or the host's own `stay.` domain. They browse published properties, and on a property page they see a photo gallery, price, amenities, description and the host's profile, with no login, fast on a phone on mobile data.

**Architecture:** Public pages are Server Components that read through a **cookie-less anon Supabase client**. Nothing is session-bound, so pages can be cached with `revalidate`. Every read is guarded by the database, not the app. Anon gets new RLS policies plus column-level grants on `organizations`, `properties` (two new listing columns), `property_photos` and the `property-photos` storage bucket. Each policy is scoped to *published* properties only. Photos are resized **in the browser at upload time** into three WebP variants (480/960/1600px), stored beside the original. Public pages serve them with `srcset` through signed URLs that outlive the page cache. Supabase image transformation is not used, because it requires the Pro plan (decided 2026-09-25). The logic lives in plain functions under `web/lib/**` that take a Supabase client, tested against the real local stack. Pages are thin: they fetch, then render a pure `*View` component that tests render directly.

**Tech Stack:** Next.js 16.3.5 App Router (Server Components, `revalidate`, `notFound()`), React 19.2.8, `@supabase/supabase-js` 2.117.0 (Storage signed URLs), Postgres via Supabase migrations, Vitest 5 + Testing Library (web), `node --test` + `pg` (root DB tests), Playwright (global install, `channel: "chrome"`) for the manual performance check. No new dependencies.

## Global Constraints

Copied or derived from `docs/superpowers/specs/2026-09-20-phase-1-design.md`, the M1–M4 plans, and owner decisions of 2026-09-25. Every task implicitly includes these.

- **All layout uses CSS logical properties**: `margin-inline-start`, `padding-inline`, `inset-inline-start`, `border-inline-end`, `text-align: start|end`. Never `left`/`right`, `margin-left`, `padding-right` or `text-align: left|right`. The auditor (`npm run audit`) fails CI on any physical property in any `.css` or class string (A11Y-02, FOUND-14). Centring with `left: 50%` + `translateX(-50%)` is the one tolerated exception and is not needed in this milestone.
- **Match the current visual design.** Colours come only from the tokens in `web/app/globals.css`: `--ink`, `--muted`, `--surface`, `--surface-muted`, `--accent`, `--accent-soft`, `--hairline`, `--lime` (the action colour; `bg-action`), `--destructive`, `--success`. Display headings use `font-family: var(--font-display), Georgia, serif; font-weight: 400; letter-spacing: -.035em; line-height: 1.04` (Libre Caslon Display, as on `/` and the auth pages). Body text is Geist. Primary actions are `buttonClasses("primary")` (lime pill, dark label). Media and cards use a 16px radius, fields 8px, actions `rounded-pill`. Never hardcode a new colour.
- **Interactive targets are at least 44px on mobile** (A11Y-01). Use `buttonClasses()` for link-buttons and `Button` for buttons; any other tappable element gets `min-height: 44px`.
- **Public pages are mobile-first** (PUB-08). Base styles are the phone layout; wider layouts are added only inside `@media (min-width: …)`. `public.css` never contains `max-width` media queries.
- **Anon-facing reads never use `select *`.** Anon holds column-level grants on `properties` and, from Task 1, on `organizations`. `*` expands to ungranted columns and fails with `42501`. Every public query lists its columns.
- **Anon must never read** `properties.knowledge_base`, `properties.ai_settings`, `properties.address`, `organizations.owner_id`, `organizations.payment_instructions` or `organizations.policies`. Never widen a published-only policy to `authenticated`: authenticated has table-level grants and would see the knowledge base.
- **The service-role key never reaches application code** (SEC-01). Public pages use the anon key only. Tests may use `supabaseAdmin()` for setup/cleanup only.
- **Every new SQL function** gets `revoke execute … from public` and explicit `grant execute … to <roles>`. Supabase's default ACL also grants anon by name, so when anon must NOT execute, revoke from `anon` too. `security definer` is not used in this milestone; if a task seems to need it, stop and ask.
- **Read functions never turn a database error into "not found".** Only a genuinely missing row or a malformed id (Postgres `22P02`) yields `null`/`[]`. Any other error is thrown.
- **Money is integer paisa in `*_cents` columns** (Rs 1 = 100). Show whole rupees with `formatRupees()` from `web/lib/properties/basics.ts`.
- **The host's phone is public** on catalogue and property pages (owner decision 2026-09-25). City, headline and phone come from `organizations.profile` (`{ city, phone, headline }`).
- **Pending organisations are public too** (owner decision 2026-09-25). Do not filter on `account_status` in M5.
- **No route may list or search properties across organisations** (PUB-09, D-19). There is no `app/s/page.tsx`, ever.
- **Every test that proves a requirement carries a `// @req <ID>` comment** directly above it, using an ID from `docs/requirements.md`.
- **No business logic in a page, layout, `"use server"` function or middleware wrapper.** It lives in `web/lib/**`.
- **Next 16 `params` is a Promise:** `({ params }: { params: Promise<{ org: string }> })` then `const { org } = await params;`.
- **This machine is shared with unrelated projects.** Only touch Docker containers named `*_airbnb_like_system`. The machine is memory-constrained: run Vitest with `--maxWorkers=1` if workers time out.
- **`npm test` needs the local stack running** (`npm run db:start` at the repo root). After adding a migration, apply it with `npx supabase db reset` (local only; never against the hosted project).
- **Before any push, run every CI step locally**, in this order: `npm run lint`, `npm test`, `npm run audit -- --milestone M5`, `git diff --exit-code docs/TRACKER.md`, `npm run build`, then the token grep in `.github/workflows/ci.yml`.
- **Commit after every task.** Never mark a step done without running the command and reading its output.

---

## File Structure

```
supabase/migrations/
└─ 20260926010000_m5_public_catalogue.sql     NEW — listing columns, variant flag, anon read policies/grants
tests/db/
└─ m5-public-catalogue.test.mjs               NEW — schema + anon-exposure checks

web/
├─ lib/
│  ├─ supabase/public.ts                      NEW — cookie-less anon client for public pages
│  ├─ supabase/middleware.ts                  MODIFY — stay-host rewrite; skip session refresh on /s/*
│  ├─ supabase/middleware.test.ts             MODIFY — PUB-04, PUB-05
│  ├─ properties/listing.ts                   NEW — AMENITIES catalogue, parse + update description/amenities
│  ├─ properties/listing.test.ts              NEW
│  ├─ properties/photo-variants.ts            NEW — widths, variant paths, size math, browser resize
│  ├─ properties/photo-variants.test.ts       NEW
│  ├─ properties/photos.ts                    MODIFY — upload/delete variants
│  ├─ properties/photos.test.ts               MODIFY — variant upload/delete
│  ├─ properties/basics.ts                    MODIFY — publicPropertyUrl / publicCatalogueUrl
│  ├─ public/catalogue.ts                     NEW — org/property/photo reads for anon, contact links
│  └─ public/catalogue.test.ts                NEW — PUB-01..04, 06, 07 against the real stack
├─ app/
│  ├─ s/[org]/layout.tsx                      NEW — imports public.css, public header/footer
│  ├─ s/[org]/public.css                      NEW — mobile-first public styles
│  ├─ s/[org]/public-css.test.ts              NEW — PUB-08
│  ├─ s/[org]/page.tsx                        NEW — catalogue page (fetch + render)
│  ├─ s/[org]/catalogue-view.tsx              NEW — pure catalogue component
│  ├─ s/[org]/catalogue-view.test.tsx         NEW — PUB-01, PUB-03, PUB-10
│  ├─ s/[org]/not-found.tsx                   NEW — PUB-06 written not-found page
│  ├─ s/[org]/[property]/page.tsx             NEW — property page (fetch + render)
│  ├─ s/[org]/[property]/property-view.tsx    NEW — pure property component
│  ├─ s/[org]/[property]/property-view.test.tsx NEW — PUB-02, PUB-03
│  ├─ s/routes.test.ts                        NEW — PUB-09
│  ├─ components/public/host-card.tsx         NEW — host profile block shared by both pages
│  ├─ layout.tsx                              MODIFY — don't preload Nastaliq / Geist Mono
│  └─ dashboard/properties/[id]/page.tsx      MODIFY — "Guest-facing details" section
│     dashboard/properties/listing-form.tsx   NEW — description + amenities form
│     dashboard/properties/actions.ts         MODIFY — updateListingAction
│     dashboard/properties/[id]/photos/photo-manager.tsx MODIFY — make variants before upload
scripts/
└─ perf-public-page.mjs                       NEW — slow-3G load-time check (manual, not CI)
docs/requirements.md                          MODIFY — PUB-07 wording (resize on upload)
.github/workflows/ci.yml                      MODIFY — audit --milestone M5
```

---

### Task 1: Public-read migration

**Files:**
- Create: `supabase/migrations/20260926010000_m5_public_catalogue.sql`
- Test: `tests/db/m5-public-catalogue.test.mjs`

**Interfaces:**
- Consumes: M2/M4 schema; `tests/db/helpers.mjs` (`withDb`, `actAsAnon`, `actAsAuthenticated`, `createTestHost`, `insertOrg`, `insertProperty`).
- Produces: columns `properties.description text`, `properties.amenities text[]`, `property_photos.has_variants boolean`; anon SELECT on `organizations(id, slug, name, profile, created_at)` for every row; anon SELECT on `property_photos` rows and `property-photos` storage objects of published properties only; SQL function `public.is_published_property_object(text) returns boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/db/m5-public-catalogue.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, actAsAuthenticated, actAsAnon, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

async function expectPgError(db, code, fn) {
  await db.query("savepoint expect_error");
  try {
    await fn();
    assert.fail(`expected Postgres error ${code}, but the statement succeeded`);
  } catch (error) {
    if (error.code === "ERR_ASSERTION") throw error;
    assert.equal(error.code, code, error.message);
  } finally {
    await db.query("rollback to savepoint expect_error");
  }
}

test("properties carry a description and known amenities, and reject unknown ones", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query("select description, amenities from public.properties where id = $1", [id]);
      assert.equal(rows[0].description, "");
      assert.deepEqual(rows[0].amenities, []);
      await db.query("update public.properties set description = 'Quiet rooms', amenities = '{wifi,parking}' where id = $1", [id]);
      await expectPgError(db, "23514", () =>
        db.query("update public.properties set amenities = '{jacuzzi}' where id = $1", [id]),
      );
      await expectPgError(db, "23514", () =>
        db.query("update public.properties set description = repeat('a', 2001) where id = $1", [id]),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("anon reads an organisation's public columns but never its owner, payments or policies", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId, { slug: `m5-org-${Date.now()}` });
      await db.query(
        `update public.organizations set profile = '{"city":"Hunza","phone":"03001234567","headline":"Cabins"}',
           payment_instructions = '{"bank":"secret"}' where id = $1`,
        [orgId],
      );
      await actAsAnon(db);
      const { rows } = await db.query("select id, slug, name, profile, created_at from public.organizations where id = $1", [orgId]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].profile.city, "Hunza");
      for (const column of ["owner_id", "payment_instructions", "policies", "account_status"]) {
        await expectPgError(db, "42501", () => db.query(`select ${column} from public.organizations where id = $1`, [orgId]));
      }
    });
  } finally {
    await host.cleanup();
  }
});

test("anon reads listing columns of published properties but not the address or knowledge base", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId, { published: true });
      await actAsAnon(db);
      const { rows } = await db.query("select description, amenities from public.properties where id = $1", [id]);
      assert.equal(rows.length, 1);
      for (const column of ["address", "knowledge_base", "ai_settings"]) {
        await expectPgError(db, "42501", () => db.query(`select ${column} from public.properties where id = $1`, [id]));
      }
    });
  } finally {
    await host.cleanup();
  }
});

test("anon sees photo rows and storage objects of published properties only", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const published = await insertProperty(db, orgId, { published: true });
      const draft = await insertProperty(db, orgId, { published: false });
      for (const propertyId of [published, draft]) {
        await db.query(
          "insert into public.property_photos (property_id, storage_path, position, is_cover) values ($1, $2, 0, true)",
          [propertyId, `${propertyId}/a.jpg`],
        );
      }
      await db.query("reset role");
      for (const propertyId of [published, draft]) {
        await db.query(
          "insert into storage.objects (bucket_id, name, owner) values ('property-photos', $1, $2)",
          [`${propertyId}/a.jpg`, host.userId],
        );
      }
      await actAsAnon(db);
      const rows = await db.query("select property_id from public.property_photos where property_id = any($1)", [[published, draft]]);
      assert.deepEqual(rows.rows.map((r) => r.property_id), [published]);
      const objects = await db.query(
        "select name from storage.objects where bucket_id = 'property-photos' and name = any($1)",
        [[`${published}/a.jpg`, `${draft}/a.jpg`]],
      );
      assert.deepEqual(objects.rows.map((r) => r.name), [`${published}/a.jpg`]);
      await expectPgError(db, "42501", () =>
        db.query("insert into public.property_photos (property_id, storage_path, position) values ($1, $2, 1)", [published, `${published}/b.jpg`]),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("photos record whether resized variants exist, defaulting to false", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query(
        "insert into public.property_photos (property_id, storage_path, position) values ($1, $2, 0) returning has_variants",
        [id, `${id}/a.jpg`],
      );
      assert.equal(rows[0].has_variants, false);
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/db/m5-public-catalogue.test.mjs`
Expected: FAIL. `column "description" does not exist`, then anon errors, because the migration isn't written yet.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260926010000_m5_public_catalogue.sql`:

```sql
-- ---------------------------------------------------------------------------
-- M5 public catalogue. Everything here widens what the anon role can read,
-- so every grant is column-level and every policy is scoped to published
-- properties. RLS filters rows, not columns (see 20260922090000).
-- ---------------------------------------------------------------------------

-- Guest-facing listing fields (PUB-02). The amenity list must match
-- AMENITIES in web/lib/properties/listing.ts exactly.
alter table public.properties
  add column description text not null default '',
  add column amenities text[] not null default '{}';

alter table public.properties
  add constraint properties_description_length check (char_length(description) <= 2000),
  add constraint properties_amenities_known check (
    amenities <@ array[
      'wifi', 'parking', 'hot_water', 'backup_power', 'heating', 'air_conditioning',
      'kitchen', 'breakfast', 'mountain_view', 'family_friendly', 'workspace', 'garden'
    ]::text[]
  );

grant select (description, amenities) on public.properties to anon;

-- Photos uploaded from M5 on carry 480/960/1600px WebP variants stored beside
-- the original (<property_id>/<uuid>.w480.webp etc.). Older photos don't.
alter table public.property_photos add column has_variants boolean not null default false;

-- ---------------------------------------------------------------------------
-- Organisations: anon reads the public face of every organisation (PUB-01,
-- PUB-03, PUB-06, PUB-10). profile holds city, phone and headline, all public
-- by owner decision (2026-09-25). owner_id, payment_instructions, policies,
-- badge_status and account_status are not granted.
-- Table-level revoke first: this stack grants anon a blanket table ACL, which
-- a column-level grant alone cannot narrow (same finding as 20260922090000).
-- ---------------------------------------------------------------------------
revoke select on public.organizations from anon;
grant select (id, slug, name, profile, created_at) on public.organizations to anon;

create policy "organizations_select_public_anon" on public.organizations
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- Photos of published properties: the rows (gallery order, cover) and the
-- storage objects (so anon can create signed URLs for them).
-- ---------------------------------------------------------------------------
create policy "property_photos_select_published_anon" on public.property_photos
  for select
  to anon
  using (exists (
    select 1 from public.properties p
    where p.id = property_id and p.published
  ));

create function public.is_published_property_object(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id::text = split_part(object_name, '/', 1)
      and p.published
  );
$$;

revoke execute on function public.is_published_property_object(text) from public;
grant execute on function public.is_published_property_object(text) to anon, authenticated;

create policy "property_photos_objects_published_anon_read" on storage.objects
  for select
  to anon
  using (bucket_id = 'property-photos' and public.is_published_property_object(name));
```

- [ ] **Step 4: Apply and run the tests**

Run: `npx supabase db reset` then `node --test tests/db/m5-public-catalogue.test.mjs`
Expected: all 5 tests PASS.

Then run the whole root DB suite, since the organisations grant changed: `npm run test:scripts`
Expected: PASS. Every existing test still passes. In particular, `organization_slug_taken` is `security definer` and does not depend on anon's table grant.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260926010000_m5_public_catalogue.sql tests/db/m5-public-catalogue.test.mjs
git commit -m "feat: let anon read published listings, photos and organisation profiles"
```

---

### Task 2: Guest-facing listing details (description + amenities)

**Files:**
- Create: `web/lib/properties/listing.ts`, `web/lib/properties/listing.test.ts`, `web/app/dashboard/properties/listing-form.tsx`
- Modify: `web/app/dashboard/properties/actions.ts`, `web/app/dashboard/properties/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 1 columns; `createTestHostWithOrg()` from `web/tests/helpers.ts`; `createProperty(supabase, { organizationId, basics }): Promise<{ error: string | null; propertyId?: string }>` from `web/lib/properties/basics.ts`; `FormState` from `web/app/dashboard/properties/actions.ts`.
- Produces:
  - `export const AMENITIES: readonly { value: Amenity; label: string }[]`
  - `export type Amenity = "wifi" | "parking" | "hot_water" | "backup_power" | "heating" | "air_conditioning" | "kitchen" | "breakfast" | "mountain_view" | "family_friendly" | "workspace" | "garden"`
  - `export type Listing = { description: string; amenities: Amenity[] }`
  - `export function parseListing(input: { description: string; amenities: string[] }): { listing: Listing } | { error: string }`
  - `export async function getListing(supabase, propertyId): Promise<Listing | null>`
  - `export async function updateListing(supabase, propertyId, listing: Listing): Promise<{ error: string | null }>`
  - `export function amenityLabel(value: string): string`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/properties/listing.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { createProperty } from "./basics";
import { AMENITIES, amenityLabel, getListing, parseListing, updateListing } from "./listing";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function hostWithProperty() {
  const host = await createTestHostWithOrg();
  cleanups.push(host.cleanup);
  const { propertyId } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "River Hut", property_type: "cabin", address: "Karimabad", base_rate_cents: 900_000, max_guests: 2 },
  });
  return { host, propertyId: propertyId! };
}

describe("parseListing", () => {
  it("trims the description and keeps only known amenities, deduplicated and in catalogue order", () => {
    const result = parseListing({ description: "  Quiet rooms  ", amenities: ["parking", "wifi", "wifi"] });
    expect(result).toEqual({ listing: { description: "Quiet rooms", amenities: ["wifi", "parking"] } });
  });

  it("rejects an unknown amenity and an over-long description", () => {
    expect(parseListing({ description: "", amenities: ["jacuzzi"] })).toEqual({ error: "Unknown amenity: jacuzzi" });
    expect(parseListing({ description: "a".repeat(2001), amenities: [] })).toEqual({
      error: "The description must be 2,000 characters or fewer.",
    });
  });

  it("labels every amenity", () => {
    for (const { value, label } of AMENITIES) expect(amenityLabel(value)).toBe(label);
  });
});

// @req PUB-02
it("a host can save a description and amenities, and read them back", async () => {
  const { host, propertyId } = await hostWithProperty();
  const result = await updateListing(host.supabase, propertyId, { description: "Views of Rakaposhi", amenities: ["wifi", "hot_water"] });
  expect(result).toEqual({ error: null });
  expect(await getListing(host.supabase, propertyId)).toEqual({ description: "Views of Rakaposhi", amenities: ["wifi", "hot_water"] });
});

// @req PUB-02
it("every amenity in the catalogue is accepted by the database", async () => {
  const { host, propertyId } = await hostWithProperty();
  const all = AMENITIES.map((a) => a.value);
  expect(await updateListing(host.supabase, propertyId, { description: "", amenities: all })).toEqual({ error: null });
  expect((await getListing(host.supabase, propertyId))?.amenities).toEqual(all);
});

// @req PROP-14
it("a host cannot change another organisation's listing", async () => {
  const { host: owner, propertyId } = await hostWithProperty();
  const other = await createTestHostWithOrg();
  cleanups.push(other.cleanup);
  await updateListing(other.supabase, propertyId, { description: "Hijacked", amenities: [] });
  expect((await getListing(owner.supabase, propertyId))?.description).toBe("");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run lib/properties/listing.test.ts`
Expected: FAIL. `Cannot find module './listing'`.

- [ ] **Step 3: Implement `web/lib/properties/listing.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

// Must match the properties_amenities_known check in
// supabase/migrations/20260926010000_m5_public_catalogue.sql exactly.
export const AMENITIES = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "parking", label: "Parking" },
  { value: "hot_water", label: "Hot water" },
  { value: "backup_power", label: "Backup power" },
  { value: "heating", label: "Heating" },
  { value: "air_conditioning", label: "Air conditioning" },
  { value: "kitchen", label: "Kitchen" },
  { value: "breakfast", label: "Breakfast available" },
  { value: "mountain_view", label: "Mountain view" },
  { value: "family_friendly", label: "Family friendly" },
  { value: "workspace", label: "Workspace" },
  { value: "garden", label: "Garden or terrace" },
] as const;

export type Amenity = (typeof AMENITIES)[number]["value"];
export type Listing = { description: string; amenities: Amenity[] };

const MAX_DESCRIPTION = 2000;
const ORDER = AMENITIES.map((a) => a.value as string);

export function amenityLabel(value: string): string {
  return AMENITIES.find((a) => a.value === value)?.label ?? value;
}

export function parseListing(input: { description: string; amenities: string[] }): { listing: Listing } | { error: string } {
  const description = input.description.trim();
  if (description.length > MAX_DESCRIPTION) return { error: "The description must be 2,000 characters or fewer." };
  const unknown = input.amenities.find((a) => !ORDER.includes(a));
  if (unknown) return { error: `Unknown amenity: ${unknown}` };
  const amenities = ORDER.filter((a) => input.amenities.includes(a)) as Amenity[];
  return { listing: { description, amenities } };
}

export async function getListing(supabase: SupabaseClient, propertyId: string): Promise<Listing | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("description, amenities")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? { description: data.description, amenities: data.amenities as Amenity[] } : null;
}

export async function updateListing(supabase: SupabaseClient, propertyId: string, listing: Listing): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("properties")
    .update({ description: listing.description, amenities: listing.amenities })
    .eq("id", propertyId);
  return { error: error ? error.message : null };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run lib/properties/listing.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the Server Action**

Append to `web/app/dashboard/properties/actions.ts`. Keep the file's existing imports and `FormState` type. Add `parseListing` and `updateListing` to the imports, and use the same `dashboardContext` and `revalidatePath` imports the file's other actions use:

```ts
export async function updateListingAction(propertyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseListing({
    description: String(formData.get("description") ?? ""),
    amenities: formData.getAll("amenities").map(String),
  });
  if ("error" in parsed) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const { error } = await updateListing(supabase, propertyId, parsed.listing);
  if (error) return { error, success: false };
  revalidatePath(`/dashboard/properties/${propertyId}`);
  return { error: null, success: true };
}
```

- [ ] **Step 6: Build the form**

Create `web/app/dashboard/properties/listing-form.tsx`. It follows the patterns of `basics-form.tsx` (`useActionState`, `Field`, `INPUT_CLASSES`, `Notice`, `Button`):

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { AMENITIES, type Listing } from "@/lib/properties/listing";
import type { FormState } from "./actions";

export function ListingForm({
  action,
  listing,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  listing: Listing;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <Field label="Description" hint="What makes the stay special. Guests read this on your public page. Up to 2,000 characters.">
        <textarea name="description" rows={5} maxLength={2000} defaultValue={listing.description} className={`${INPUT_CLASSES} resize-y leading-6`} />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">Amenities</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AMENITIES.map((amenity) => (
            <label
              key={amenity.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-field)] border border-hairline bg-surface px-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="checkbox" name="amenities" value={amenity.value} defaultChecked={listing.amenities.includes(amenity.value)} className="size-4 accent-[var(--accent)]" />
              {amenity.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Saved.</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Add the section to the property basics page**

In `web/app/dashboard/properties/[id]/page.tsx`:
- Import `getListing` and `ListingForm`, and add `updateListingAction` to the existing `../actions` import.
- After the existing `getProperty` call, add `const listing = (await getListing(supabase, id)) ?? { description: "", amenities: [] };`.
- Below the existing "Basics" section, add a second section using the same container markup the Basics section uses. Its heading is "Guest-facing details", its description is "Shown on your public page.", and its body is `<ListingForm action={updateListingAction.bind(null, id)} listing={listing} />`.

- [ ] **Step 8: Verify and commit**

Run: `cd web && npx tsc --noEmit && npx eslint app/dashboard lib/properties && npx vitest run lib/properties app/dashboard`
Expected: no type or lint errors; all tests PASS.

```bash
git add web/lib/properties/listing.ts web/lib/properties/listing.test.ts web/app/dashboard/properties
git commit -m "feat: let hosts write a description and pick amenities for their public page"
```

---

### Task 3: Resized photo variants at upload

**Files:**
- Create: `web/lib/properties/photo-variants.ts`, `web/lib/properties/photo-variants.test.ts`
- Modify: `web/lib/properties/photos.ts`, `web/lib/properties/photos.test.ts`, `web/app/dashboard/properties/[id]/photos/photo-manager.tsx`

**Interfaces:**
- Consumes: Task 1's `property_photos.has_variants`; the existing `uploadPropertyPhoto`, `deletePropertyPhoto` and `PHOTO_BUCKET` in `photos.ts`.
- Produces:
  - `export const PHOTO_WIDTHS = [480, 960, 1600] as const`
  - `export type PhotoVariant = { width: (typeof PHOTO_WIDTHS)[number]; blob: Blob }`
  - `export function variantPath(storagePath: string, width: number): string` turns `"<pid>/<uuid>.jpg"` into `"<pid>/<uuid>.w960.webp"`
  - `export function fitWithin(width: number, height: number, max: number): { width: number; height: number }`, which never upscales
  - `export async function makePhotoVariants(file: Blob): Promise<PhotoVariant[]>` (browser only)
  - `uploadPropertyPhoto(supabase, { propertyId, file, variants? })`. When `variants` is non-empty, it uploads each to `variantPath(path, width)` and inserts the row with `has_variants: true`.
  - `PropertyPhoto` gains `has_variants: boolean`
  - `deletePropertyPhoto` also removes the variant objects

- [ ] **Step 1: Write the failing pure tests**

Create `web/lib/properties/photo-variants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PHOTO_WIDTHS, fitWithin, variantPath } from "./photo-variants";

describe("photo variants", () => {
  // @req PUB-07
  it("names each variant after the original, by width, as WebP", () => {
    expect(variantPath("p1/abc.jpg", 960)).toBe("p1/abc.w960.webp");
    expect(variantPath("p1/abc.webp", 480)).toBe("p1/abc.w480.webp");
    expect(PHOTO_WIDTHS).toEqual([480, 960, 1600]);
  });

  // @req PUB-07
  it("scales down to fit the target width, keeps the aspect ratio, and never upscales", () => {
    expect(fitWithin(4000, 3000, 960)).toEqual({ width: 960, height: 720 });
    expect(fitWithin(800, 600, 960)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(3000, 4000, 480)).toEqual({ width: 480, height: 640 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/properties/photo-variants.test.ts`
Expected: FAIL. The module doesn't exist yet.

- [ ] **Step 3: Implement `web/lib/properties/photo-variants.ts`**

```ts
// Photos are resized in the host's browser at upload time, so public pages
// can serve a phone a 480px image instead of a 4000px original, without
// Supabase's (Pro-plan) image transformation. Decided 2026-09-25.
export const PHOTO_WIDTHS = [480, 960, 1600] as const;
export type PhotoVariant = { width: (typeof PHOTO_WIDTHS)[number]; blob: Blob };

const WEBP_QUALITY = 0.8;

export function variantPath(storagePath: string, width: number): string {
  return `${storagePath.replace(/\.[a-z0-9]+$/i, "")}.w${width}.webp`;
}

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max) return { width, height };
  return { width: max, height: Math.round((height * max) / width) };
}

// Browser only: needs createImageBitmap and a canvas. Tested in the M5
// browser walk, not in Vitest (jsdom has no canvas).
export async function makePhotoVariants(file: Blob): Promise<PhotoVariant[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const variants: PhotoVariant[] = [];
    for (const width of PHOTO_WIDTHS) {
      const size = fitWithin(bitmap.width, bitmap.height, width);
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser cannot resize photos.");
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
      if (!blob) throw new Error("This browser cannot resize photos.");
      variants.push({ width, blob });
    }
    return variants;
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run lib/properties/photo-variants.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing upload/delete tests**

Add these two tests to `web/lib/properties/photos.test.ts`. They reuse the file's existing `png()` fixture, `BASICS`, `removeObjects()` and `createTestHostWithOrg`/`createProperty` imports. Deleting a test user does **not** delete its storage objects, so each test calls `removeObjects` in `finally`. Add `PHOTO_WIDTHS` and `variantPath` to the imports from `./photo-variants`.

```ts
const tinyWebp = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

// @req PUB-07
it("uploading with variants stores each resized copy and marks the photo", async () => {
  const host = await createTestHostWithOrg();
  const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
  try {
    const { error, photo } = await uploadPropertyPhoto(host.supabase, {
      propertyId: propertyId!,
      file: png(),
      variants: PHOTO_WIDTHS.map((width) => ({ width, blob: tinyWebp() })),
    });
    expect(error).toBeNull();
    expect(photo!.has_variants).toBe(true);
    const { data } = await host.supabase.storage.from(PHOTO_BUCKET).list(propertyId!);
    const names = (data ?? []).map((o) => `${propertyId}/${o.name}`);
    for (const width of PHOTO_WIDTHS) expect(names).toContain(variantPath(photo!.storage_path, width));
  } finally {
    await removeObjects(propertyId!);
    await host.cleanup();
  }
});

// @req PUB-07
it("deleting a photo removes its variants too", async () => {
  const host = await createTestHostWithOrg();
  const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
  try {
    const { photo } = await uploadPropertyPhoto(host.supabase, {
      propertyId: propertyId!,
      file: png(),
      variants: PHOTO_WIDTHS.map((width) => ({ width, blob: tinyWebp() })),
    });
    expect(await deletePropertyPhoto(host.supabase, photo!.id)).toEqual({ error: null });
    const { data } = await host.supabase.storage.from(PHOTO_BUCKET).list(propertyId!);
    expect(data ?? []).toHaveLength(0);
  } finally {
    await removeObjects(propertyId!);
    await host.cleanup();
  }
});
```

Run: `cd web && npx vitest run lib/properties/photos.test.ts`
Expected: the two new tests FAIL (`has_variants` undefined / variants not stored).

- [ ] **Step 6: Implement variants in `photos.ts`**

In `web/lib/properties/photos.ts`:
- Import `variantPath`, `PHOTO_WIDTHS` and `type PhotoVariant` from `./photo-variants`.
- Change `PHOTO_COLUMNS` to `"id, storage_path, position, is_cover, has_variants"`, and `PropertyPhoto` to include `has_variants: boolean`.
- In `uploadPropertyPhoto`, accept `variants?: PhotoVariant[]` in the options object. After the original uploads successfully, and before the row insert, add:

```ts
  const uploadedVariants: string[] = [];
  for (const variant of variants ?? []) {
    const target = variantPath(path, variant.width);
    const { error: variantError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(target, variant.blob, { contentType: "image/webp" });
    if (variantError) {
      await supabase.storage.from(PHOTO_BUCKET).remove([path, ...uploadedVariants]);
      return { error: variantError.message };
    }
    uploadedVariants.push(target);
  }
```

- In the insert, add `has_variants: uploadedVariants.length > 0`. On insert failure, remove `[path, ...uploadedVariants]` instead of just `[path]`.
- In `deletePropertyPhoto`, select `has_variants` too. Replace the final `remove([photo.storage_path])` with:

```ts
  const paths = [photo.storage_path];
  if (photo.has_variants) paths.push(...PHOTO_WIDTHS.map((w) => variantPath(photo.storage_path, w)));
  await supabase.storage.from(PHOTO_BUCKET).remove(paths);
```

Run: `cd web && npx vitest run lib/properties/photos.test.ts lib/properties/photo-variants.test.ts`
Expected: PASS, including every pre-existing photo test.

- [ ] **Step 7: Resize in the photo manager**

In `web/app/dashboard/properties/[id]/photos/photo-manager.tsx`, inside `handleFiles`'s loop, build variants before calling upload. A browser that can't resize still uploads the original, so a failure never blocks the host:

```ts
        let variants: PhotoVariant[] = [];
        try {
          variants = await makePhotoVariants(file);
        } catch {
          variants = [];
        }
        const { error } = await uploadPropertyPhoto(supabase, { propertyId, file, variants });
```

Import `makePhotoVariants` and `type PhotoVariant` from `@/lib/properties/photo-variants`.

- [ ] **Step 8: Verify and commit**

Run: `cd web && npx tsc --noEmit && npx eslint lib/properties app/dashboard`
Expected: clean.

```bash
git add web/lib/properties web/app/dashboard/properties/[id]/photos/photo-manager.tsx
git commit -m "feat: resize property photos into 480/960/1600px WebP variants at upload"
```

---

### Task 4: Public data layer

**Files:**
- Create: `web/lib/supabase/public.ts`, `web/lib/public/catalogue.ts`, `web/lib/public/catalogue.test.ts`
- Modify: `web/lib/properties/basics.ts` (add URL helpers)

**Interfaces:**
- Consumes: Task 1 grants/policies; Task 2 `Amenity`, `amenityLabel`; Task 3 `variantPath`, `PHOTO_WIDTHS`, `has_variants`; `PHOTO_BUCKET` from `photos.ts`; `anonClient()` and `createTestHostWithOrg()` from `web/tests/helpers.ts`.
- Produces:

```ts
// web/lib/supabase/public.ts
export function createPublicClient(): SupabaseClient

// web/lib/public/catalogue.ts
export type PublicOrganization = { id: string; slug: string; name: string; headline: string; city: string; phone: string; hostingSince: number };
export type PublicPhoto = { id: string; src: string; srcSet: string };
export type PublicPropertySummary = { id: string; slug: string; name: string; propertyType: string; baseRateCents: number; maxGuests: number; cover: PublicPhoto | null };
export type PublicProperty = PublicPropertySummary & { description: string; amenities: Amenity[]; photos: PublicPhoto[] };
export const SIGNED_URL_SECONDS = 86_400;
export async function getPublicOrganization(supabase: SupabaseClient, slug: string): Promise<PublicOrganization | null>
export async function listPublishedProperties(supabase: SupabaseClient, organizationId: string): Promise<PublicPropertySummary[]>
export async function getPublishedProperty(supabase: SupabaseClient, organizationId: string, propertySlug: string): Promise<PublicProperty | null>
export function whatsappLink(phone: string): string | null
export function telLink(phone: string): string | null

// web/lib/properties/basics.ts (additions)
export function publicCatalogueUrl(organizationSlug: string): string
export function publicPropertyUrl(organizationSlug: string, propertySlug: string): string
```

- [ ] **Step 1: Write the failing tests**

Create `web/lib/public/catalogue.test.ts`. Setup uses the host's own signed-in client to create data, then reads with `anonClient()`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { anonClient, createTestHostWithOrg, supabaseAdmin } from "@/tests/helpers";
import { createProperty } from "@/lib/properties/basics";
import { PHOTO_WIDTHS } from "@/lib/properties/photo-variants";
import { uploadPropertyPhoto } from "@/lib/properties/photos";
import { updateListing } from "@/lib/properties/listing";
import { getPublicOrganization, getPublishedProperty, listPublishedProperties, telLink, whatsappLink } from "./catalogue";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

// Same 1x1 PNG the M4 photo tests use: the bucket only checks MIME type, but a real image keeps this honest.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const image = () => new Blob([PNG], { type: "image/png" });
const webp = () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" });

async function hostWithCatalogue() {
  const host = await createTestHostWithOrg();
  cleanups.unshift(host.cleanup); // runs last: objects are removed before the user
  await host.supabase
    .from("organizations")
    .update({ profile: { city: "Hunza", phone: "0300 1234567", headline: "Cabins above the river" } })
    .eq("id", host.organizationId);
  const make = async (name: string, published: boolean) => {
    const { propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { name, property_type: "cabin", address: "Secret lane 4", base_rate_cents: 1_500_000, max_guests: 4 },
    });
    if (published) await host.supabase.from("properties").update({ published: true }).eq("id", propertyId!);
    // Deleting the user cascades rows but not storage objects.
    cleanups.push(async () => {
      const admin = supabaseAdmin();
      const { data } = await admin.storage.from("property-photos").list(propertyId!);
      if (data?.length) await admin.storage.from("property-photos").remove(data.map((o) => `${propertyId}/${o.name}`));
    });
    return propertyId!;
  };
  const publishedId = await make("River Hut", true);
  const draftId = await make("Unfinished Loft", false);
  await updateListing(host.supabase, publishedId, { description: "Wake up to Rakaposhi.", amenities: ["wifi", "hot_water"] });
  await uploadPropertyPhoto(host.supabase, {
    propertyId: publishedId, file: image(), variants: PHOTO_WIDTHS.map((width) => ({ width, blob: webp() })),
  });
  return { host, publishedId, draftId };
}

// @req PUB-04
// @req PUB-03
it("anyone, signed out, can read an organisation's public profile by slug", async () => {
  const { host } = await hostWithCatalogue();
  const org = await getPublicOrganization(anonClient(), host.organizationSlug);
  expect(org).toMatchObject({ slug: host.organizationSlug, name: "Test Org", city: "Hunza", phone: "0300 1234567", headline: "Cabins above the river" });
  expect(org!.hostingSince).toBe(new Date().getFullYear());
});

// @req PUB-06
it("an unknown organisation slug reads as null, not an error", async () => {
  expect(await getPublicOrganization(anonClient(), "no-such-host-anywhere")).toBeNull();
});

// @req PUB-01
it("the catalogue lists only the organisation's published properties, with a cover", async () => {
  const { host, publishedId } = await hostWithCatalogue();
  const list = await listPublishedProperties(anonClient(), host.organizationId);
  expect(list.map((p) => p.id)).toEqual([publishedId]);
  expect(list[0]).toMatchObject({ name: "River Hut", baseRateCents: 1_500_000, maxGuests: 4, propertyType: "cabin" });
  expect(list[0].cover?.src).toMatch(/^http/);
});

// @req PUB-02
it("a published property page carries its description, amenities and photos", async () => {
  const { host, publishedId } = await hostWithCatalogue();
  const slug = (await listPublishedProperties(anonClient(), host.organizationId))[0].slug;
  const property = await getPublishedProperty(anonClient(), host.organizationId, slug);
  expect(property).toMatchObject({ id: publishedId, description: "Wake up to Rakaposhi.", amenities: ["wifi", "hot_water"] });
  expect(property!.photos).toHaveLength(1);
});

// @req PUB-07
it("photos with variants are served as a width-described srcset of signed URLs", async () => {
  const { host } = await hostWithCatalogue();
  const [summary] = await listPublishedProperties(anonClient(), host.organizationId);
  const srcSet = summary.cover!.srcSet;
  for (const width of PHOTO_WIDTHS) expect(srcSet).toMatch(new RegExp(`\\.w${width}\\.webp\\S* ${width}w`));
  const response = await fetch(summary.cover!.src);
  expect(response.status).toBe(200);
});

it("a draft property is not readable by slug, even with the right organisation", async () => {
  const { host, draftId } = await hostWithCatalogue();
  const { data } = await host.supabase.from("properties").select("slug").eq("id", draftId).single();
  expect(await getPublishedProperty(anonClient(), host.organizationId, data!.slug)).toBeNull();
});

describe("contact links", () => {
  it("turns a Pakistani number into WhatsApp and tel links", () => {
    expect(whatsappLink("0300 1234567")).toBe("https://wa.me/923001234567");
    expect(whatsappLink("+92 300-1234567")).toBe("https://wa.me/923001234567");
    expect(telLink("0300 1234567")).toBe("tel:+923001234567");
  });
  it("returns null for something that isn't a phone number", () => {
    expect(whatsappLink("")).toBeNull();
    expect(telLink("12")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run lib/public/catalogue.test.ts`
Expected: FAIL. `Cannot find module './catalogue'`.

- [ ] **Step 3: Implement the public client**

Create `web/lib/supabase/public.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public guest pages read with the anon key and no cookies: nothing about
// the visitor changes what they see, so the page can be cached, and a
// signed-in host previewing their own page sees exactly what a guest sees.
export function createPublicClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 4: Implement `web/lib/public/catalogue.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Amenity } from "@/lib/properties/listing";
import { PHOTO_BUCKET } from "@/lib/properties/photos";
import { PHOTO_WIDTHS, variantPath } from "@/lib/properties/photo-variants";

export type PublicOrganization = { id: string; slug: string; name: string; headline: string; city: string; phone: string; hostingSince: number };
export type PublicPhoto = { id: string; src: string; srcSet: string };
export type PublicPropertySummary = { id: string; slug: string; name: string; propertyType: string; baseRateCents: number; maxGuests: number; cover: PublicPhoto | null };
export type PublicProperty = PublicPropertySummary & { description: string; amenities: Amenity[]; photos: PublicPhoto[] };

// Must outlive the page cache (revalidate = 3600 on the public routes), or a
// cached page would point at expired image URLs.
export const SIGNED_URL_SECONDS = 86_400;

// Explicit column lists only: anon has column-level grants (20260922090000,
// 20260926010000), so `*` fails with 42501.
const PROPERTY_COLUMNS = "id, slug, name, property_type, base_rate_cents, max_guests";
const PHOTO_COLUMNS = "id, property_id, storage_path, position, is_cover, has_variants, created_at";

type PhotoRow = { id: string; property_id: string; storage_path: string; position: number; is_cover: boolean; has_variants: boolean; created_at: string };
type PropertyRow = { id: string; slug: string; name: string; property_type: string; base_rate_cents: number; max_guests: number };

export async function getPublicOrganization(supabase: SupabaseClient, slug: string): Promise<PublicOrganization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, name, profile, created_at")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = (data.profile ?? {}) as { city?: string; phone?: string; headline?: string };
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    headline: profile.headline ?? "",
    city: profile.city ?? "",
    phone: profile.phone ?? "",
    hostingSince: new Date(data.created_at).getFullYear(),
  };
}

// One signing round trip for every image on the page.
async function toPublicPhotos(supabase: SupabaseClient, rows: PhotoRow[]): Promise<Map<string, PublicPhoto>> {
  const result = new Map<string, PublicPhoto>();
  if (rows.length === 0) return result;
  const paths = rows.flatMap((row) =>
    row.has_variants ? PHOTO_WIDTHS.map((w) => variantPath(row.storage_path, w)) : [row.storage_path],
  );
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw error;
  const urls = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  for (const row of rows) {
    if (row.has_variants) {
      const entries = PHOTO_WIDTHS.map((w) => [w, urls.get(variantPath(row.storage_path, w))] as const).filter(([, url]) => url);
      if (entries.length === 0) continue;
      const middle = entries.find(([w]) => w === 960) ?? entries[entries.length - 1];
      result.set(row.id, { id: row.id, src: middle[1]!, srcSet: entries.map(([w, url]) => `${url} ${w}w`).join(", ") });
    } else {
      const url = urls.get(row.storage_path);
      if (url) result.set(row.id, { id: row.id, src: url, srcSet: "" });
    }
  }
  return result;
}

function ordered(rows: PhotoRow[]): PhotoRow[] {
  return [...rows].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

function summary(row: PropertyRow, cover: PublicPhoto | null): PublicPropertySummary {
  return { id: row.id, slug: row.slug, name: row.name, propertyType: row.property_type, baseRateCents: row.base_rate_cents, maxGuests: row.max_guests, cover };
}

export async function listPublishedProperties(supabase: SupabaseClient, organizationId: string): Promise<PublicPropertySummary[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("published", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const properties = (data ?? []) as PropertyRow[];
  if (properties.length === 0) return [];

  const { data: photoData, error: photoError } = await supabase
    .from("property_photos")
    .select(PHOTO_COLUMNS)
    .in("property_id", properties.map((p) => p.id))
    .eq("is_cover", true);
  if (photoError) throw photoError;
  const covers = (photoData ?? []) as PhotoRow[];
  const sources = await toPublicPhotos(supabase, covers);
  return properties.map((p) => {
    const cover = covers.find((c) => c.property_id === p.id);
    return summary(p, cover ? sources.get(cover.id) ?? null : null);
  });
}

export async function getPublishedProperty(supabase: SupabaseClient, organizationId: string, propertySlug: string): Promise<PublicProperty | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(`${PROPERTY_COLUMNS}, description, amenities`)
    .eq("organization_id", organizationId)
    .eq("slug", propertySlug.toLowerCase())
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: photoData, error: photoError } = await supabase
    .from("property_photos")
    .select(PHOTO_COLUMNS)
    .eq("property_id", data.id);
  if (photoError) throw photoError;
  const rows = ordered((photoData ?? []) as PhotoRow[]);
  const sources = await toPublicPhotos(supabase, rows);
  const photos = rows.map((r) => sources.get(r.id)).filter((p): p is PublicPhoto => Boolean(p));
  const coverRow = rows.find((r) => r.is_cover);
  const cover = coverRow ? sources.get(coverRow.id) ?? null : photos[0] ?? null;
  return { ...summary(data as PropertyRow, cover), description: data.description, amenities: data.amenities as Amenity[], photos };
}

// Pakistani numbers are written 0300 1234567, +92 300 1234567 or 92300…;
// all become 923001234567. Anything under 10 digits is not a phone number.
function internationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return `92${digits}`;
}

export function whatsappLink(phone: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

export function telLink(phone: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `tel:+${digits}` : null;
}
```

- [ ] **Step 5: Add absolute public URL helpers**

Append to `web/lib/properties/basics.ts`. Keep `publicPropertyPath` unchanged; its PROP-15 test pins the relative form:

```ts
// D-14: public pages live on the stay. subdomain when NEXT_PUBLIC_STAY_ORIGIN
// is configured (e.g. https://stay.qayam.pk). Without it, e.g. locally or
// before the domain exists, the same pages are served under /s/ on the main origin.
function stayOrigin(): string | null {
  const origin = process.env.NEXT_PUBLIC_STAY_ORIGIN?.replace(/\/+$/, "");
  return origin ? origin : null;
}

export function publicCatalogueUrl(organizationSlug: string): string {
  const origin = stayOrigin();
  return origin ? `${origin}/${organizationSlug}` : `/s/${organizationSlug}`;
}

export function publicPropertyUrl(organizationSlug: string, propertySlug: string): string {
  const origin = stayOrigin();
  return origin ? `${origin}/${organizationSlug}/${propertySlug}` : publicPropertyPath(organizationSlug, propertySlug);
}
```

Add a unit test to `web/lib/properties/basics.test.ts` (pure, no DB):

```ts
// @req PUB-05
it("public URLs use the stay origin when configured and /s/ otherwise", () => {
  const previous = process.env.NEXT_PUBLIC_STAY_ORIGIN;
  try {
    delete process.env.NEXT_PUBLIC_STAY_ORIGIN;
    expect(publicPropertyUrl("altit", "river-hut")).toBe("/s/altit/river-hut");
    expect(publicCatalogueUrl("altit")).toBe("/s/altit");
    process.env.NEXT_PUBLIC_STAY_ORIGIN = "https://stay.example.pk/";
    expect(publicPropertyUrl("altit", "river-hut")).toBe("https://stay.example.pk/altit/river-hut");
    expect(publicCatalogueUrl("altit")).toBe("https://stay.example.pk/altit");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_STAY_ORIGIN;
    else process.env.NEXT_PUBLIC_STAY_ORIGIN = previous;
  }
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd web && npx vitest run lib/public lib/properties/basics.test.ts`
Expected: PASS. If the srcset `fetch` returns 400 or 403, the anon storage policy from Task 1 is not applied. Re-run `npx supabase db reset` rather than weakening the test.

- [ ] **Step 7: Commit**

```bash
git add web/lib/supabase/public.ts web/lib/public web/lib/properties/basics.ts web/lib/properties/basics.test.ts
git commit -m "feat: read public catalogue data with a cookie-less anon client"
```

---

### Task 5: Catalogue page, not-found page and public styles

**Files:**
- Create: `web/app/s/[org]/layout.tsx`, `web/app/s/[org]/public.css`, `web/app/s/[org]/public-css.test.ts`, `web/app/s/[org]/page.tsx`, `web/app/s/[org]/catalogue-view.tsx`, `web/app/s/[org]/catalogue-view.test.tsx`, `web/app/s/[org]/not-found.tsx`, `web/components/public/host-card.tsx`

**Interfaces:**
- Consumes: Task 4 types and functions; `formatRupees`, `PROPERTY_TYPES`, `publicPropertyPath` from `basics.ts`; `Wordmark`, `buttonClasses`, icons from `components/`; `PRODUCT_NAME` from `lib/brand`.
- Produces: `export function CatalogueView({ organization, properties }: { organization: PublicOrganization; properties: PublicPropertySummary[] })`; `export function HostCard({ organization }: { organization: PublicOrganization })`; `export function propertyTypeLabel(value: string): string` (exported from `catalogue-view.tsx` for reuse by Task 6).

- [ ] **Step 1: Write the failing component and CSS tests**

Create `web/app/s/[org]/catalogue-view.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { CatalogueView } from "./catalogue-view";

const organization = {
  id: "o1", slug: "altit", name: "Altit Heights", headline: "Four cabins above the river",
  city: "Hunza", phone: "0300 1234567", hostingSince: 2026,
};
const property = {
  id: "p1", slug: "river-hut", name: "River Hut", propertyType: "cabin", baseRateCents: 1_500_000, maxGuests: 4,
  cover: { id: "ph1", src: "https://img/960.webp", srcSet: "https://img/480.webp 480w, https://img/960.webp 960w" },
};

// @req PUB-01
it("lists each published property with its price and a link to its page", () => {
  render(<CatalogueView organization={organization} properties={[property]} />);
  const link = screen.getByRole("link", { name: /river hut/i });
  expect(link).toHaveAttribute("href", "/s/altit/river-hut");
  expect(within(link).getByText("Rs 15,000")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Altit Heights");
});

// @req PUB-03
it("shows the host's profile with a way to contact them", () => {
  render(<CatalogueView organization={organization} properties={[property]} />);
  expect(screen.getByText("Hunza")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/923001234567");
});

// @req PUB-10
it("an organisation with nothing published gets a written empty state", () => {
  render(<CatalogueView organization={organization} properties={[]} />);
  expect(screen.getByText(/no places are open for booking yet/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
});
```

Create `web/app/s/[org]/public-css.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "public.css"), "utf8");

// @req PUB-08
it("public styles are mobile-first: wider layouts only ever widen, via min-width", () => {
  expect(css).toMatch(/@media \(min-width:/);
  expect(css).not.toMatch(/@media[^{]*max-width/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run "app/s"`
Expected: FAIL. The modules and `public.css` don't exist yet.

- [ ] **Step 3: Write the host card**

Create `web/components/public/host-card.tsx`:

```tsx
import type { PublicOrganization } from "@/lib/public/catalogue";
import { telLink, whatsappLink } from "@/lib/public/catalogue";
import { buttonClasses } from "@/components/ui/button";
import { IconChat } from "@/components/ui/icons";

export function HostCard({ organization }: { organization: PublicOrganization }) {
  const whatsapp = whatsappLink(organization.phone);
  const tel = telLink(organization.phone);
  return (
    <section className="host-card" aria-labelledby="host-card-title">
      <span className="host-avatar" aria-hidden="true">{organization.name.trim().charAt(0).toUpperCase()}</span>
      <div className="host-body">
        <p className="public-eyebrow">Your host</p>
        <h2 id="host-card-title" className="host-name">{organization.name}</h2>
        <p className="host-meta">
          {organization.city && <span>{organization.city}</span>}
          <span>Hosting since {organization.hostingSince}</span>
        </p>
      </div>
      {(whatsapp || tel) && (
        <div className="host-actions">
          {whatsapp && (
            <a href={whatsapp} className={buttonClasses("primary")} rel="noopener">
              <IconChat className="size-4" /> Message on WhatsApp
            </a>
          )}
          {tel && <a href={tel} className={buttonClasses("secondary")}>Call {organization.phone}</a>}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write the catalogue view**

Create `web/app/s/[org]/catalogue-view.tsx`:

```tsx
import { HostCard } from "@/components/public/host-card";
import { IconBuilding } from "@/components/ui/icons";
import { PROPERTY_TYPES, formatRupees, publicPropertyPath } from "@/lib/properties/basics";
import type { PublicOrganization, PublicPropertySummary } from "@/lib/public/catalogue";

export function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function CatalogueView({ organization, properties }: { organization: PublicOrganization; properties: PublicPropertySummary[] }) {
  return (
    <main id="main" className="public-main">
      <header className="catalogue-hero public-wrap">
        {organization.city && <p className="public-eyebrow">{organization.city}</p>}
        <h1 className="public-display">{organization.name}</h1>
        {organization.headline && <p className="catalogue-headline">{organization.headline}</p>}
      </header>

      <section className="public-wrap" aria-label="Places to stay">
        {properties.length === 0 ? (
          <div className="public-empty">
            <IconBuilding className="size-6" />
            <p className="public-empty-title">No places are open for booking yet.</p>
            <p>{organization.name} is still getting things ready. Message them to ask about dates.</p>
          </div>
        ) : (
          <ul className="property-grid">
            {properties.map((property, index) => (
              <li key={property.id}>
                <a href={publicPropertyPath(organization.slug, property.slug)} className="property-card">
                  <span className="property-card-media">
                    {property.cover ? (
                      // Signed Storage URLs with our own srcset: next/image would re-cache past URL expiry.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={property.cover.src}
                        srcSet={property.cover.srcSet || undefined}
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                        alt=""
                        loading={index < 2 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        decoding="async"
                      />
                    ) : (
                      <span className="property-card-placeholder"><IconBuilding className="size-7" /></span>
                    )}
                  </span>
                  <span className="property-card-body">
                    <span className="property-card-name">{property.name}</span>
                    <span className="property-card-meta">{propertyTypeLabel(property.propertyType)} · up to {property.maxGuests} guests</span>
                    <span className="property-card-price"><strong>{formatRupees(property.baseRateCents)}</strong> / night</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="public-wrap public-section">
        <HostCard organization={organization} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Write the layout, page and not-found page**

Create `web/app/s/[org]/layout.tsx`:

```tsx
import "./public.css";
import { Wordmark } from "@/components/brand/wordmark";
import { PRODUCT_NAME } from "@/lib/brand";

// Public guest pages (spec §8, "Two visual languages"): photo-led and calm,
// sharing every token with the dashboard. No host navigation, no session.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {children}
      <footer className="public-footer public-wrap">
        <span>Booked directly with your host.</span>
        <a href="/" className="public-footer-brand" aria-label={`${PRODUCT_NAME} home`}>
          <span>Powered by</span> <Wordmark />
        </a>
      </footer>
    </div>
  );
}
```

Create `web/app/s/[org]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicOrganization, listPublishedProperties } from "@/lib/public/catalogue";
import { CatalogueView } from "./catalogue-view";

// Cached per organisation; signed image URLs last 24h (SIGNED_URL_SECONDS).
export const revalidate = 3600;

type Props = { params: Promise<{ org: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { org } = await params;
  const organization = await getPublicOrganization(createPublicClient(), org);
  if (!organization) return { title: "Host not found" };
  return { title: organization.name, description: organization.headline || `Book a stay with ${organization.name}.` };
}

export default async function CataloguePage({ params }: Props) {
  const { org } = await params;
  const supabase = createPublicClient();
  const organization = await getPublicOrganization(supabase, org);
  if (!organization) notFound();
  const properties = await listPublishedProperties(supabase, organization.id);
  return <CatalogueView organization={organization} properties={properties} />;
}
```

Create `web/app/s/[org]/not-found.tsx`:

```tsx
import { buttonClasses } from "@/components/ui/button";

// PUB-06: a written page, not a blank 404.
export default function PublicNotFound() {
  return (
    <main id="main" className="public-main public-wrap public-not-found">
      <p className="public-eyebrow">Page not found</p>
      <h1 className="public-display">We couldn&apos;t find that host.</h1>
      <p>The link may have a typo, or the host may have changed their page address. Ask them to send it again.</p>
      <a href="/" className={buttonClasses("secondary")}>Go to the home page</a>
    </main>
  );
}
```

- [ ] **Step 6: Write `public.css`**

Create `web/app/s/[org]/public.css`. It is mobile-first, uses logical properties only, and takes colours only from tokens:

```css
/* Public guest pages. Mobile-first (PUB-08): base rules are the phone layout;
   min-width queries only ever widen. Logical properties only (A11Y-02). */
.public-shell { background: var(--surface); color: var(--ink); min-height: 100dvh; display: flex; flex-direction: column; }
.public-main { flex: 1; }
.public-wrap { width: min(1180px, 100% - 32px); margin-inline: auto; }
.public-section { margin-block: 40px 56px; }
.public-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
.public-display { font-family: var(--font-display), Georgia, serif; font-weight: 400; letter-spacing: -.035em; line-height: 1.04; font-size: 40px; text-wrap: balance; }

.catalogue-hero { padding-block: 48px 28px; display: flex; flex-direction: column; gap: 12px; }
.catalogue-headline { font-size: 17px; line-height: 1.6; color: var(--muted); max-inline-size: 52ch; }

.property-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
.property-card { display: flex; flex-direction: column; gap: 14px; border-radius: 16px; color: inherit; text-decoration: none; }
.property-card-media { position: relative; display: block; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 16px; background: var(--surface-muted); }
.property-card-media img { inline-size: 100%; block-size: 100%; object-fit: cover; transition: transform 400ms cubic-bezier(.16, 1, .3, 1); }
.property-card:hover .property-card-media img { transform: scale(1.03); }
.property-card-placeholder { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); }
.property-card-body { display: flex; flex-direction: column; gap: 4px; padding-inline: 2px; }
.property-card-name { font-size: 17px; font-weight: 500; }
.property-card-meta { font-size: 14px; color: var(--muted); }
.property-card-price { font-size: 15px; color: var(--muted); margin-block-start: 4px; }
.property-card-price strong { color: var(--ink); font-weight: 600; }

.public-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 28px 22px; border: 1px solid var(--hairline); border-radius: 16px; background: var(--surface-muted); color: var(--muted); line-height: 1.6; }
.public-empty svg { color: var(--accent); }
.public-empty-title { font-size: 18px; font-weight: 500; color: var(--ink); }

.host-card { display: grid; grid-template-columns: auto 1fr; gap: 16px 18px; align-items: center; padding: 22px; border: 1px solid var(--hairline); border-radius: 16px; background: var(--surface-muted); }
.host-avatar { display: grid; place-items: center; inline-size: 56px; block-size: 56px; border-radius: 999px; background: var(--accent); color: var(--accent-contrast); font-family: var(--font-display), Georgia, serif; font-size: 24px; }
.host-body { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
.host-name { font-family: var(--font-display), Georgia, serif; font-weight: 400; font-size: 24px; letter-spacing: -.02em; }
.host-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 14px; color: var(--muted); }
.host-actions { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; }

.public-not-found { padding-block: 72px; display: flex; flex-direction: column; align-items: flex-start; gap: 16px; max-inline-size: 640px; color: var(--muted); line-height: 1.6; }
.public-not-found .public-display { color: var(--ink); }

.public-footer { display: flex; flex-direction: column; gap: 12px; padding-block: 28px 36px; border-block-start: 1px solid var(--hairline); font-size: 13px; color: var(--muted); }
.public-footer-brand { display: inline-flex; align-items: center; gap: 8px; min-block-size: 44px; color: var(--muted); }

@media (min-width: 640px) {
  .public-wrap { width: min(1180px, 100% - 64px); }
  .public-display { font-size: 56px; }
  .catalogue-hero { padding-block: 72px 40px; }
  .property-grid { grid-template-columns: repeat(2, 1fr); gap: 28px; }
  .host-card { grid-template-columns: auto 1fr auto; padding: 28px; }
  .host-actions { grid-column: auto; flex-direction: row; }
  .public-footer { flex-direction: row; justify-content: space-between; align-items: center; }
}

@media (min-width: 1024px) {
  .public-display { font-size: 72px; }
  .property-grid { grid-template-columns: repeat(3, 1fr); }
}
```

- [ ] **Step 7: Run the tests and the auditor**

Run: `cd web && npx vitest run "app/s" && cd .. && npm run audit`
Expected: tests PASS, and the audit reports no physical-property failures in `public.css`.

- [ ] **Step 8: Commit**

```bash
git add web/app/s web/components/public
git commit -m "feat: public host catalogue page with written empty and not-found states"
```

---

### Task 6: Property page

**Files:**
- Create: `web/app/s/[org]/[property]/page.tsx`, `web/app/s/[org]/[property]/property-view.tsx`, `web/app/s/[org]/[property]/property-view.test.tsx`
- Modify: `web/app/s/[org]/public.css` (append property-page rules)

**Interfaces:**
- Consumes: Task 4 `getPublicOrganization`, `getPublishedProperty`, `whatsappLink`, `PublicProperty`, `PublicOrganization`; Task 2 `amenityLabel`; Task 5 `HostCard`, `propertyTypeLabel`, `public.css`.
- Produces: `export function PropertyView({ organization, property }: { organization: PublicOrganization; property: PublicProperty })`.

- [ ] **Step 1: Write the failing test**

Create `web/app/s/[org]/[property]/property-view.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PropertyView } from "./property-view";

const organization = { id: "o1", slug: "altit", name: "Altit Heights", headline: "", city: "Hunza", phone: "0300 1234567", hostingSince: 2026 };
const photo = (id: string) => ({ id, src: `https://img/${id}.webp`, srcSet: `https://img/${id}.w480.webp 480w` });
const property = {
  id: "p1", slug: "river-hut", name: "River Hut", propertyType: "cabin", baseRateCents: 1_500_000, maxGuests: 4,
  cover: photo("a"), photos: [photo("a"), photo("b"), photo("c")],
  description: "Wake up to Rakaposhi.\n\nA wood stove keeps the cabin warm.", amenities: ["wifi" as const, "hot_water" as const],
};

// @req PUB-02
it("shows the gallery, nightly price, amenities and description", () => {
  render(<PropertyView organization={organization} property={property} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("River Hut");
  expect(within(screen.getByRole("region", { name: /photos/i })).getAllByRole("img")).toHaveLength(3);
  expect(screen.getAllByText("Rs 15,000").length).toBeGreaterThan(0);
  const amenities = screen.getByRole("list", { name: /amenities/i });
  expect(within(amenities).getByText("Wi-Fi")).toBeInTheDocument();
  expect(within(amenities).getByText("Hot water")).toBeInTheDocument();
  expect(screen.getByText("A wood stove keeps the cabin warm.")).toBeInTheDocument();
});

// @req PUB-03
it("shows the host profile and a way to ask about dates", () => {
  render(<PropertyView organization={organization} property={property} />);
  expect(screen.getByRole("heading", { name: "Altit Heights" })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /whatsapp/i })[0]).toHaveAttribute("href", expect.stringContaining("https://wa.me/923001234567"));
});

it("a property with no photos, description or amenities still renders cleanly", () => {
  render(<PropertyView organization={organization} property={{ ...property, cover: null, photos: [], description: "", amenities: [] }} />);
  expect(screen.getByText(/photos coming soon/i)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: /amenities/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run "app/s/[org]/[property]"`
Expected: FAIL. The module doesn't exist yet.

- [ ] **Step 3: Write the property view**

Create `web/app/s/[org]/[property]/property-view.tsx`:

```tsx
import { HostCard } from "@/components/public/host-card";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowLeft, IconCheck, IconChat, IconPhoto, IconUser } from "@/components/ui/icons";
import { formatRupees } from "@/lib/properties/basics";
import { amenityLabel } from "@/lib/properties/listing";
import { whatsappLink, type PublicOrganization, type PublicProperty } from "@/lib/public/catalogue";
import { propertyTypeLabel } from "../catalogue-view";

export function PropertyView({ organization, property }: { organization: PublicOrganization; property: PublicProperty }) {
  const price = formatRupees(property.baseRateCents);
  const whatsapp = whatsappLink(organization.phone);
  const ask = whatsapp ? `${whatsapp}?text=${encodeURIComponent(`Hi, I'd like to ask about staying at ${property.name}.`)}` : null;
  const paragraphs = property.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <main id="main" className="public-main">
      <div className="public-wrap property-top">
        <a href={`/s/${organization.slug}`} className="property-back"><IconArrowLeft /> All places by {organization.name}</a>
      </div>

      <section className="gallery public-wrap" aria-label="Photos">
        {property.photos.length === 0 ? (
          <div className="gallery-empty"><IconPhoto className="size-7" /><span>Photos coming soon</span></div>
        ) : (
          <div className="gallery-track">
            {property.photos.map((photo, index) => (
              <figure key={photo.id} className="gallery-item">
                {/* Signed Storage URLs with our own srcset: next/image would re-cache past URL expiry. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  srcSet={photo.srcSet || undefined}
                  sizes={index === 0 ? "(min-width: 1024px) 60vw, 92vw" : "(min-width: 1024px) 30vw, 92vw"}
                  alt={`${property.name}, photo ${index + 1} of ${property.photos.length}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        )}
      </section>

      <div className="public-wrap property-layout">
        <article className="property-main">
          <header className="property-heading">
            <p className="public-eyebrow">{propertyTypeLabel(property.propertyType)}{organization.city ? ` · ${organization.city}` : ""}</p>
            <h1 className="public-display">{property.name}</h1>
            <p className="property-facts"><IconUser className="size-4" /> Up to {property.maxGuests} guests</p>
          </header>

          {paragraphs.length > 0 && (
            <section className="property-section" aria-labelledby="about-title">
              <h2 id="about-title" className="property-section-title">About this place</h2>
              <div className="property-description">{paragraphs.map((p) => <p key={p}>{p}</p>)}</div>
            </section>
          )}

          {property.amenities.length > 0 && (
            <section className="property-section" aria-labelledby="amenities-title">
              <h2 id="amenities-title" className="property-section-title">What this place offers</h2>
              <ul className="amenity-list" aria-label="Amenities">
                {property.amenities.map((a) => <li key={a}><IconCheck className="size-4" />{amenityLabel(a)}</li>)}
              </ul>
            </section>
          )}

          <div className="property-section"><HostCard organization={organization} /></div>
        </article>

        <aside className="booking-panel" aria-label="Price and contact">
          <p className="booking-price"><strong>{price}</strong> / night</p>
          <p className="booking-note">Dates, availability and booking requests are coming soon. For now, message the host to ask.</p>
          {ask && <a href={ask} className={buttonClasses("primary", "w-full")} rel="noopener"><IconChat className="size-4" /> Ask about dates on WhatsApp</a>}
        </aside>
      </div>

      {ask && (
        <div className="booking-bar" role="region" aria-label="Book this place">
          <p><strong>{price}</strong> / night</p>
          <a href={ask} className={buttonClasses("primary")} rel="noopener">Ask on WhatsApp</a>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Write the page**

Create `web/app/s/[org]/[property]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicOrganization, getPublishedProperty } from "@/lib/public/catalogue";
import { formatRupees } from "@/lib/properties/basics";
import { PropertyView } from "./property-view";

export const revalidate = 3600;

type Props = { params: Promise<{ org: string; property: string }> };

async function load(orgSlug: string, propertySlug: string) {
  const supabase = createPublicClient();
  const organization = await getPublicOrganization(supabase, orgSlug);
  if (!organization) return null;
  const property = await getPublishedProperty(supabase, organization.id, propertySlug);
  return property ? { organization, property } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { org, property } = await params;
  const data = await load(org, property);
  if (!data) return { title: "Place not found" };
  return {
    title: `${data.property.name} · ${data.organization.name}`,
    description: `${formatRupees(data.property.baseRateCents)} a night, up to ${data.property.maxGuests} guests. Book directly with ${data.organization.name}.`,
    openGraph: data.property.cover ? { images: [data.property.cover.src] } : undefined,
  };
}

export default async function PropertyPage({ params }: Props) {
  const { org, property } = await params;
  const data = await load(org, property);
  if (!data) notFound();
  return <PropertyView organization={data.organization} property={data.property} />;
}
```

`generateMetadata` and the page each call `load`. Wrap `load` in React's `cache` (`import { cache } from "react"; const load = cache(async (…) => …)`) so the two share one set of reads per request.

- [ ] **Step 5: Append the property styles to `public.css`**

Add these rules before the `@media (min-width: 640px)` block:

```css
.property-top { padding-block: 16px 12px; }
.property-back { display: inline-flex; align-items: center; gap: 6px; min-block-size: 44px; font-size: 14px; color: var(--muted); }
.property-back:hover { color: var(--ink); }

.gallery-track { display: flex; gap: 10px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; margin-inline: -16px; padding-inline: 16px; }
.gallery-track::-webkit-scrollbar { display: none; }
.gallery-item { flex: 0 0 88%; scroll-snap-align: start; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 16px; background: var(--surface-muted); }
.gallery-item img { inline-size: 100%; block-size: 100%; object-fit: cover; }
.gallery-empty { display: grid; place-items: center; gap: 8px; aspect-ratio: 16 / 9; border-radius: 16px; background: var(--surface-muted); color: var(--muted); font-size: 14px; }

.property-layout { display: flex; flex-direction: column; gap: 28px; padding-block: 28px 120px; }
.property-heading { display: flex; flex-direction: column; gap: 10px; }
.property-facts { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; color: var(--muted); }
.property-section { padding-block-start: 28px; margin-block-start: 28px; border-block-start: 1px solid var(--hairline); }
.property-section-title { font-size: 19px; font-weight: 500; margin-block-end: 14px; }
.property-description { display: flex; flex-direction: column; gap: 14px; font-size: 16px; line-height: 1.7; color: var(--ink); max-inline-size: 68ch; }
.amenity-list { display: grid; grid-template-columns: 1fr; gap: 12px; }
.amenity-list li { display: flex; align-items: center; gap: 10px; font-size: 15px; }
.amenity-list svg { color: var(--accent); flex-shrink: 0; }

.booking-panel { display: none; }
.booking-price { font-size: 15px; color: var(--muted); }
.booking-price strong { font-size: 26px; font-weight: 600; color: var(--ink); letter-spacing: -.01em; }
.booking-note { font-size: 14px; line-height: 1.6; color: var(--muted); }

.booking-bar { position: fixed; inset-inline: 0; inset-block-end: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px max(12px, env(safe-area-inset-bottom)); border-block-start: 1px solid var(--hairline); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(12px); font-size: 14px; color: var(--muted); }
.booking-bar strong { font-size: 18px; color: var(--ink); }
```

Then add inside the existing `@media (min-width: 640px)` block:

```css
  .gallery-track { margin-inline: 0; padding-inline: 0; }
  .gallery-item { flex-basis: 60%; }
  .amenity-list { grid-template-columns: repeat(2, 1fr); }
```

And inside the existing `@media (min-width: 1024px)` block:

```css
  .gallery-track { display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: repeat(2, 1fr); gap: 10px; overflow: visible; block-size: 460px; }
  .gallery-item { aspect-ratio: auto; }
  .gallery-item:first-child { grid-row: 1 / span 2; }
  .gallery-item:nth-child(n + 6) { display: none; }
  .property-layout { flex-direction: row; align-items: flex-start; gap: 64px; padding-block: 40px 72px; }
  .property-main { flex: 1; min-inline-size: 0; }
  .booking-panel { display: flex; flex-direction: column; gap: 14px; position: sticky; inset-block-start: 24px; inline-size: 340px; flex-shrink: 0; padding: 24px; border: 1px solid var(--hairline); border-radius: 16px; background: var(--surface); box-shadow: var(--shadow-sheet); }
  .booking-bar { display: none; }
```

- [ ] **Step 6: Run tests, audit, and commit**

Run: `cd web && npx vitest run "app/s" && cd .. && npm run audit`
Expected: PASS; no physical-property failures.

```bash
git add web/app/s
git commit -m "feat: public property page with gallery, amenities, host profile and WhatsApp contact"
```

---

### Task 7: Stay subdomain rewrite, public-path fast lane, no cross-org route

**Files:**
- Modify: `web/lib/supabase/middleware.ts`, `web/lib/supabase/middleware.test.ts`
- Create: `web/app/s/routes.test.ts`
- Modify: `web/app/dashboard/properties/property-list.tsx`, `web/app/dashboard/properties/[id]/page.tsx` (use `publicPropertyUrl`)

**Interfaces:**
- Consumes: Task 4 `publicPropertyUrl`; `STAY_HOST` env var (server-side, e.g. `stay.qayam.pk`).
- Produces: `export function stayRewritePath(host: string | null, pathname: string, stayHost: string | undefined): string | null` and `export function isPublicPath(pathname: string): boolean` in `middleware.ts`.

- [ ] **Step 1: Write the failing tests**

Add to `web/lib/supabase/middleware.test.ts` (keep its existing imports and style; add `stayRewritePath`, `isPublicPath` and `updateSession` imports if they are missing):

```ts
// @req PUB-05
it("requests to the stay host are rewritten onto /s/*", () => {
  expect(stayRewritePath("stay.example.pk", "/altit", "stay.example.pk")).toBe("/s/altit");
  expect(stayRewritePath("stay.example.pk", "/altit/river-hut", "stay.example.pk")).toBe("/s/altit/river-hut");
  expect(stayRewritePath("stay.example.pk:3000", "/altit", "stay.example.pk")).toBe("/s/altit");
  // Links rendered as /s/... must not be doubled on the stay host.
  expect(stayRewritePath("stay.example.pk", "/s/altit", "stay.example.pk")).toBeNull();
  // The app's own host, and an unconfigured stay host, are left alone.
  expect(stayRewritePath("app.example.pk", "/altit", "stay.example.pk")).toBeNull();
  expect(stayRewritePath("stay.example.pk", "/altit", undefined)).toBeNull();
});

// @req PUB-05
it("the middleware rewrites a stay-host request to the /s/ route", async () => {
  const previous = process.env.STAY_HOST;
  process.env.STAY_HOST = "stay.example.pk";
  try {
    const request = new NextRequest("https://stay.example.pk/altit/river-hut");
    const response = await updateSession(request);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://stay.example.pk/s/altit/river-hut");
  } finally {
    if (previous === undefined) delete process.env.STAY_HOST;
    else process.env.STAY_HOST = previous;
  }
});

// @req PUB-04
it("public pages never require a session", async () => {
  expect(isPublicPath("/s/altit")).toBe(true);
  expect(isProtectedPath("/s/altit/river-hut")).toBe(false);
  const response = await updateSession(new NextRequest("http://localhost:3000/s/altit"));
  expect(response.status).toBe(200);
  expect(response.headers.get("location")).toBeNull();
});
```

If `NextRequest` isn't already imported in the test file, import it from `next/server`.

Create `web/app/s/routes.test.ts`:

```ts
// @vitest-environment node
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function routeFiles(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) return routeFiles(path.join(dir, entry.name), rel);
    return /^(page|route)\.(tsx|ts)$/.test(entry.name) ? [rel] : [];
  });
}

// @req PUB-09
it("no route lists or searches properties across organisations", () => {
  expect(existsSync(path.join(appDir, "s", "page.tsx"))).toBe(false);
  const publicRoutes = routeFiles(path.join(appDir, "s"), "/s");
  expect(publicRoutes.sort()).toEqual(["/s/[org]/[property]/page.tsx", "/s/[org]/page.tsx"]);
  const all = routeFiles(appDir);
  expect(all.filter((r) => /search|explore|browse|discover|listings/i.test(r))).toEqual([]);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run lib/supabase/middleware.test.ts app/s/routes.test.ts`
Expected: the middleware tests FAIL (`stayRewritePath` is not exported). The routes test PASSes already, because Task 5/6 created exactly those two routes and nothing else. That's correct: it is a guard against regressions.

- [ ] **Step 3: Implement in `web/lib/supabase/middleware.ts`**

Add above `updateSession`:

```ts
// Guest pages: no session is read or refreshed, keeping the first byte fast
// on mobile data (PERF-01), and a guest never needs to log in (PUB-04).
export function isPublicPath(pathname: string): boolean {
  return pathname === "/s" || pathname.startsWith("/s/");
}

// D-14: the stay. subdomain serves /s/* at its root, so the link a host puts
// in their Instagram bio is short (stay.qayam.pk/altit). A host slug like
// "login" can't break the app, because on this host every path is a
// catalogue path. Paths already under /s/ are left as they are, so in-page
// links (rendered as /s/...) work on both hosts.
export function stayRewritePath(host: string | null, pathname: string, stayHost: string | undefined): string | null {
  if (!host || !stayHost) return null;
  if (host.split(":")[0].toLowerCase() !== stayHost.toLowerCase()) return null;
  if (isPublicPath(pathname)) return null;
  return pathname === "/" ? "/s" : `/s${pathname}`;
}
```

At the very top of `updateSession`, before the Supabase client is created:

```ts
  const rewrite = stayRewritePath(request.headers.get("host"), request.nextUrl.pathname, process.env.STAY_HOST);
  if (rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = rewrite;
    return NextResponse.rewrite(url);
  }
  if (isPublicPath(request.nextUrl.pathname)) return NextResponse.next({ request });
```

`/s` alone has no page (PUB-09), so `stay.<domain>/` renders Next's default not-found. That is acceptable: a guest always arrives with a host slug.

- [ ] **Step 4: Point dashboard links at the public URL**

In `web/app/dashboard/properties/property-list.tsx` and `web/app/dashboard/properties/[id]/page.tsx`, replace each `publicPropertyPath(orgSlug, propertySlug)` used as a link `href` or display text with `publicPropertyUrl(…)`, and update the imports. Leave `publicPropertyPath` in `basics.ts`: the PROP-15 test (`/s/sunset-stays/sea-view`) still passes because `NEXT_PUBLIC_STAY_ORIGIN` is unset in tests.

- [ ] **Step 5: Run and commit**

Run: `cd web && npx vitest run lib/supabase app/s app/dashboard && npx tsc --noEmit && npx eslint lib app`
Expected: PASS and clean.

Document the two env vars in `docs/deployment.md` under its existing environment-variable section:
- `STAY_HOST`, server-only, e.g. `stay.qayam.pk`. Requests to this host are rewritten onto `/s/*`.
- `NEXT_PUBLIC_STAY_ORIGIN`, e.g. `https://stay.qayam.pk`, used to build public links shown to hosts.

Leave both unset until the domain exists; everything works under `/s/` without them.

```bash
git add web/lib/supabase web/app/s/routes.test.ts web/app/dashboard/properties docs/deployment.md
git commit -m "feat: rewrite the stay subdomain onto /s/* and keep public pages session-free"
```

---

### Task 8: Performance budget, requirement wording, CI milestone

**Files:**
- Modify: `web/app/layout.tsx`, `docs/requirements.md`, `.github/workflows/ci.yml`, `docs/TRACKER.md` (regenerated)
- Create: `scripts/perf-public-page.mjs`

**Interfaces:**
- Consumes: everything above; a running dev or production server; a published property with photos in the local stack.
- Produces: a green `npm run audit -- --milestone M5` and a measured slow-3G load time.

- [ ] **Step 1: Stop preloading fonts that public pages rarely use**

In `web/app/layout.tsx`, add `preload: false` to the `Geist_Mono(...)` and `Noto_Nastaliq_Urdu(...)` option objects. Nastaliq alone is several hundred KB and only matters on Urdu text, and the mono face is dashboard-only. Leave Geist and Libre Caslon Display preloaded; the public pages use both above the fold. Keep the comment block above Nastaliq and the `weight: ["400", "700"]` line exactly as they are (layout.test.tsx asserts them).

Run: `cd web && npx vitest run app/layout.test.tsx`
Expected: PASS.

- [ ] **Step 2: Write the slow-3G check**

Create `scripts/perf-public-page.mjs`:

```js
// Manual budget check for PERF-01 / M5 "done when": a public property page
// must render within 3s on a throttled slow-3G profile. Not run in CI (no
// seeded data there).
// Usage: node scripts/perf-public-page.mjs http://localhost:3002/s/<org>/<property>
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
const { chromium } = require(`${globalRoot}/playwright`);

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/perf-public-page.mjs <public page url>");
  process.exit(2);
}

// Chrome DevTools' "Slow 3G": 400 ms RTT, ~400 kbit/s both ways.
const SLOW_3G = { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 };
const BUDGET_MS = 3000;

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await context.newPage();
// Warm the server (first dev-mode compile is not what a guest pays).
await page.goto(url, { waitUntil: "load" });
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.clearBrowserCache");
await cdp.send("Network.emulateNetworkConditions", SLOW_3G);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

await page.goto(url, { waitUntil: "load", timeout: 60_000 });
const timing = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const lcp = performance.getEntriesByType("largest-contentful-paint").at(-1);
  return { load: Math.round(nav.loadEventEnd), fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0), lcp: Math.round(lcp?.startTime ?? 0) };
});
await browser.close();

console.log(`FCP ${timing.fcp} ms · LCP ${timing.lcp || "n/a"} ms · load ${timing.load} ms (budget ${BUDGET_MS} ms, render = FCP)`);
if (timing.fcp > BUDGET_MS) {
  console.error("Over budget: the page does not render within 3 s on slow 3G.");
  process.exit(1);
}
```

- [ ] **Step 3: Measure against a production build**

Seed one published property with 3+ photos. Either use the dashboard in the browser (sign up → onboarding → add property → upload photos → publish), or reuse the Task 4 test setup in a scratch script. Then:

```bash
npm run build
npm run start --prefix web -- -p 3002
node scripts/perf-public-page.mjs http://localhost:3002/s/<org-slug>/<property-slug>
```

Expected: `FCP` under 3000 ms, exit code 0. If it's over, check the Network panel's transfer sizes before changing anything. The usual culprits are font preloads and an image without `sizes`. Record the three numbers in the M5 commit message.

- [ ] **Step 4: Update PUB-07's wording to the decided mechanism**

In `docs/requirements.md`, change the PUB-07 row to:

```
| PUB-07 | Images are served as pre-sized variants (480/960/1600px WebP, generated at upload) chosen by the browser for the viewport |
```

Add a row under the decision register in `docs/superpowers/specs/2026-09-20-phase-1-design.md` §2:

```
| D-21 | Photos are resized to 480/960/1600px WebP in the host's browser at upload; no Supabase image transformation | Transformation is a Pro-plan feature; resizing at upload costs nothing to run and serves phones a small image. Decided 2026-09-25 |
```

- [ ] **Step 5: Move CI to the M5 gate and regenerate the tracker**

In `.github/workflows/ci.yml`, change `npm run audit -- --milestone M4` to `npm run audit -- --milestone M5`.

Run: `npm run audit -- --milestone M5`
Expected: `Audit passed.` with M5 at 10/10. Any PUB requirement reported uncovered means its `// @req` tag is missing from the test that proves it; add the tag, don't edit the auditor.

- [ ] **Step 6: Run the full CI sequence locally**

```bash
npm run lint
npm test
npm run audit -- --milestone M5
git diff --exit-code docs/TRACKER.md || git add docs/TRACKER.md
npm run build
for u in '.bg-accent' '.bg-surface' '.hover\:bg-surface-muted' '.text-ink' '.text-accent-contrast' '.border-hairline' '.rounded-pill'; do grep -qF "$u" web/.next/static/chunks/*.css || echo "MISSING $u"; done
```

Expected: every command succeeds; no `MISSING` lines. The tracker diff is expected on the first run. Commit it with this task so CI's "tracker is stale" check passes.

- [ ] **Step 7: Commit**

```bash
git add web/app/layout.tsx scripts/perf-public-page.mjs docs/requirements.md docs/superpowers/specs/2026-09-20-phase-1-design.md .github/workflows/ci.yml docs/TRACKER.md
git commit -m "chore: M5 performance check, PUB-07 wording, and CI gate on M5"
```

---

## Milestone finish (after all tasks)

1. Final whole-branch review against this plan and the Global Constraints. Pay special attention to anything anon can now read (run the Task 1 DB test file again, and read the migration once more with "what does a stranger see?" in mind).
2. Browser walk on desktop (1440px) and mobile (390px): catalogue with properties, catalogue empty state, unknown slug, property page with 0/1/5+ photos, WhatsApp link, the stay-host rewrite (set `STAY_HOST=localhost` and open `http://localhost:3002/<org>`), and a photo upload in the dashboard producing `.w480/.w960/.w1600.webp` objects.
3. Apply the migration to the hosted project with `npx supabase db push` (hosted ref `vhzplaphuaydfwtvryla`), push `main`, and curl the live `/s/<org>` route for a 200.
