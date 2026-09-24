# M4 Properties and Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host can create, edit, publish and unpublish properties; upload, reorder, delete and choose a cover photo; fill in the full per-property knowledge base; and edit their organisation's name, public slug and catalogue headline — with another host unable to read or touch any of it, and everything surviving a logout.

**Architecture:** Same split as M3. Every requirement's logic is a plain exported async function taking a Supabase client as its first argument (`createProperty(supabase, …)`, `uploadPropertyPhoto(supabase, …)`, `updateKnowledgeBase(supabase, …)`), tested against the real local Supabase stack with no mocks. Server Actions and pages are thin glue. Photos go browser → Supabase Storage directly (a private `property-photos` bucket, object path `<propertyId>/<uuid>.<ext>`, guarded by storage RLS keyed on that first path segment) so image bytes never pass through a Server Action's 1 MB body limit. Multi-row photo operations (reorder, set cover) are single `security invoker` SQL functions so they are atomic and still RLS-scoped. The middleware gains a real signed-out redirect for `/dashboard/*`, closing the M3 follow-up that layouts don't re-run on client-side navigation.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2.8 (`useActionState`, `useTransition`), `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.0 (Storage + RPC), Postgres via Supabase migrations, Vitest 5 (web), `node --test` + `pg` (root DB tests). No new dependencies.

## Global Constraints

Copied or derived from `docs/superpowers/specs/2026-09-20-phase-1-design.md`, the M1–M3 plans, and lessons recorded after M2/M3. These apply to every task below.

- **All layout uses CSS logical properties** (`ps-4`/`pe-4`/`ms-*`/`border-e`/`start-0`, never `pl-`/`pr-`/`ml-`/`left-`). Enforced by the auditor (FOUND-14, A11Y-02).
- **One accent colour**, `bg-accent`/`text-accent-contrast`. Semantic colours are separate tokens: `text-destructive` for errors, `text-success` for confirmations, `text-warning` for cautions. Never a hardcoded colour.
- **Interactive targets at least 44px on mobile** (A11Y-01) — use `web/components/ui/button.tsx`'s `Button` for every button, never a bare `<button>`. Links used as buttons get `min-h-11`.
- **The service-role key never reaches client-side code** (SEC-01). This milestone's application code never uses it. Tests may use `supabaseAdmin()` for cleanup only.
- **Every test that proves a requirement carries a `// @req <ID>` comment** immediately above it, with an ID from `docs/requirements.md`.
- **No business logic inside a `"use server"` function, page or layout.** Extract it to `web/lib/**`; the wrapper only builds the client, calls the function, and handles redirect/revalidate.
- **Anon-facing reads of `properties` must use an explicit column list, never `select *`** — anon has column-level grants only (see `supabase/migrations/20260922090000_properties_restrict_anon_columns.sql`). Any new `properties` column that anon should read needs its own `grant select (col) … to anon`; any it should not read (knowledge base!) must not be granted.
- **Every new SQL function gets `revoke execute … from public` followed by an explicit `grant … to authenticated`.** `security definer` is not used in this milestone at all; if a task seems to need it, stop and ask.
- **Read functions never turn a database error into "not found".** Only a genuinely missing row (or a malformed id, Postgres `22P02`) yields `null`/`[]`; any other error is thrown, so an outage or an RLS/grant regression surfaces as an error page and a log line instead of a silent 404. (Decided 2026-09-25 after the Task 3 review.)
- **Money is stored as integer paisa in `*_cents` columns** (Rs 1 = 100). The UI takes and shows whole rupees.
- **Cross-organisation tests assert the failure** (an error, `null`, or an empty list) **and then re-read as the owner to prove nothing changed.** A test that only exercises the happy path does not prove PROP-14.
- **This machine is shared with unrelated projects.** Only touch Docker containers named `*_airbnb_like_system`. Never stop, restart or reconfigure anything else.
- **`npm test` needs the local stack running** (`npm run db:start` at the repo root) and `web/.env.local` pointing at it (already true since M3).
- **Next 16 page/layout `params` is a Promise:** `({ params }: { params: Promise<{ id: string }> })` then `const { id } = await params;`.
- **Commit after every task.** Never mark a step done without running the command and reading its output.

---

## File Structure

```
supabase/migrations/
└─ 20260924010000_m4_properties_photos_storage.sql   NEW — property slug, value checks, cover uniqueness,
                                                     reorder/cover RPCs, private photo bucket + storage RLS
tests/db/
└─ m4-properties.test.mjs                            NEW — schema-level checks for the migration

web/
├─ lib/
│  ├─ supabase/middleware.ts                         MODIFY — signed-out redirect for /dashboard/*, /onboarding
│  ├─ supabase/middleware.test.ts                    MODIFY — AUTH-07 at the middleware layer
│  ├─ properties/
│  │  ├─ basics.ts                                   NEW — types, parsing, create/list/get/update/publish, public path
│  │  ├─ basics.test.ts                              PROP-01..04, PROP-14, PROP-15
│  │  ├─ knowledge-base.ts                           NEW — field catalogue, parsing, get/update
│  │  ├─ knowledge-base.test.ts                      PROP-09..12, PROP-14
│  │  ├─ photo-order.ts                              NEW — moveItem(), pure
│  │  ├─ photos.ts                                   NEW — upload/list/signed URLs/reorder/cover/delete
│  │  ├─ photos.test.ts                              PROP-05..08, PROP-14
│  │  └─ survives-logout.test.ts                     M4 "done when" — PROP-05, PROP-09
│  └─ organizations/
│     ├─ settings.ts                                 NEW — getCurrentOrganization, updateOrganizationSettings
│     └─ settings.test.ts                            PROP-13
├─ tests/helpers.ts                                  MODIFY — signedInClient, anonClient, createTestHostWithOrg
├─ components/ui/input.ts                            NEW — shared input class string
└─ app/dashboard/
   ├─ _lib/context.ts                                NEW — dashboardContext(): per-page guard + org
   ├─ layout.tsx                                     MODIFY — Properties/Settings in sidebar, More → settings
   ├─ layout.test.tsx                                MODIFY
   ├─ properties/
   │  ├─ actions.ts                                  NEW — all property/photo/KB server actions
   │  ├─ page.tsx                                    NEW — list
   │  ├─ property-list.tsx                           NEW — presentational list (tested)
   │  ├─ property-list.test.tsx                      PROP-15
   │  ├─ basics-form.tsx                             NEW — shared create/edit form (client)
   │  ├─ new/page.tsx                                NEW
   │  └─ [id]/
   │     ├─ layout.tsx                               NEW — header + Basics/Photos/Knowledge tabs
   │     ├─ page.tsx                                 NEW — basics + publish toggle
   │     ├─ photos/page.tsx                          NEW
   │     ├─ photos/photo-manager.tsx                 NEW — upload, drag + buttons reorder, cover, delete (client)
   │     ├─ knowledge/page.tsx                       NEW
   │     └─ knowledge/knowledge-form.tsx             NEW (client)
   └─ settings/
      ├─ layout.tsx                                  NEW — settings sub-nav
      ├─ page.tsx                                    NEW — organisation settings
      ├─ organization-form.tsx                       NEW (client)
      └─ actions.ts                                  NEW
.github/workflows/ci.yml                             MODIFY — audit --milestone M4
docs/TRACKER.md                                      REGENERATED
```

---

## Task 1: Middleware redirects signed-out requests away from the dashboard

Closes M3 follow-up (a): `dashboard/layout.tsx` does not re-run on client-side navigation between sibling routes, and M4 adds many sibling routes under `/dashboard/properties/*`.

**Files:**
- Modify: `web/lib/supabase/middleware.ts`
- Modify: `web/lib/supabase/middleware.test.ts`

**Interfaces:**
- Produces: `isProtectedPath(pathname: string): boolean`; `updateSession(request)` now returns a 307 to `/login` for signed-out protected requests.

- [ ] **Step 1: Write the failing tests** — append to `web/lib/supabase/middleware.test.ts` (and change the import line to `import { updateSession, isProtectedPath } from "./middleware";`):

```ts
test("isProtectedPath covers the dashboard tree and onboarding only", () => {
  expect(isProtectedPath("/dashboard")).toBe(true);
  expect(isProtectedPath("/dashboard/properties/abc/photos")).toBe(true);
  expect(isProtectedPath("/onboarding")).toBe(true);
  expect(isProtectedPath("/")).toBe(false);
  expect(isProtectedPath("/login")).toBe(false);
  expect(isProtectedPath("/dashboardx")).toBe(false);
  expect(isProtectedPath("/s/sunset-stays")).toBe(false);
});

// @req AUTH-07
test("middleware redirects a signed-out request for any dashboard route to /login", async () => {
  const response = await updateSession(new NextRequest("http://localhost/dashboard/properties/abc/photos"));
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
});

test("middleware lets signed-out requests for public routes through", async () => {
  for (const path of ["/", "/login", "/signup"]) {
    const response = await updateSession(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get("location")).toBeNull();
  }
});
```

Also, in the existing first test (`middleware refreshes the session and forwards the updated cookies`), add directly after `const response = await updateSession(request);`:

```ts
  // A signed-in request to /dashboard must pass through, not bounce to login.
  expect(response.headers.get("location")).toBeNull();
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run lib/supabase/middleware.test.ts`
Expected: FAIL — `isProtectedPath` is not exported; the redirect test gets status 200.

- [ ] **Step 3: Implement** — replace `web/lib/supabase/middleware.ts` with:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Only these need a session. Everything else — the marketing page, the auth
// pages, and (from M5) the public guest pages — must stay reachable signed out.
export function isProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/onboarding";
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // The actual refresh: this call is what re-issues an expiring access
  // token using the refresh token, and writes the new pair back via
  // setAll above if the token had to be rotated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // dashboard/layout.tsx guards too, but a layout does not re-run on
  // client-side navigation between its child routes. This runs on every
  // request, including the RSC fetches that client navigation makes.
  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Carry over any cookie changes (e.g. a cleared dead session).
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return response;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npx vitest run lib/supabase/middleware.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/supabase/middleware.ts web/lib/supabase/middleware.test.ts
git commit -m "feat: redirect signed-out dashboard requests to login in middleware"
```

---

## Task 2: Migration — property slug, value checks, photo RPCs, private photo bucket

**Files:**
- Create: `supabase/migrations/20260924010000_m4_properties_photos_storage.sql`
- Create: `tests/db/m4-properties.test.mjs`

**Interfaces:**
- Produces (SQL):
  - `properties.slug text not null`, unique per organisation, format `^[a-z0-9]+(-[a-z0-9]+)*$`, auto-filled as `p-<8 hex>` when inserted null/empty; readable by anon.
  - `properties` checks: `base_rate_cents > 0`, `max_guests between 1 and 50`.
  - Partial unique index: at most one `is_cover = true` photo per property.
  - `public.reorder_property_photos(target_property_id uuid, ordered_photo_ids uuid[]) returns void` — raises `22023` unless the array lists every photo of the property exactly once; sets `position` to the 0-based array index.
  - `public.set_property_cover(target_photo_id uuid) returns void` — raises `P0002` if the photo is not visible to the caller.
  - Storage bucket `property-photos`: private, 10 MiB limit, `image/jpeg`, `image/png`, `image/webp` only. Authenticated users may read/write/delete objects only when the first path segment is the id of a property they own.

- [ ] **Step 1: Write the failing DB tests** — create `tests/db/m4-properties.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withDb,
  actAsAuthenticated,
  actAsAnon,
  createTestHost,
  insertOrg,
  insertProperty,
} from "./helpers.mjs";

// A failed statement aborts the surrounding transaction. Wrapping each
// expected failure in a savepoint lets one test assert several of them.
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

test("a property inserted without a slug gets a generated, well-formed one", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query("select slug from public.properties where id = $1", [id]);
      assert.match(rows[0].slug, /^p-[0-9a-f]{8}$/);
    });
  } finally {
    await host.cleanup();
  }
});

test("two properties in one organisation cannot share a slug, but two organisations can", async () => {
  const hostA = await createTestHost();
  const hostB = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgA = await insertOrg(db, hostA.userId);
      const orgB = await insertOrg(db, hostB.userId);
      const insert = (orgId) =>
        db.query(
          `insert into public.properties
             (organization_id, name, property_type, address, base_rate_cents, max_guests, slug)
           values ($1, 'Sea View', 'villa', 'Karachi', 500000, 4, 'sea-view')`,
          [orgId],
        );
      await insert(orgA);
      await expectPgError(db, "23505", () => insert(orgA));
      await insert(orgB);
    });
  } finally {
    await hostA.cleanup();
    await hostB.cleanup();
  }
});

test("slug format, base rate and max guests are enforced by the database", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      await expectPgError(db, "23514", () => insertProperty(db, orgId, { base_rate_cents: 0 }));
      await expectPgError(db, "23514", () => insertProperty(db, orgId, { max_guests: 0 }));
      await expectPgError(db, "23514", () => insertProperty(db, orgId, { max_guests: 51 }));
      await expectPgError(db, "23514", () =>
        db.query(
          `insert into public.properties
             (organization_id, name, property_type, address, base_rate_cents, max_guests, slug)
           values ($1, 'Bad', 'villa', 'Lahore', 500000, 4, 'Not A Slug')`,
          [orgId],
        ),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("the anon role can read a published property's slug but still not its knowledge base", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId, { published: true });
      await actAsAnon(db);
      const { rows } = await db.query("select slug from public.properties where id = $1", [id]);
      assert.equal(rows.length, 1);
      await expectPgError(db, "42501", () =>
        db.query("select knowledge_base from public.properties where id = $1", [id]),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("only one photo per property can be the cover", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const insertCover = (position) =>
        db.query(
          `insert into public.property_photos (property_id, storage_path, position, is_cover)
           values ($1, $2, $3, true)`,
          [propertyId, `${propertyId}/${position}.jpg`, position],
        );
      await insertCover(0);
      await expectPgError(db, "23505", () => insertCover(1));
    });
  } finally {
    await host.cleanup();
  }
});

test("the property-photos bucket is private and accepts only images up to 10 MiB", async () => {
  await withDb(async (db) => {
    const { rows } = await db.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'property-photos'",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].public, false);
    assert.equal(Number(rows[0].file_size_limit), 10 * 1024 * 1024);
    assert.deepEqual([...rows[0].allowed_mime_types].sort(), ["image/jpeg", "image/png", "image/webp"]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run (repo root): `node --test tests/db/m4-properties.test.mjs`
Expected: FAIL — `column "slug" does not exist`, no check violations, no bucket row.

- [ ] **Step 3: Write the migration** — create `supabase/migrations/20260924010000_m4_properties_photos_storage.sql`:

```sql
-- ---------------------------------------------------------------------------
-- properties.slug — the second half of the public URL /s/<org>/<property>.
-- The app derives it from the property name; the trigger is the fallback for
-- names with no Latin letters (e.g. written in Urdu) and for direct inserts.
-- ---------------------------------------------------------------------------
alter table public.properties add column slug text;

update public.properties
  set slug = 'p-' || left(replace(id::text, '-', ''), 8)
  where slug is null;

create function public.properties_default_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := 'p-' || left(replace(new.id::text, '-', ''), 8);
  end if;
  return new;
end;
$$;

create trigger properties_default_slug
  before insert on public.properties
  for each row execute function public.properties_default_slug();

alter table public.properties alter column slug set not null;
alter table public.properties
  add constraint properties_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint properties_organization_slug_unique unique (organization_id, slug),
  add constraint properties_base_rate_positive check (base_rate_cents > 0),
  add constraint properties_max_guests_range check (max_guests between 1 and 50);

-- anon holds column-level SELECT only (20260922090000); a new column is not
-- covered until granted explicitly. slug is public by design.
grant select (slug) on public.properties to anon;

-- ---------------------------------------------------------------------------
-- property_photos: exactly one cover, and atomic multi-row operations.
-- ---------------------------------------------------------------------------
create unique index property_photos_one_cover_idx
  on public.property_photos (property_id)
  where is_cover;

-- security invoker: runs under the caller's RLS, so another host's photos are
-- simply invisible here and the completeness check below fails for them.
create function public.reorder_property_photos(target_property_id uuid, ordered_photo_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_count integer;
  matched_count integer;
begin
  select count(*) into existing_count
    from public.property_photos where property_id = target_property_id;

  select count(distinct p.id) into matched_count
    from unnest(ordered_photo_ids) as o(id)
    join public.property_photos p on p.id = o.id and p.property_id = target_property_id;

  if existing_count = 0
     or cardinality(ordered_photo_ids) <> existing_count
     or matched_count <> existing_count then
    raise exception 'ordered_photo_ids must list every photo of the property exactly once'
      using errcode = '22023';
  end if;

  update public.property_photos p
    set position = o.ord - 1
    from unnest(ordered_photo_ids) with ordinality as o(id, ord)
    where p.id = o.id and p.property_id = target_property_id;
end;
$$;

create function public.set_property_cover(target_photo_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_property uuid;
begin
  select property_id into target_property
    from public.property_photos where id = target_photo_id;

  if target_property is null then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;

  -- Clear first: the partial unique index is checked per statement.
  update public.property_photos set is_cover = false
    where property_id = target_property and is_cover;
  update public.property_photos set is_cover = true
    where id = target_photo_id;
end;
$$;

revoke execute on function public.reorder_property_photos(uuid, uuid[]) from public;
revoke execute on function public.set_property_cover(uuid) from public;
grant execute on function public.reorder_property_photos(uuid, uuid[]) to authenticated;
grant execute on function public.set_property_cover(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage. Private: the dashboard reads through signed URLs, and M5's
-- public pages will read through a server-side image route, so a draft
-- property's photos are never world-readable (PROP-04).
-- Object path convention: <property_id>/<uuid>.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp']);

create function public.owns_property_object(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id::text = split_part(object_name, '/', 1)
      and public.owns_organization(p.organization_id)
  );
$$;

revoke execute on function public.owns_property_object(text) from public;
grant execute on function public.owns_property_object(text) to authenticated;

create policy "property_photos_objects_owner_all" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'property-photos' and public.owns_property_object(name))
  with check (bucket_id = 'property-photos' and public.owns_property_object(name));
```

- [ ] **Step 4: Apply and run the tests**

Run (repo root): `npx supabase migration up` then `node --test tests/db/m4-properties.test.mjs`
Expected: 6 tests PASS.

Then run the whole root suite to prove nothing older broke (the new checks and the slug trigger touch every property insert):

Run: `npm run test:scripts`
Expected: all PASS, including `tests/db/rls-sweep.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260924010000_m4_properties_photos_storage.sql tests/db/m4-properties.test.mjs
git commit -m "feat: add property slugs, value checks, photo RPCs and a private photo bucket"
```

---

## Task 3: Property basics — create, list, edit, publish

**Files:**
- Modify: `web/tests/helpers.ts`
- Create: `web/lib/properties/basics.ts`
- Create: `web/lib/properties/basics.test.ts`

**Interfaces:**
- Consumes: Task 2's `properties.slug` and checks.
- Produces (`web/lib/properties/basics.ts`):
  - `PROPERTY_TYPES: readonly { value: PropertyType; label: string }[]`
  - `type PropertyBasics = { name: string; property_type: PropertyType; address: string; base_rate_cents: number; max_guests: number }`
  - `type PropertySummary = { id: string; name: string; slug: string; property_type: string; base_rate_cents: number; max_guests: number; published: boolean }`
  - `type Property = PropertySummary & { address: string }`
  - `parsePropertyBasics(input: { name: unknown; propertyType: unknown; address: unknown; baseRate: unknown; maxGuests: unknown }): { ok: true; value: PropertyBasics } | { ok: false; error: string }` — `baseRate` is whole rupees
  - `slugifyPropertyName(name: string): string` — `""` when nothing Latin remains
  - `formatRupees(cents: number): string` — e.g. `"Rs 15,000"`
  - `createProperty(supabase, { organizationId, basics }): Promise<{ error: string | null; propertyId?: string }>`
  - `listProperties(supabase, organizationId): Promise<PropertySummary[]>`
  - `getProperty(supabase, propertyId): Promise<Property | null>`
  - `updatePropertyBasics(supabase, propertyId, basics): Promise<{ error: string | null }>`
  - `setPropertyPublished(supabase, propertyId, published: boolean): Promise<{ error: string | null }>`
  - `publicPropertyPath(organizationSlug, propertySlug): string` — `/s/<org>/<property>`
- Produces (`web/tests/helpers.ts`): `signedInClient(host)`, `anonClient()`, `createTestHostWithOrg()` returning `{ userId, email, password, cleanup, supabase, organizationId, organizationSlug }`.

- [ ] **Step 1: Add test helpers** — append to `web/tests/helpers.ts` (and add `type SupabaseClient` to the existing supabase-js import: `import { createClient, type SupabaseClient } from "@supabase/supabase-js";`):

```ts
export async function signedInClient(host: { email: string; password: string }): Promise<SupabaseClient> {
  const { apiUrl, anonKey } = supabaseEnv();
  const client = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: host.email, password: host.password });
  if (error) throw error;
  return client;
}

export function anonClient(): SupabaseClient {
  const { apiUrl, anonKey } = supabaseEnv();
  return createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// A signed-in host who has already been through onboarding. Callers must
// call cleanup(); deleting the user cascades to the organisation and
// everything under it.
export async function createTestHostWithOrg() {
  const host = await createTestHost();
  const supabase = await signedInClient(host);
  const slug = `test-org-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ owner_id: host.userId, name: "Test Org", slug })
    .select("id, slug")
    .single();
  if (error) {
    await host.cleanup();
    throw error;
  }
  return { ...host, supabase, organizationId: data.id as string, organizationSlug: data.slug as string };
}
```

- [ ] **Step 2: Write the failing tests** — create `web/lib/properties/basics.test.ts`:

```ts
// @vitest-environment node
import { test, expect } from "vitest";
import {
  parsePropertyBasics,
  slugifyPropertyName,
  formatRupees,
  createProperty,
  listProperties,
  getProperty,
  updatePropertyBasics,
  setPropertyPublished,
  publicPropertyPath,
  type PropertyBasics,
} from "./basics";
import { anonClient, createTestHostWithOrg } from "../../tests/helpers";

const SUNSET: PropertyBasics = {
  name: "Sunset Villa",
  property_type: "villa",
  address: "Mall Road, Murree",
  base_rate_cents: 1_500_000,
  max_guests: 4,
};

test("parsePropertyBasics converts rupees to paisa and trims text", () => {
  const parsed = parsePropertyBasics({
    name: "  Sunset Villa ",
    propertyType: "villa",
    address: " Mall Road, Murree ",
    baseRate: "15000",
    maxGuests: "4",
  });
  expect(parsed).toEqual({ ok: true, value: SUNSET });
});

test("parsePropertyBasics rejects each invalid field with a readable message", () => {
  const valid = { name: "A", propertyType: "villa", address: "B", baseRate: "100", maxGuests: "2" };
  expect(parsePropertyBasics({ ...valid, name: " " })).toMatchObject({ ok: false, error: expect.stringMatching(/name/i) });
  expect(parsePropertyBasics({ ...valid, propertyType: "castle" })).toMatchObject({ ok: false, error: expect.stringMatching(/type/i) });
  expect(parsePropertyBasics({ ...valid, address: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/address/i) });
  expect(parsePropertyBasics({ ...valid, baseRate: "0" })).toMatchObject({ ok: false, error: expect.stringMatching(/rate/i) });
  expect(parsePropertyBasics({ ...valid, baseRate: "99.5" })).toMatchObject({ ok: false, error: expect.stringMatching(/rate/i) });
  expect(parsePropertyBasics({ ...valid, maxGuests: "51" })).toMatchObject({ ok: false, error: expect.stringMatching(/guests/i) });
});

test("slugifyPropertyName produces URL-safe slugs and gives up cleanly on non-Latin names", () => {
  expect(slugifyPropertyName("Sunset Villa — Murree!")).toBe("sunset-villa-murree");
  expect(slugifyPropertyName("Café Hunza")).toBe("cafe-hunza");
  expect(slugifyPropertyName("سن سیٹ ولا")).toBe("");
  expect(slugifyPropertyName("a".repeat(60)).length).toBeLessThanOrEqual(40);
});

test("formatRupees shows whole rupees with thousands separators", () => {
  expect(formatRupees(1_500_000)).toBe("Rs 15,000");
});

// @req PROP-01
test("a host can create a property with name, type, address, base rate and max guests", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { error, propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: SUNSET,
    });
    expect(error).toBeNull();
    const property = await getProperty(host.supabase, propertyId!);
    expect(property).toMatchObject({ ...SUNSET, slug: "sunset-villa", published: false });
  } finally {
    await host.cleanup();
  }
});

test("a second property with the same name gets a different slug", async () => {
  const host = await createTestHostWithOrg();
  try {
    const first = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    const second = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    expect(second.error).toBeNull();
    const a = await getProperty(host.supabase, first.propertyId!);
    const b = await getProperty(host.supabase, second.propertyId!);
    expect(b!.slug).not.toBe(a!.slug);
    expect(b!.slug).toMatch(/^sunset-villa-[0-9a-f]{4}$/);
  } finally {
    await host.cleanup();
  }
});

test("a property named only in Urdu still gets a working slug", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { ...SUNSET, name: "سن سیٹ ولا" },
    });
    const property = await getProperty(host.supabase, propertyId!);
    expect(property!.slug).toMatch(/^p-[0-9a-f]{8}$/);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-02
test("a host can edit a property's basics", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    const edited: PropertyBasics = {
      name: "Sunset Cabin",
      property_type: "cabin",
      address: "Nathia Gali",
      base_rate_cents: 2_000_000,
      max_guests: 6,
    };
    const { error } = await updatePropertyBasics(host.supabase, propertyId!, edited);
    expect(error).toBeNull();
    expect(await getProperty(host.supabase, propertyId!)).toMatchObject(edited);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-03
test("a host can publish and unpublish a property", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    expect((await setPropertyPublished(host.supabase, propertyId!, true)).error).toBeNull();
    expect((await getProperty(host.supabase, propertyId!))!.published).toBe(true);
    expect((await setPropertyPublished(host.supabase, propertyId!, false)).error).toBeNull();
    expect((await getProperty(host.supabase, propertyId!))!.published).toBe(false);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-04
test("an unpublished property is not readable by the public; a published one is, minus its knowledge base", async () => {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    const anon = anonClient();

    const draft = await anon.from("properties").select("id, name, slug").eq("id", propertyId!);
    expect(draft.error).toBeNull();
    expect(draft.data).toEqual([]);

    await setPropertyPublished(host.supabase, propertyId!, true);
    const published = await anon.from("properties").select("id, name, slug").eq("id", propertyId!);
    expect(published.data).toHaveLength(1);

    const secrets = await anon.from("properties").select("knowledge_base").eq("id", propertyId!);
    expect(secrets.error?.code).toBe("42501");

    await setPropertyPublished(host.supabase, propertyId!, false);
    const unpublished = await anon.from("properties").select("id").eq("id", propertyId!);
    expect(unpublished.data).toEqual([]);
  } finally {
    await host.cleanup();
  }
});

// @req PROP-14
test("a host cannot read, list, edit, publish or add to another organisation's properties", async () => {
  const owner = await createTestHostWithOrg();
  const intruder = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(owner.supabase, { organizationId: owner.organizationId, basics: SUNSET });

    expect(await getProperty(intruder.supabase, propertyId!)).toBeNull();
    expect(await listProperties(intruder.supabase, owner.organizationId)).toEqual([]);
    expect((await updatePropertyBasics(intruder.supabase, propertyId!, { ...SUNSET, name: "Hijacked" })).error).not.toBeNull();
    expect((await setPropertyPublished(intruder.supabase, propertyId!, true)).error).not.toBeNull();
    expect(
      (await createProperty(intruder.supabase, { organizationId: owner.organizationId, basics: SUNSET })).error,
    ).not.toBeNull();

    // Nothing changed, as seen by the owner.
    expect(await getProperty(owner.supabase, propertyId!)).toMatchObject({ name: "Sunset Villa", published: false });
    expect(await listProperties(owner.supabase, owner.organizationId)).toHaveLength(1);
  } finally {
    await owner.cleanup();
    await intruder.cleanup();
  }
});

// @req PROP-15
test("the property list carries each property's published state and slug for its public link", async () => {
  const host = await createTestHostWithOrg();
  try {
    const a = await createProperty(host.supabase, { organizationId: host.organizationId, basics: SUNSET });
    await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { ...SUNSET, name: "River Hut" },
    });
    await setPropertyPublished(host.supabase, a.propertyId!, true);

    const list = await listProperties(host.supabase, host.organizationId);
    expect(list.map((p) => [p.name, p.published])).toEqual([
      ["Sunset Villa", true],
      ["River Hut", false],
    ]);
    expect(publicPropertyPath(host.organizationSlug, list[0].slug)).toBe(
      `/s/${host.organizationSlug}/sunset-villa`,
    );
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `cd web && npx vitest run lib/properties/basics.test.ts`
Expected: FAIL — cannot resolve `./basics`.

- [ ] **Step 4: Implement** — create `web/lib/properties/basics.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROPERTY_TYPES = [
  { value: "guesthouse", label: "Guesthouse" },
  { value: "apartment", label: "Serviced apartment" },
  { value: "cabin", label: "Cabin" },
  { value: "villa", label: "Villa" },
  { value: "farmhouse", label: "Farmhouse" },
  { value: "room", label: "Private room" },
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number]["value"];

export type PropertyBasics = {
  name: string;
  property_type: PropertyType;
  address: string;
  base_rate_cents: number;
  max_guests: number;
};

export type PropertySummary = {
  id: string;
  name: string;
  slug: string;
  property_type: string;
  base_rate_cents: number;
  max_guests: number;
  published: boolean;
};

export type Property = PropertySummary & { address: string };

const SUMMARY_COLUMNS = "id, name, slug, property_type, base_rate_cents, max_guests, published";

export function parsePropertyBasics(input: {
  name: unknown;
  propertyType: unknown;
  address: unknown;
  baseRate: unknown;
  maxGuests: unknown;
}): { ok: true; value: PropertyBasics } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim();
  const propertyType = String(input.propertyType ?? "");
  const address = String(input.address ?? "").trim();
  // Number("") is 0, which the range checks below reject — no special case.
  const baseRate = Number(String(input.baseRate ?? "").trim());
  const maxGuests = Number(String(input.maxGuests ?? "").trim());

  if (!name || name.length > 80) return { ok: false, error: "Name is required (up to 80 characters)." };
  if (!PROPERTY_TYPES.some((t) => t.value === propertyType)) return { ok: false, error: "Choose a property type." };
  if (!address || address.length > 200) return { ok: false, error: "Address is required (up to 200 characters)." };
  if (!Number.isInteger(baseRate) || baseRate < 1 || baseRate > 10_000_000) {
    return { ok: false, error: "Nightly rate must be a whole number of rupees, at least Rs 1." };
  }
  if (!Number.isInteger(maxGuests) || maxGuests < 1 || maxGuests > 50) {
    return { ok: false, error: "Max guests must be between 1 and 50." };
  }

  return {
    ok: true,
    value: {
      name,
      property_type: propertyType as PropertyType,
      address,
      base_rate_cents: baseRate * 100,
      max_guests: maxGuests,
    },
  };
}

export function slugifyPropertyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function formatRupees(cents: number): string {
  return `Rs ${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function publicPropertyPath(organizationSlug: string, propertySlug: string): string {
  return `/s/${organizationSlug}/${propertySlug}`;
}

export async function createProperty(
  supabase: SupabaseClient,
  { organizationId, basics }: { organizationId: string; basics: PropertyBasics },
): Promise<{ error: string | null; propertyId?: string }> {
  const base = slugifyPropertyName(basics.name);

  for (let attempt = 0; attempt < 4; attempt++) {
    // null lets the database trigger generate p-<hex> for non-Latin names.
    const slug = !base
      ? null
      : attempt === 0
        ? base
        : `${base.slice(0, 35).replace(/-+$/, "")}-${crypto.randomUUID().slice(0, 4)}`;

    const { data, error } = await supabase
      .from("properties")
      .insert({ organization_id: organizationId, ...basics, slug })
      .select("id")
      .single();

    if (!error) return { error: null, propertyId: data.id };
    // 23505 here can only be (organization_id, slug): retry with a suffix.
    if (error.code !== "23505") return { error: error.message };
  }

  return { error: "Could not create a unique link for this property. Try a different name." };
}

export async function listProperties(supabase: SupabaseClient, organizationId: string): Promise<PropertySummary[]> {
  const { data, error } = await supabase
    .from("properties")
    .select(SUMMARY_COLUMNS)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getProperty(supabase: SupabaseClient, propertyId: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select(`${SUMMARY_COLUMNS}, address`)
    .eq("id", propertyId)
    .maybeSingle();
  // An id that isn't a uuid (a mistyped URL) is a 22P02: treat it as not
  // found. Anything else is a real failure and must not look like a 404.
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data;
}

// RLS makes another host's row invisible, so an update against it matches
// zero rows without erroring. `.select("id")` is how that is detected.
async function updateOwnProperty(
  supabase: SupabaseClient,
  propertyId: string,
  changes: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from("properties").update(changes).eq("id", propertyId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Property not found." };
  return { error: null };
}

export function updatePropertyBasics(supabase: SupabaseClient, propertyId: string, basics: PropertyBasics) {
  return updateOwnProperty(supabase, propertyId, basics);
}

export function setPropertyPublished(supabase: SupabaseClient, propertyId: string, published: boolean) {
  return updateOwnProperty(supabase, propertyId, { published });
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd web && npx vitest run lib/properties/basics.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add web/tests/helpers.ts web/lib/properties/basics.ts web/lib/properties/basics.test.ts
git commit -m "feat: add property create, edit, publish and list with per-org slugs"
```

---

## Task 4: Knowledge base

**Files:**
- Create: `web/lib/properties/knowledge-base.ts`
- Create: `web/lib/properties/knowledge-base.test.ts`

**Interfaces:**
- Consumes: `createProperty`, `PropertyBasics` (Task 3); `createTestHostWithOrg`, `signedInClient` (Task 3 helpers).
- Produces:
  - `KNOWLEDGE_BASE_SECTIONS: readonly { title: string; fields: readonly KnowledgeBaseField[] }[]`
  - `type KnowledgeBaseField = { key: KnowledgeBaseKey; label: string; kind: "text" | "time" | "long" }`
  - `type KnowledgeBaseKey = "wifi_name" | "wifi_password" | "gate_code" | "check_in_time" | "checkout_time" | "geyser" | "generator" | "ac" | "parking" | "directions" | "nearby_food" | "nearby_attractions"`
  - `type KnowledgeBase = Partial<Record<KnowledgeBaseKey, string>>`
  - `parseKnowledgeBase(input: Record<string, unknown>): { ok: true; value: KnowledgeBase } | { ok: false; error: string }`
  - `getKnowledgeBase(supabase, propertyId): Promise<KnowledgeBase | null>`
  - `updateKnowledgeBase(supabase, propertyId, knowledgeBase): Promise<{ error: string | null }>`

These keys are what M7's AI grounding will read. Do not rename them later without a data migration.

- [ ] **Step 1: Write the failing tests** — create `web/lib/properties/knowledge-base.test.ts`:

```ts
// @vitest-environment node
import { test, expect } from "vitest";
import { createProperty, type PropertyBasics } from "./basics";
import { parseKnowledgeBase, getKnowledgeBase, updateKnowledgeBase, type KnowledgeBase } from "./knowledge-base";
import { createTestHostWithOrg } from "../../tests/helpers";

const BASICS: PropertyBasics = {
  name: "Pine Cabin",
  property_type: "cabin",
  address: "Nathia Gali",
  base_rate_cents: 1_200_000,
  max_guests: 4,
};

async function roundTrip(knowledgeBase: KnowledgeBase) {
  const host = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
    const { error } = await updateKnowledgeBase(host.supabase, propertyId!, knowledgeBase);
    expect(error).toBeNull();
    return await getKnowledgeBase(host.supabase, propertyId!);
  } finally {
    await host.cleanup();
  }
}

// @req PROP-09
test("knowledge base stores wifi credentials and gate code", async () => {
  const kb = { wifi_name: "PineCabin-5G", wifi_password: "guest-4821", gate_code: "1947#" };
  expect(await roundTrip(kb)).toEqual(kb);
});

// @req PROP-10
test("knowledge base stores geyser, generator, AC and parking instructions", async () => {
  const kb = {
    geyser: "Gas geyser switch is behind the kitchen door. Give it 10 minutes.",
    generator: "UPS covers lights and wifi. Generator starts itself after 2 minutes of load-shedding.",
    ac: "Remote is in the bedside drawer. Please keep it at 24.",
    parking: "Two cars inside the gate; more on the street.",
  };
  expect(await roundTrip(kb)).toEqual(kb);
});

// @req PROP-11
test("knowledge base stores check-in and checkout times, and rejects malformed times", async () => {
  const kb = { check_in_time: "14:00", checkout_time: "11:30" };
  expect(await roundTrip(kb)).toEqual(kb);

  expect(parseKnowledgeBase({ check_in_time: "2pm" })).toMatchObject({ ok: false, error: expect.stringMatching(/check-in/i) });
  expect(parseKnowledgeBase({ checkout_time: "24:00" })).toMatchObject({ ok: false, error: expect.stringMatching(/checkout/i) });
});

// @req PROP-12
test("knowledge base stores directions, nearby food and attractions", async () => {
  const kb = {
    directions: "From Abbottabad take the Murree road; turn left after the PTDC motel.",
    nearby_food: "Nathia Gali bazaar, 10 minutes' walk — try the chapli kebab stall.",
    nearby_attractions: "Mushkpuri trail starts 1 km away. Pipeline track is flat and easy.",
  };
  expect(await roundTrip(kb)).toEqual(kb);
});

test("parseKnowledgeBase trims, drops empty and unknown fields, and caps length", () => {
  expect(
    parseKnowledgeBase({ wifi_name: "  Pine  ", gate_code: "   ", favourite_colour: "blue" }),
  ).toEqual({ ok: true, value: { wifi_name: "Pine" } });
  expect(parseKnowledgeBase({ wifi_password: "x".repeat(201) })).toMatchObject({ ok: false });
  expect(parseKnowledgeBase({ directions: "x".repeat(2001) })).toMatchObject({ ok: false });
});

// @req PROP-14
test("a host cannot read or overwrite another organisation's knowledge base", async () => {
  const owner = await createTestHostWithOrg();
  const intruder = await createTestHostWithOrg();
  try {
    const { propertyId } = await createProperty(owner.supabase, { organizationId: owner.organizationId, basics: BASICS });
    await updateKnowledgeBase(owner.supabase, propertyId!, { gate_code: "1947#" });

    expect(await getKnowledgeBase(intruder.supabase, propertyId!)).toBeNull();
    expect((await updateKnowledgeBase(intruder.supabase, propertyId!, { gate_code: "0000" })).error).not.toBeNull();

    expect(await getKnowledgeBase(owner.supabase, propertyId!)).toEqual({ gate_code: "1947#" });
  } finally {
    await owner.cleanup();
    await intruder.cleanup();
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run lib/properties/knowledge-base.test.ts`
Expected: FAIL — cannot resolve `./knowledge-base`.

- [ ] **Step 3: Implement** — create `web/lib/properties/knowledge-base.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeBaseKey =
  | "wifi_name"
  | "wifi_password"
  | "gate_code"
  | "check_in_time"
  | "checkout_time"
  | "geyser"
  | "generator"
  | "ac"
  | "parking"
  | "directions"
  | "nearby_food"
  | "nearby_attractions";

export type KnowledgeBaseField = { key: KnowledgeBaseKey; label: string; kind: "text" | "time" | "long" };

export type KnowledgeBase = Partial<Record<KnowledgeBaseKey, string>>;

// The form renders from this, the parser validates from this, and M7's AI
// grounding reads these keys. One list, so the three cannot drift apart.
export const KNOWLEDGE_BASE_SECTIONS: readonly { title: string; fields: readonly KnowledgeBaseField[] }[] = [
  {
    title: "Access",
    fields: [
      { key: "wifi_name", label: "Wifi network name", kind: "text" },
      { key: "wifi_password", label: "Wifi password", kind: "text" },
      { key: "gate_code", label: "Gate or door code", kind: "text" },
    ],
  },
  {
    title: "Arrival and departure",
    fields: [
      { key: "check_in_time", label: "Check-in from", kind: "time" },
      { key: "checkout_time", label: "Checkout by", kind: "time" },
    ],
  },
  {
    title: "Around the house",
    fields: [
      { key: "geyser", label: "Geyser and hot water", kind: "long" },
      { key: "generator", label: "Generator or UPS during load-shedding", kind: "long" },
      { key: "ac", label: "Air conditioning", kind: "long" },
      { key: "parking", label: "Parking", kind: "long" },
    ],
  },
  {
    title: "Getting here and nearby",
    fields: [
      { key: "directions", label: "Directions", kind: "long" },
      { key: "nearby_food", label: "Nearby food", kind: "long" },
      { key: "nearby_attractions", label: "Nearby attractions", kind: "long" },
    ],
  },
];

const FIELDS = KNOWLEDGE_BASE_SECTIONS.flatMap((section) => section.fields);
const MAX_LENGTH = { text: 200, time: 5, long: 2000 } as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseKnowledgeBase(
  input: Record<string, unknown>,
): { ok: true; value: KnowledgeBase } | { ok: false; error: string } {
  const value: KnowledgeBase = {};
  for (const field of FIELDS) {
    const raw = String(input[field.key] ?? "").trim();
    if (!raw) continue;
    const max = MAX_LENGTH[field.kind];
    if (raw.length > max) return { ok: false, error: `${field.label} is too long (up to ${max} characters).` };
    if (field.kind === "time" && !TIME_PATTERN.test(raw)) {
      return { ok: false, error: `${field.label} must be a time like 14:00.` };
    }
    value[field.key] = raw;
  }
  return { ok: true, value };
}

export async function getKnowledgeBase(supabase: SupabaseClient, propertyId: string): Promise<KnowledgeBase | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("knowledge_base")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;
  return data.knowledge_base as KnowledgeBase;
}

export async function updateKnowledgeBase(
  supabase: SupabaseClient,
  propertyId: string,
  knowledgeBase: KnowledgeBase,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("properties")
    .update({ knowledge_base: knowledgeBase })
    .eq("id", propertyId)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Property not found." };
  return { error: null };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npx vitest run lib/properties/knowledge-base.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/properties/knowledge-base.ts web/lib/properties/knowledge-base.test.ts
git commit -m "feat: add the per-property knowledge base with validated fields"
```

---

## Task 5: Photos — upload, list, reorder, cover, delete

**Files:**
- Create: `web/lib/properties/photo-order.ts`
- Create: `web/lib/properties/photos.ts`
- Create: `web/lib/properties/photos.test.ts`

**Interfaces:**
- Consumes: Task 2's bucket, storage policy, `reorder_property_photos`, `set_property_cover`; Task 3's `createProperty`, helpers.
- Produces:
  - `moveItem<T>(items: readonly T[], from: number, to: number): T[]` (pure, `photo-order.ts`)
  - `PHOTO_BUCKET = "property-photos"`, `ALLOWED_PHOTO_TYPES`, `MAX_PHOTO_BYTES = 10 * 1024 * 1024`
  - `type PropertyPhoto = { id: string; storage_path: string; position: number; is_cover: boolean }`
  - `validatePhotoFile(file: { type: string; size: number }): string | null`
  - `uploadPropertyPhoto(supabase, { propertyId, file: Blob }): Promise<{ error: string | null; photo?: PropertyPhoto }>` — first photo becomes cover
  - `listPropertyPhotos(supabase, propertyId): Promise<PropertyPhoto[]>` — ordered by position
  - `signedPhotoUrls(supabase, photos, expiresInSeconds = 3600): Promise<Record<string, string>>` — keyed by photo id
  - `reorderPropertyPhotos(supabase, { propertyId, orderedIds }): Promise<{ error: string | null }>`
  - `setCoverPhoto(supabase, photoId): Promise<{ error: string | null }>`
  - `deletePropertyPhoto(supabase, photoId): Promise<{ error: string | null }>` — removes row and object; promotes the next photo if the cover was deleted

- [ ] **Step 1: Write the failing tests** — create `web/lib/properties/photos.test.ts`:

```ts
// @vitest-environment node
import { test, expect } from "vitest";
import { createProperty, type PropertyBasics } from "./basics";
import { moveItem } from "./photo-order";
import {
  PHOTO_BUCKET,
  validatePhotoFile,
  uploadPropertyPhoto,
  listPropertyPhotos,
  signedPhotoUrls,
  reorderPropertyPhotos,
  setCoverPhoto,
  deletePropertyPhoto,
} from "./photos";
import { createTestHostWithOrg, supabaseAdmin } from "../../tests/helpers";

// A real 1x1 PNG, so the bytes are a valid image, not just a labelled blob.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const png = () => new Blob([PNG], { type: "image/png" });

const BASICS: PropertyBasics = {
  name: "Photo Villa",
  property_type: "villa",
  address: "Hunza",
  base_rate_cents: 900_000,
  max_guests: 2,
};

// Deleting the test user cascades the rows but not the storage objects.
async function removeObjects(propertyId: string) {
  const admin = supabaseAdmin();
  const { data } = await admin.storage.from(PHOTO_BUCKET).list(propertyId);
  if (data?.length) {
    await admin.storage.from(PHOTO_BUCKET).remove(data.map((o) => `${propertyId}/${o.name}`));
  }
}

async function hostWithPhotos(count: number) {
  const host = await createTestHostWithOrg();
  const { propertyId } = await createProperty(host.supabase, { organizationId: host.organizationId, basics: BASICS });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const { error, photo } = await uploadPropertyPhoto(host.supabase, { propertyId: propertyId!, file: png() });
    expect(error).toBeNull();
    ids.push(photo!.id);
  }
  return {
    host,
    propertyId: propertyId!,
    ids,
    async cleanup() {
      await removeObjects(propertyId!);
      await host.cleanup();
    },
  };
}

test("moveItem moves one element and leaves the input untouched", () => {
  const input = ["a", "b", "c", "d"];
  expect(moveItem(input, 0, 2)).toEqual(["b", "c", "a", "d"]);
  expect(moveItem(input, 3, 0)).toEqual(["d", "a", "b", "c"]);
  expect(input).toEqual(["a", "b", "c", "d"]);
});

test("validatePhotoFile accepts jpeg/png/webp up to 10 MiB only", () => {
  expect(validatePhotoFile({ type: "image/jpeg", size: 1000 })).toBeNull();
  expect(validatePhotoFile({ type: "image/gif", size: 1000 })).toMatch(/jpeg|png|webp/i);
  expect(validatePhotoFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
});

// @req PROP-05
test("a host can upload photos to a property; the first becomes the cover and each is viewable by signed URL", async () => {
  const fixture = await hostWithPhotos(2);
  try {
    const photos = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(photos.map((p) => p.id)).toEqual(fixture.ids);
    expect(photos.map((p) => p.is_cover)).toEqual([true, false]);
    expect(photos.every((p) => p.storage_path.startsWith(`${fixture.propertyId}/`))).toBe(true);

    const urls = await signedPhotoUrls(fixture.host.supabase, photos);
    const response = await fetch(urls[photos[0].id]);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).equals(PNG)).toBe(true);
  } finally {
    await fixture.cleanup();
  }
});

test("the bucket itself refuses a non-image even if client-side validation is bypassed", async () => {
  const fixture = await hostWithPhotos(0);
  try {
    const { error } = await fixture.host.supabase.storage
      .from(PHOTO_BUCKET)
      .upload(`${fixture.propertyId}/evil.html`, new Blob(["<script>"], { type: "text/html" }), {
        contentType: "text/html",
      });
    expect(error).not.toBeNull();
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-06
test("a host can reorder photos, and a partial or foreign ordering is rejected", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    const [a, b, c] = fixture.ids;
    expect((await reorderPropertyPhotos(fixture.host.supabase, { propertyId: fixture.propertyId, orderedIds: [c, a, b] })).error).toBeNull();
    expect((await listPropertyPhotos(fixture.host.supabase, fixture.propertyId)).map((p) => p.id)).toEqual([c, a, b]);

    expect((await reorderPropertyPhotos(fixture.host.supabase, { propertyId: fixture.propertyId, orderedIds: [c, a] })).error).not.toBeNull();
    expect((await reorderPropertyPhotos(fixture.host.supabase, { propertyId: fixture.propertyId, orderedIds: [c, a, a] })).error).not.toBeNull();
    expect((await listPropertyPhotos(fixture.host.supabase, fixture.propertyId)).map((p) => p.id)).toEqual([c, a, b]);
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-07
test("a host can delete a photo, which removes the stored file too", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    const [, b] = fixture.ids;
    const before = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    const path = before.find((p) => p.id === b)!.storage_path;

    expect((await deletePropertyPhoto(fixture.host.supabase, b)).error).toBeNull();

    const after = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(after.map((p) => p.id)).toEqual([fixture.ids[0], fixture.ids[2]]);
    const { error } = await supabaseAdmin().storage.from(PHOTO_BUCKET).download(path);
    expect(error).not.toBeNull();
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-07
// @req PROP-08
test("deleting the cover photo promotes the next photo to cover", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    await deletePropertyPhoto(fixture.host.supabase, fixture.ids[0]);
    const after = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(after.map((p) => p.is_cover)).toEqual([true, false]);
    expect(after[0].id).toBe(fixture.ids[1]);
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-08
test("a host can set a cover photo, and only one photo is ever the cover", async () => {
  const fixture = await hostWithPhotos(3);
  try {
    expect((await setCoverPhoto(fixture.host.supabase, fixture.ids[2])).error).toBeNull();
    const photos = await listPropertyPhotos(fixture.host.supabase, fixture.propertyId);
    expect(photos.filter((p) => p.is_cover).map((p) => p.id)).toEqual([fixture.ids[2]]);
  } finally {
    await fixture.cleanup();
  }
});

// @req PROP-14
test("a host cannot see, add to, reorder, re-cover or delete another organisation's photos", async () => {
  const fixture = await hostWithPhotos(2);
  const intruder = await createTestHostWithOrg();
  try {
    const { propertyId, ids } = fixture;
    expect(await listPropertyPhotos(intruder.supabase, propertyId)).toEqual([]);
    expect((await uploadPropertyPhoto(intruder.supabase, { propertyId, file: png() })).error).not.toBeNull();
    expect((await reorderPropertyPhotos(intruder.supabase, { propertyId, orderedIds: [ids[1], ids[0]] })).error).not.toBeNull();
    expect((await setCoverPhoto(intruder.supabase, ids[1])).error).not.toBeNull();
    expect((await deletePropertyPhoto(intruder.supabase, ids[0])).error).not.toBeNull();

    const { data: objects } = await intruder.supabase.storage.from(PHOTO_BUCKET).list(propertyId);
    expect(objects ?? []).toEqual([]);

    const ownerView = await listPropertyPhotos(fixture.host.supabase, propertyId);
    expect(ownerView.map((p) => [p.id, p.is_cover])).toEqual([
      [ids[0], true],
      [ids[1], false],
    ]);
  } finally {
    await fixture.cleanup();
    await intruder.cleanup();
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run lib/properties/photos.test.ts`
Expected: FAIL — cannot resolve `./photo-order` / `./photos`.

- [ ] **Step 3: Implement the pure helper** — create `web/lib/properties/photo-order.ts`:

```ts
// Returns a new array with the element at `from` moved to index `to`.
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}
```

- [ ] **Step 4: Implement photos** — create `web/lib/properties/photos.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "property-photos";
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const PHOTO_COLUMNS = "id, storage_path, position, is_cover";

export type PropertyPhoto = { id: string; storage_path: string; position: number; is_cover: boolean };

// The bucket enforces the same limits server-side (migration 20260924010000);
// this only exists to give a readable message before bytes are sent.
export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) return "Photos must be JPEG, PNG or WebP.";
  if (file.size > MAX_PHOTO_BYTES) return "Photos must be 10 MB or smaller.";
  return null;
}

// Runs in the browser (photo-manager.tsx) with the host's session, so the
// bytes go straight to Storage; storage RLS checks the property is theirs.
export async function uploadPropertyPhoto(
  supabase: SupabaseClient,
  { propertyId, file }: { propertyId: string; file: Blob },
): Promise<{ error: string | null; photo?: PropertyPhoto }> {
  const invalid = validatePhotoFile(file);
  if (invalid) return { error: invalid };

  const path = `${propertyId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { data: last } = await supabase
    .from("property_photos")
    .select("position")
    .eq("property_id", propertyId)
    .order("position", { ascending: false })
    .limit(1);
  const isFirst = !last || last.length === 0;
  const position = isFirst ? 0 : last[0].position + 1;

  const { data, error } = await supabase
    .from("property_photos")
    .insert({ property_id: propertyId, storage_path: path, position, is_cover: isFirst })
    .select(PHOTO_COLUMNS)
    .single();

  if (error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { error: error.message };
  }
  return { error: null, photo: data };
}

export async function listPropertyPhotos(supabase: SupabaseClient, propertyId: string): Promise<PropertyPhoto[]> {
  const { data, error } = await supabase
    .from("property_photos")
    .select(PHOTO_COLUMNS)
    .eq("property_id", propertyId)
    .order("position", { ascending: true });
  if (error) {
    if (error.code === "22P02") return [];
    throw error;
  }
  return data;
}

export async function signedPhotoUrls(
  supabase: SupabaseClient,
  photos: PropertyPhoto[],
  expiresInSeconds = 3600,
): Promise<Record<string, string>> {
  if (photos.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(photos.map((p) => p.storage_path), expiresInSeconds);
  if (error || !data) return {};
  const byPath = new Map(data.map((entry) => [entry.path, entry.signedUrl]));
  const urls: Record<string, string> = {};
  for (const photo of photos) {
    const url = byPath.get(photo.storage_path);
    if (url) urls[photo.id] = url;
  }
  return urls;
}

export async function reorderPropertyPhotos(
  supabase: SupabaseClient,
  { propertyId, orderedIds }: { propertyId: string; orderedIds: string[] },
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("reorder_property_photos", {
    target_property_id: propertyId,
    ordered_photo_ids: orderedIds,
  });
  if (error) return { error: error.code === "22023" ? "That photo order is out of date. Refresh and try again." : error.message };
  return { error: null };
}

export async function setCoverPhoto(supabase: SupabaseClient, photoId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_property_cover", { target_photo_id: photoId });
  if (error) return { error: error.code === "P0002" ? "Photo not found." : error.message };
  return { error: null };
}

export async function deletePropertyPhoto(supabase: SupabaseClient, photoId: string): Promise<{ error: string | null }> {
  const { data: photo, error: readError } = await supabase
    .from("property_photos")
    .select("id, property_id, storage_path, is_cover")
    .eq("id", photoId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!photo) return { error: "Photo not found." };

  const { error } = await supabase.from("property_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };

  // Row first, then object: a leftover object is invisible clutter, whereas
  // a leftover row pointing at a missing object is a broken image.
  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  if (photo.is_cover) {
    const [next] = await listPropertyPhotos(supabase, photo.property_id);
    if (next) return setCoverPhoto(supabase, next.id);
  }
  return { error: null };
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `cd web && npx vitest run lib/properties/photos.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add web/lib/properties/photo-order.ts web/lib/properties/photos.ts web/lib/properties/photos.test.ts
git commit -m "feat: add property photo upload, ordering, cover and delete"
```

---

## Task 6: Organisation settings

**Files:**
- Create: `web/lib/organizations/settings.ts`
- Create: `web/lib/organizations/settings.test.ts`

**Interfaces:**
- Consumes: `isValidSlugFormat`, `isReservedSlug` from `web/lib/organizations/actions.ts`; `createTestHostWithOrg`.
- Produces:
  - `type OrganizationSettings = { id: string; name: string; slug: string; headline: string }`
  - `getCurrentOrganization(supabase, ownerId: string): Promise<OrganizationSettings | null>`
  - `updateOrganizationSettings(supabase, { organizationId, name, slug, headline }): Promise<{ error: string | null }>` — headline stored at `organizations.profile.headline`; other `profile` keys (city, phone) are preserved.

- [ ] **Step 1: Write the failing tests** — create `web/lib/organizations/settings.test.ts`:

```ts
// @vitest-environment node
import { test, expect } from "vitest";
import { getCurrentOrganization, updateOrganizationSettings } from "./settings";
import { createTestHostWithOrg } from "../../tests/helpers";

const uniqueSlug = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

// @req PROP-13
test("a host can edit organisation name, public slug and catalogue headline", async () => {
  const host = await createTestHostWithOrg();
  try {
    await host.supabase.from("organizations").update({ profile: { city: "Lahore", phone: "0300-1234567" } }).eq("id", host.organizationId);

    const slug = uniqueSlug("hunza-stays");
    const { error } = await updateOrganizationSettings(host.supabase, {
      organizationId: host.organizationId,
      name: "Hunza Stays",
      slug,
      headline: "Four cabins above the Attabad lake",
    });
    expect(error).toBeNull();

    expect(await getCurrentOrganization(host.supabase, host.userId)).toEqual({
      id: host.organizationId,
      name: "Hunza Stays",
      slug,
      headline: "Four cabins above the Attabad lake",
    });

    // Onboarding's city and phone survive the headline being merged in.
    const { data } = await host.supabase.from("organizations").select("profile").eq("id", host.organizationId).single();
    expect(data!.profile).toMatchObject({ city: "Lahore", phone: "0300-1234567" });
  } finally {
    await host.cleanup();
  }
});

// @req PROP-13
test("organisation settings reject a malformed, reserved or taken slug and keep the old one", async () => {
  const host = await createTestHostWithOrg();
  const other = await createTestHostWithOrg();
  try {
    const base = { organizationId: host.organizationId, name: "Hunza Stays", headline: "" };
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: "Bad Slug" })).error).toMatch(/lowercase/);
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: "dashboard" })).error).toMatch(/reserved/);
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: other.organizationSlug })).error).toMatch(/taken/);
    expect((await updateOrganizationSettings(host.supabase, { ...base, name: " ", slug: host.organizationSlug })).error).toMatch(/name/i);
    expect((await updateOrganizationSettings(host.supabase, { ...base, slug: host.organizationSlug, headline: "x".repeat(121) })).error).toMatch(/headline/i);

    expect((await getCurrentOrganization(host.supabase, host.userId))!.slug).toBe(host.organizationSlug);
  } finally {
    await host.cleanup();
    await other.cleanup();
  }
});

// @req PROP-14
test("a host cannot edit another organisation's settings", async () => {
  const owner = await createTestHostWithOrg();
  const intruder = await createTestHostWithOrg();
  try {
    const { error } = await updateOrganizationSettings(intruder.supabase, {
      organizationId: owner.organizationId,
      name: "Hijacked",
      slug: uniqueSlug("hijacked"),
      headline: "",
    });
    expect(error).not.toBeNull();
    expect(await getCurrentOrganization(intruder.supabase, owner.userId)).toBeNull();
    expect((await getCurrentOrganization(owner.supabase, owner.userId))!.name).toBe("Test Org");
  } finally {
    await owner.cleanup();
    await intruder.cleanup();
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run lib/organizations/settings.test.ts`
Expected: FAIL — cannot resolve `./settings`.

- [ ] **Step 3: Implement** — create `web/lib/organizations/settings.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { isReservedSlug, isValidSlugFormat } from "./actions";

export type OrganizationSettings = { id: string; name: string; slug: string; headline: string };

export async function getCurrentOrganization(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<OrganizationSettings | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, profile")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, slug: data.slug, headline: data.profile?.headline ?? "" };
}

export async function updateOrganizationSettings(
  supabase: SupabaseClient,
  { organizationId, name, slug, headline }: { organizationId: string; name: string; slug: string; headline: string },
): Promise<{ error: string | null }> {
  if (!name.trim() || name.length > 80) return { error: "Business name is required (up to 80 characters)." };
  if (!isValidSlugFormat(slug)) return { error: "Slug must be 3-40 lowercase letters, digits and hyphens." };
  if (isReservedSlug(slug)) return { error: "That slug is reserved. Please choose another." };
  if (headline.length > 120) return { error: "The headline can be up to 120 characters." };

  // profile also holds onboarding's city and phone; merge, don't replace.
  const { data: current, error: readError } = await supabase
    .from("organizations")
    .select("profile")
    .eq("id", organizationId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!current) return { error: "Organisation not found." };

  const { error } = await supabase
    .from("organizations")
    .update({ name: name.trim(), slug, profile: { ...current.profile, headline } })
    .eq("id", organizationId);
  if (error) {
    if (error.code === "23505") return { error: "That slug is already taken." };
    return { error: error.message };
  }
  return { error: null };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd web && npx vitest run lib/organizations/settings.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/organizations/settings.ts web/lib/organizations/settings.test.ts
git commit -m "feat: add organisation settings for name, slug and catalogue headline"
```

---

## Task 7: Dashboard UI — navigation, property list, create and edit

**Files:**
- Create: `web/components/ui/input.ts`
- Create: `web/app/dashboard/_lib/context.ts`
- Modify: `web/app/dashboard/layout.tsx`, `web/app/dashboard/layout.test.tsx`
- Create: `web/app/dashboard/properties/actions.ts`
- Create: `web/app/dashboard/properties/property-list.tsx`, `property-list.test.tsx`
- Create: `web/app/dashboard/properties/page.tsx`
- Create: `web/app/dashboard/properties/basics-form.tsx`
- Create: `web/app/dashboard/properties/new/page.tsx`
- Create: `web/app/dashboard/properties/[id]/layout.tsx`, `[id]/page.tsx`

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
  - `INPUT_CLASSES: string` (`components/ui/input.ts`)
  - `dashboardContext(): Promise<{ supabase: SupabaseClient; user: User; organization: OrganizationSettings }>` — redirects to `/login` or `/onboarding`
  - `type FormState = { error: string | null; success: boolean }` and server actions in `app/dashboard/properties/actions.ts`: `createPropertyAction(prev, formData)`, `updatePropertyAction(propertyId, prev, formData)`, `setPublishedAction(propertyId, published)`, `updateKnowledgeBaseAction(propertyId, prev, formData)`, `reorderPhotosAction(propertyId, orderedIds)`, `setCoverPhotoAction(propertyId, photoId)`, `deletePhotoAction(propertyId, photoId)` — the photo/KB ones are used by Task 8
  - `PropertyList({ organizationSlug, properties })`

- [ ] **Step 1: Write the failing component tests** — create `web/app/dashboard/properties/property-list.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertyList } from "./property-list";

const base = { property_type: "villa", base_rate_cents: 1_500_000, max_guests: 4 };

// @req PROP-15
test("property list shows published or draft state and links published properties to their public page", () => {
  render(
    <PropertyList
      organizationSlug="sunset-stays"
      properties={[
        { ...base, id: "1", name: "Sea View", slug: "sea-view", published: true },
        { ...base, id: "2", name: "River Hut", slug: "river-hut", published: false },
      ]}
    />,
  );

  expect(screen.getByText("Published")).toBeInTheDocument();
  expect(screen.getByText("Draft")).toBeInTheDocument();

  const publicLinks = screen.getAllByRole("link", { name: /view public page/i });
  expect(publicLinks).toHaveLength(1);
  expect(publicLinks[0]).toHaveAttribute("href", "/s/sunset-stays/sea-view");

  expect(screen.getByRole("link", { name: "River Hut" })).toHaveAttribute("href", "/dashboard/properties/2");
  expect(screen.getByText("Rs 15,000 / night · up to 4 guests")).toBeInTheDocument();
});

test("an empty property list explains what to do next", () => {
  render(<PropertyList organizationSlug="sunset-stays" properties={[]} />);
  expect(screen.getByText(/add your first property/i)).toBeInTheDocument();
});
```

And change `web/app/dashboard/layout.test.tsx` to (adds the new sidebar entries; the tab bar stays four items per spec §9):

```tsx
import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DashboardNav } from "./layout";

// @req AUTH-14
test("dashboard nav renders both a desktop sidebar and a mobile bottom tab bar", () => {
  render(<DashboardNav />);

  const sidebar = screen.getByTestId("dashboard-sidebar");
  const tabBar = screen.getByTestId("dashboard-tabbar");

  expect(sidebar.className).toMatch(/hidden/);
  expect(sidebar.className).toMatch(/md:flex/);
  expect(tabBar.className).toMatch(/md:hidden/);

  for (const label of ["Home", "Inbox", "Calendar", "Properties", "Settings"]) {
    expect(within(sidebar).getByText(label)).toBeInTheDocument();
  }
  for (const label of ["Home", "Inbox", "Calendar", "More"]) {
    expect(within(tabBar).getByText(label)).toBeInTheDocument();
  }
  expect(within(tabBar).getByText("More").closest("a")).toHaveAttribute("href", "/dashboard/settings");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd web && npx vitest run app/dashboard`
Expected: FAIL — `./property-list` missing; sidebar has no "Properties".

- [ ] **Step 3: Shared input style** — create `web/components/ui/input.ts`:

```ts
// One definition of the text-input look, shared by every dashboard form.
export const INPUT_CLASSES = "rounded-card border border-hairline bg-surface px-4 py-2 text-ink";
```

- [ ] **Step 4: Per-page guard** — create `web/app/dashboard/_lib/context.ts`:

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/organizations/settings";

// Every dashboard page and action calls this instead of trusting the layout
// to have run: layouts don't re-run on client-side navigation, and Server
// Actions never run the layout at all. RLS would still protect the data;
// this makes the redirect correct too.
export async function dashboardContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const organization = await getCurrentOrganization(supabase, data.user.id);
  if (!organization) redirect("/onboarding");
  return { supabase, user: data.user, organization };
}
```

- [ ] **Step 5: Navigation** — in `web/app/dashboard/layout.tsx`, replace the `NAV_ITEMS` constant and `DashboardNav` with:

```tsx
const SIDEBAR_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/properties", label: "Properties" },
  { href: "/dashboard/settings", label: "Settings" },
];

// Spec §9: exactly four tabs on mobile. "More" is the settings area, which
// also links to Properties on small screens (settings/layout.tsx).
const TAB_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/settings", label: "More" },
];

export function DashboardNav() {
  return (
    <>
      <nav
        data-testid="dashboard-sidebar"
        className="hidden md:flex md:w-56 md:flex-col md:gap-1 md:border-e md:border-hairline md:p-4"
      >
        {SIDEBAR_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-card px-4 py-2 text-sm text-ink hover:bg-surface-muted"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <nav
        data-testid="dashboard-tabbar"
        className="fixed inset-x-0 bottom-0 flex justify-around border-t border-hairline bg-surface py-2 md:hidden"
      >
        {TAB_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex min-h-11 min-w-11 items-center justify-center px-3 text-xs text-ink"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}
```

- [ ] **Step 6: Server actions** — create `web/app/dashboard/properties/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dashboardContext } from "../_lib/context";
import {
  createProperty,
  parsePropertyBasics,
  setPropertyPublished,
  updatePropertyBasics,
} from "@/lib/properties/basics";
import { parseKnowledgeBase, updateKnowledgeBase } from "@/lib/properties/knowledge-base";
import { deletePropertyPhoto, reorderPropertyPhotos, setCoverPhoto } from "@/lib/properties/photos";

export type FormState = { error: string | null; success: boolean };

function basicsFrom(formData: FormData) {
  return parsePropertyBasics({
    name: formData.get("name"),
    propertyType: formData.get("propertyType"),
    address: formData.get("address"),
    baseRate: formData.get("baseRate"),
    maxGuests: formData.get("maxGuests"),
  });
}

function refreshProperties() {
  revalidatePath("/dashboard/properties", "layout");
}

// Explicit Promise<FormState> return types throughout: redirect() never
// returns, and without the annotation TS infers a state type that no longer
// matches useActionState's initial state, failing `next build` (see M3).
export async function createPropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = basicsFrom(formData);
  if (!parsed.ok) return { error: parsed.error, success: false };
  const { supabase, organization } = await dashboardContext();
  const { error, propertyId } = await createProperty(supabase, {
    organizationId: organization.id,
    basics: parsed.value,
  });
  if (error) return { error, success: false };
  refreshProperties();
  redirect(`/dashboard/properties/${propertyId}/photos`);
}

export async function updatePropertyAction(
  propertyId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = basicsFrom(formData);
  if (!parsed.ok) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const { error } = await updatePropertyBasics(supabase, propertyId, parsed.value);
  if (error) return { error, success: false };
  refreshProperties();
  return { error: null, success: true };
}

export async function setPublishedAction(propertyId: string, published: boolean): Promise<void> {
  const { supabase } = await dashboardContext();
  await setPropertyPublished(supabase, propertyId, published);
  refreshProperties();
}

export async function updateKnowledgeBaseAction(
  propertyId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseKnowledgeBase(Object.fromEntries(formData));
  if (!parsed.ok) return { error: parsed.error, success: false };
  const { supabase } = await dashboardContext();
  const { error } = await updateKnowledgeBase(supabase, propertyId, parsed.value);
  if (error) return { error, success: false };
  refreshProperties();
  return { error: null, success: true };
}

export async function reorderPhotosAction(propertyId: string, orderedIds: string[]): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await reorderPropertyPhotos(supabase, { propertyId, orderedIds });
  refreshProperties();
  return result;
}

export async function setCoverPhotoAction(propertyId: string, photoId: string): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await setCoverPhoto(supabase, photoId);
  refreshProperties();
  return result;
}

export async function deletePhotoAction(propertyId: string, photoId: string): Promise<{ error: string | null }> {
  const { supabase } = await dashboardContext();
  const result = await deletePropertyPhoto(supabase, photoId);
  refreshProperties();
  return result;
}
```

(`propertyId` on the two photo-id actions is unused by the lib call but kept so every photo action has the same shape for the client; if ESLint flags it, rename it `_propertyId`.)

- [ ] **Step 7: Property list** — create `web/app/dashboard/properties/property-list.tsx`:

```tsx
import { formatRupees, publicPropertyPath, type PropertySummary } from "@/lib/properties/basics";

export function PropertyList({
  organizationSlug,
  properties,
}: {
  organizationSlug: string;
  properties: PropertySummary[];
}) {
  if (properties.length === 0) {
    return (
      <p className="max-w-md text-muted">
        Add your first property. You only need a name, an address and a nightly rate — photos and the
        details your AI assistant answers from can come after.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-hairline border-y border-hairline">
      {properties.map((property) => (
        <li key={property.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-col gap-1">
            <a href={`/dashboard/properties/${property.id}`} className="font-medium text-ink hover:underline">
              {property.name}
            </a>
            <span className="text-sm text-muted">
              {formatRupees(property.base_rate_cents)} / night · up to {property.max_guests} guests
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={property.published ? "text-success" : "text-muted"}>
              {property.published ? "Published" : "Draft"}
            </span>
            {property.published && (
              <a
                href={publicPropertyPath(organizationSlug, property.slug)}
                className="flex min-h-11 items-center text-ink underline"
              >
                View public page
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 8: Run the component tests**

Run: `cd web && npx vitest run app/dashboard`
Expected: all PASS.

- [ ] **Step 9: List page** — create `web/app/dashboard/properties/page.tsx`:

```tsx
import { dashboardContext } from "../_lib/context";
import { listProperties } from "@/lib/properties/basics";
import { PropertyList } from "./property-list";

export default async function PropertiesPage() {
  const { supabase, organization } = await dashboardContext();
  const properties = await listProperties(supabase, organization.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">Properties</h1>
        <a
          href="/dashboard/properties/new"
          className="inline-flex min-h-11 items-center rounded-pill bg-accent px-6 text-sm font-medium text-accent-contrast hover:opacity-90"
        >
          Add property
        </a>
      </div>
      <PropertyList organizationSlug={organization.slug} properties={properties} />
    </div>
  );
}
```

- [ ] **Step 10: Shared basics form** — create `web/app/dashboard/properties/basics-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/input";
import { PROPERTY_TYPES, type Property } from "@/lib/properties/basics";
import type { FormState } from "./actions";

export function BasicsForm({
  action,
  property,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  property?: Property;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required maxLength={80} defaultValue={property?.name} className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select name="propertyType" required defaultValue={property?.property_type ?? ""} className={INPUT_CLASSES}>
          <option value="" disabled>
            Choose…
          </option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input name="address" required maxLength={200} defaultValue={property?.address} className={INPUT_CLASSES} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nightly rate (Rs)
          <input
            name="baseRate"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={property ? property.base_rate_cents / 100 : undefined}
            className={INPUT_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Max guests
          <input
            name="maxGuests"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            required
            defaultValue={property?.max_guests}
            className={INPUT_CLASSES}
          />
        </label>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 11: New page** — create `web/app/dashboard/properties/new/page.tsx`:

```tsx
import { BasicsForm } from "../basics-form";
import { createPropertyAction } from "../actions";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium tracking-tight">Add a property</h1>
      <BasicsForm action={createPropertyAction} submitLabel="Create property" />
    </div>
  );
}
```

- [ ] **Step 12: Property layout with tabs** — create `web/app/dashboard/properties/[id]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import { dashboardContext } from "../../_lib/context";
import { getProperty } from "@/lib/properties/basics";

export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const property = await getProperty(supabase, id);
  if (!property) notFound();

  const tabs = [
    { href: `/dashboard/properties/${id}`, label: "Basics" },
    { href: `/dashboard/properties/${id}/photos`, label: "Photos" },
    { href: `/dashboard/properties/${id}/knowledge`, label: "Knowledge base" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <a href="/dashboard/properties" className="text-sm text-muted hover:text-ink">
          Properties
        </a>
        <h1 className="text-2xl font-medium tracking-tight">{property.name}</h1>
      </div>
      <nav className="flex gap-2 border-b border-hairline">
        {tabs.map((tab) => (
          <a key={tab.href} href={tab.href} className="flex min-h-11 items-center px-3 text-sm text-ink hover:bg-surface-muted">
            {tab.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 13: Basics page with publish toggle** — create `web/app/dashboard/properties/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dashboardContext } from "../../_lib/context";
import { getProperty, publicPropertyPath } from "@/lib/properties/basics";
import { BasicsForm } from "../basics-form";
import { setPublishedAction, updatePropertyAction } from "../actions";

export default async function PropertyBasicsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organization } = await dashboardContext();
  const property = await getProperty(supabase, id);
  if (!property) notFound();

  return (
    <div className="flex flex-col gap-12">
      <section className="flex max-w-md flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Visibility</h2>
        {property.published ? (
          <p>
            Published. Guests can see it at{" "}
            <a className="underline" href={publicPropertyPath(organization.slug, property.slug)}>
              {publicPropertyPath(organization.slug, property.slug)}
            </a>
            .
          </p>
        ) : (
          <p className="text-muted">Draft. Only you can see this property.</p>
        )}
        <form action={setPublishedAction.bind(null, id, !property.published)}>
          <Button type="submit" variant={property.published ? "secondary" : "primary"}>
            {property.published ? "Unpublish" : "Publish"}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Basics</h2>
        <BasicsForm action={updatePropertyAction.bind(null, id)} property={property} submitLabel="Save changes" />
      </section>
    </div>
  );
}
```

- [ ] **Step 14: Type-check, lint and run the web suite**

Run: `cd web && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: no type errors, no lint errors, all tests PASS.

- [ ] **Step 15: Commit**

```bash
git add web/components/ui/input.ts web/app/dashboard
git commit -m "feat: add property list, create and edit pages with publish toggle"
```

---

## Task 8: Photos and knowledge base pages

**Files:**
- Create: `web/app/dashboard/properties/[id]/photos/page.tsx`
- Create: `web/app/dashboard/properties/[id]/photos/photo-manager.tsx`
- Create: `web/app/dashboard/properties/[id]/knowledge/page.tsx`
- Create: `web/app/dashboard/properties/[id]/knowledge/knowledge-form.tsx`

**Interfaces:**
- Consumes: Task 5 photo functions, Task 4 knowledge base, Task 7 actions and `dashboardContext`, `web/lib/supabase/client.ts`'s `createClient()`.
- Produces: pages only. Logic is already tested in Tasks 4–5; these files are glue.

- [ ] **Step 1: Photos page** — create `web/app/dashboard/properties/[id]/photos/page.tsx`:

```tsx
import { dashboardContext } from "../../../_lib/context";
import { listPropertyPhotos, signedPhotoUrls } from "@/lib/properties/photos";
import { PhotoManager } from "./photo-manager";

export default async function PropertyPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const photos = await listPropertyPhotos(supabase, id);
  const urls = await signedPhotoUrls(supabase, photos);

  return <PhotoManager propertyId={id} photos={photos.map((photo) => ({ ...photo, url: urls[photo.id] ?? "" }))} />;
}
```

(The `[id]` layout already returns 404 for a property the host can't see.)

- [ ] **Step 2: Photo manager** — create `web/app/dashboard/properties/[id]/photos/photo-manager.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { moveItem } from "@/lib/properties/photo-order";
import { ALLOWED_PHOTO_TYPES, uploadPropertyPhoto, type PropertyPhoto } from "@/lib/properties/photos";
import { deletePhotoAction, reorderPhotosAction, setCoverPhotoAction } from "../../../actions";

type PhotoWithUrl = PropertyPhoto & { url: string };

export function PhotoManager({ propertyId, photos }: { propertyId: string; photos: PhotoWithUrl[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function run(task: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const { error } = await task();
      if (error) setError(error);
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    setError(null);
    startTransition(async () => {
      // Browser → Storage directly, with the host's own session.
      const supabase = createClient();
      for (const file of selected) {
        const { error } = await uploadPropertyPhoto(supabase, { propertyId, file });
        if (error) {
          setError(`${file.name}: ${error}`);
          break;
        }
      }
      router.refresh();
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= photos.length || from === to) return;
    const orderedIds = moveItem(photos.map((p) => p.id), from, to);
    run(() => reorderPhotosAction(propertyId, orderedIds));
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex max-w-md flex-col gap-2 text-sm">
        <span className="font-medium">Add photos</span>
        <span className="text-muted">JPEG, PNG or WebP, up to 10 MB each. The first photo is the cover until you choose another.</span>
        <input
          type="file"
          accept={ALLOWED_PHOTO_TYPES.join(",")}
          multiple
          disabled={pending}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
          className="min-h-11 text-sm"
        />
      </label>

      {pending && <p className="text-sm text-muted">Working…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {photos.length === 0 ? (
        <p className="text-muted">No photos yet. Guests decide in seconds — lead with the view or the best room.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className="flex flex-col gap-2"
            >
              {/* Private bucket, short-lived signed URL: next/image's optimiser would cache it past expiry. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Photo ${index + 1}`} className="aspect-[4/3] w-full rounded-card object-cover" />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {photo.is_cover ? (
                  <span className="px-3 text-success">Cover</span>
                ) : (
                  <Button variant="ghost" disabled={pending} onClick={() => run(() => setCoverPhotoAction(propertyId, photo.id))}>
                    Make cover
                  </Button>
                )}
                <Button variant="ghost" disabled={pending || index === 0} aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, index - 1)}>
                  Earlier
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending || index === photos.length - 1}
                  aria-label={`Move photo ${index + 1} later`}
                  onClick={() => move(index, index + 1)}
                >
                  Later
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm("Delete this photo? This cannot be undone.")) {
                      run(() => deletePhotoAction(propertyId, photo.id));
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

Drag-and-drop covers desktop; the Earlier/Later buttons are the reorder path on touch screens, where HTML5 drag events do not fire.

- [ ] **Step 3: Knowledge page** — create `web/app/dashboard/properties/[id]/knowledge/page.tsx`:

```tsx
import { dashboardContext } from "../../../_lib/context";
import { getKnowledgeBase } from "@/lib/properties/knowledge-base";
import { updateKnowledgeBaseAction } from "../../../actions";
import { KnowledgeForm } from "./knowledge-form";

export default async function PropertyKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const knowledgeBase = (await getKnowledgeBase(supabase, id)) ?? {};

  return <KnowledgeForm action={updateKnowledgeBaseAction.bind(null, id)} knowledgeBase={knowledgeBase} />;
}
```

- [ ] **Step 4: Knowledge form** — create `web/app/dashboard/properties/[id]/knowledge/knowledge-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/input";
import { KNOWLEDGE_BASE_SECTIONS, type KnowledgeBase } from "@/lib/properties/knowledge-base";
import type { FormState } from "../../../actions";

export function KnowledgeForm({
  action,
  knowledgeBase,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  knowledgeBase: KnowledgeBase;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-10">
      <p className="text-muted">
        Guests never see this page. Your AI assistant answers their questions from it, so write the way you would
        explain it on the phone. Wifi and gate codes stay private until a guest&apos;s stay begins.
      </p>

      {KNOWLEDGE_BASE_SECTIONS.map((section) => (
        <fieldset key={section.title} className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-medium text-muted">{section.title}</legend>
          {section.fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-sm">
              {field.label}
              {field.kind === "long" ? (
                <textarea
                  name={field.key}
                  rows={3}
                  maxLength={2000}
                  defaultValue={knowledgeBase[field.key] ?? ""}
                  className={INPUT_CLASSES}
                />
              ) : (
                <input
                  name={field.key}
                  type={field.kind === "time" ? "time" : "text"}
                  maxLength={field.kind === "time" ? undefined : 200}
                  defaultValue={knowledgeBase[field.key] ?? ""}
                  className={INPUT_CLASSES}
                />
              )}
            </label>
          ))}
        </fieldset>
      ))}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save knowledge base"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Type-check, lint, test**

Run: `cd web && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean, all PASS.

- [ ] **Step 6: Walk it by hand** (Server Actions and the browser upload path are not unit-tested by design)

Run: `npm run dev` (repo root), sign in as a host with an organisation, then:
1. `/dashboard/properties/new` → create "Pine Cabin" → lands on its Photos tab.
2. Upload three images; the first shows "Cover". Click "Later" on photo 1; order changes. Drag photo 3 onto photo 1 (desktop); order changes. "Make cover" on another; only it says Cover. Delete one.
3. Knowledge base tab → fill wifi, a bad time via devtools isn't possible with `type=time`, so just fill all fields → Save → "Saved.", reload, values still there.
4. Basics tab → Publish → the list page shows "Published" with a "View public page" link (the target 404s until M5 — expected).

Expected: every step behaves as described. Record anything that doesn't and fix it before committing.

- [ ] **Step 7: Commit**

```bash
git add "web/app/dashboard/properties/[id]"
git commit -m "feat: add property photo manager and knowledge base pages"
```

---

## Task 9: Organisation settings page

**Files:**
- Create: `web/app/dashboard/settings/layout.tsx`
- Create: `web/app/dashboard/settings/page.tsx`
- Create: `web/app/dashboard/settings/organization-form.tsx`
- Create: `web/app/dashboard/settings/actions.ts`

**Interfaces:**
- Consumes: `updateOrganizationSettings`, `OrganizationSettings` (Task 6); `dashboardContext`, `FormState` (Task 7).

- [ ] **Step 1: Settings layout** — create `web/app/dashboard/settings/layout.tsx`:

```tsx
const SETTINGS_LINKS = [
  { href: "/dashboard/settings", label: "Organisation" },
  { href: "/dashboard/settings/account", label: "Account" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-8">
      {/* On mobile the tab bar has no Properties tab; "More" lands here. */}
      <a
        href="/dashboard/properties"
        className="flex min-h-11 items-center justify-between rounded-card border border-hairline px-4 text-sm md:hidden"
      >
        Properties
        <span aria-hidden className="rtl:-scale-x-100">→</span>
      </a>
      <nav className="flex gap-2 border-b border-hairline">
        {SETTINGS_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="flex min-h-11 items-center px-3 text-sm text-ink hover:bg-surface-muted">
            {link.label}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Action** — create `web/app/dashboard/settings/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { dashboardContext } from "../_lib/context";
import { updateOrganizationSettings } from "@/lib/organizations/settings";
import type { FormState } from "../properties/actions";

export async function updateOrganizationSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, organization } = await dashboardContext();
  const { error } = await updateOrganizationSettings(supabase, {
    organizationId: organization.id,
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    headline: String(formData.get("headline") ?? "").trim(),
  });
  if (error) return { error, success: false };
  revalidatePath("/dashboard", "layout");
  return { error: null, success: true };
}
```

- [ ] **Step 3: Form** — create `web/app/dashboard/settings/organization-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/input";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { updateOrganizationSettingsAction } from "./actions";

export function OrganizationForm({ organization }: { organization: OrganizationSettings }) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettingsAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input name="name" required maxLength={80} defaultValue={organization.name} className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Public slug
        <input name="slug" required minLength={3} maxLength={40} defaultValue={organization.slug} className={INPUT_CLASSES} />
        <span className="text-xs text-muted">
          Your catalogue lives at /s/{organization.slug}. Changing this breaks links you have already shared.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Catalogue headline
        <input
          name="headline"
          maxLength={120}
          defaultValue={organization.headline}
          placeholder="Four cabins above the Attabad lake"
          className={INPUT_CLASSES}
        />
      </label>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Page** — create `web/app/dashboard/settings/page.tsx`:

```tsx
import { dashboardContext } from "../_lib/context";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const { organization } = await dashboardContext();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium tracking-tight">Organisation</h1>
      <OrganizationForm organization={organization} />
    </div>
  );
}
```

`settings/account/page.tsx` already renders its own `<h1>`; it now sits under this layout's sub-nav, which is intended.

- [ ] **Step 5: Type-check, lint, test, walk**

Run: `cd web && npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean, all PASS.

By hand: `/dashboard/settings` → change name and headline → "Saved."; try slug `dashboard` → "reserved" error; try another host's slug → "taken"; reload → saved values persist. On a narrow window, the tab bar's "More" lands here and "Properties" is reachable.

- [ ] **Step 6: Commit**

```bash
git add web/app/dashboard/settings
git commit -m "feat: add organisation settings page"
```

---

## Task 10: Milestone exit — survives-logout test, CI, audit, hosted deploy

**Files:**
- Create: `web/lib/properties/survives-logout.test.ts`
- Modify: `.github/workflows/ci.yml`
- Regenerate: `docs/TRACKER.md`

- [ ] **Step 1: Write the M4 "done when" test** — create `web/lib/properties/survives-logout.test.ts`:

```ts
// @vitest-environment node
import { test, expect } from "vitest";
import { createProperty } from "./basics";
import { getKnowledgeBase, updateKnowledgeBase } from "./knowledge-base";
import { PHOTO_BUCKET, listPropertyPhotos, uploadPropertyPhoto } from "./photos";
import { createTestHostWithOrg, signedInClient, supabaseAdmin } from "../../tests/helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

// @req PROP-05
// @req PROP-09
test("a property with photos and a filled knowledge base survives a logout", async () => {
  const host = await createTestHostWithOrg();
  let propertyId: string | undefined;
  try {
    ({ propertyId } = await createProperty(host.supabase, {
      organizationId: host.organizationId,
      basics: { name: "Lake Hut", property_type: "cabin", address: "Attabad", base_rate_cents: 800_000, max_guests: 3 },
    }));
    for (let i = 0; i < 2; i++) {
      await uploadPropertyPhoto(host.supabase, { propertyId: propertyId!, file: new Blob([PNG], { type: "image/png" }) });
    }
    const kb = { wifi_password: "lake-4821", check_in_time: "14:00", directions: "Boat from the jetty." };
    await updateKnowledgeBase(host.supabase, propertyId!, kb);

    await host.supabase.auth.signOut();
    const fresh = await signedInClient(host);

    expect(await listPropertyPhotos(fresh, propertyId!)).toHaveLength(2);
    expect(await getKnowledgeBase(fresh, propertyId!)).toEqual(kb);
  } finally {
    if (propertyId) {
      const admin = supabaseAdmin();
      const { data } = await admin.storage.from(PHOTO_BUCKET).list(propertyId);
      if (data?.length) await admin.storage.from(PHOTO_BUCKET).remove(data.map((o) => `${propertyId}/${o.name}`));
    }
    await host.cleanup();
  }
});
```

Run: `cd web && npx vitest run lib/properties/survives-logout.test.ts`
Expected: PASS (all behaviour exists already; this is the milestone's acceptance check).

- [ ] **Step 2: Point CI at M4** — in `.github/workflows/ci.yml` change `run: npm run audit -- --milestone M3` to `run: npm run audit -- --milestone M4`.

- [ ] **Step 3: Full verification** (repo root; stack running)

Run: `npm run lint && npm test && npm run audit -- --milestone M4 && npm run build`
Expected: lint clean; every root and web test PASS; audit reports M4 15/15 with no failures and rewrites `docs/TRACKER.md`; build succeeds. Paste the audit summary into the commit body or the PR.

- [ ] **Step 4: Commit**

```bash
git add web/lib/properties/survives-logout.test.ts .github/workflows/ci.yml docs/TRACKER.md
git commit -m "feat: add M4 exit test, point CI audit at M4"
```

- [ ] **Step 5: Finish the branch** — use superpowers:finishing-a-development-branch (merge to `main` locally, re-run `npm test` on the merged result).

- [ ] **Step 6: Ship to the hosted environment** (see `docs/deployment.md`)

```bash
npx supabase db push                     # applies 20260924010000 to project vhzplaphuaydfwtvryla
git push origin main                     # standing instruction: push on milestone completion
vercel --prod                            # if the git push did not trigger a production build
```

Then verify live (replace `$ANON` with the hosted anon key):

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://direct-booking-platform-eta.vercel.app/login          # 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://direct-booking-platform-eta.vercel.app/dashboard/properties   # 307 → /login
curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "https://vhzplaphuaydfwtvryla.supabase.co/rest/v1/properties?select=knowledge_base"                   # 42501 permission denied
curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "https://vhzplaphuaydfwtvryla.supabase.co/rest/v1/properties?select=id,slug"                          # [] (no error)
```

Expected: exactly the results in the comments.

---

## Milestone exit audit

- [ ] Full suite green, output pasted (Task 10 Step 3).
- [ ] Demo path walked by hand: sign in → create property → upload, reorder, set cover, delete photos → fill knowledge base → publish → log out → log in → everything still there (Tasks 8–9 walks + the survives-logout test).
- [ ] `docs/TRACKER.md` shows M4 at 15/15.
- [ ] No `TODO` or stub in M4 code: `git grep -n "TODO\|FIXME" -- web/lib/properties web/app/dashboard supabase/migrations/20260924010000_m4_properties_photos_storage.sql` returns nothing.
- [ ] Hosted DB migrated and live checks pass (Task 10 Step 6).

**Carried forward, not in M4 scope:** M3 follow-ups (b) `'paid'` bookings missing from today's arrivals and (c) UTC vs Pakistan "today" still stand for M9/M10. M5 must add an anon read path for published properties' photos (a server-side image route per spec §9 `/api/images/[...]`; the bucket stays private) and a `property_photos` anon policy scoped to published properties.
