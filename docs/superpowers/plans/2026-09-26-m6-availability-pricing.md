# M6 Availability and Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host can block and unblock dates per property, see every property on one calendar, set seasonal rates, a minimum stay and an advance percentage. A guest on the public property page sees live availability and gets the correct price for the dates they pick. Done when: block a week as host, and an incognito public page shows those dates gone.

**Architecture:** Dates are **nights**. A block or seasonal rule covers `[start_date, end_date)`, with `end_date` exclusive (the checkout morning), matching the existing `availability_blocks` exclusion constraint. Hosts enter an inclusive "first night / last night" range, and the app stores `last night + 1`. One pure, fully tested function (`quoteStay`) computes prices and minimum-stay validity from base rate, seasonal rules and blocks. The host pages, the public page and M10's server-computed booking price all use it. The database is the authority on overlap (exclusion constraints, CAL-10). Anon can read only the *dates* of published properties' blocks and their seasonal rates, never the block reason. Logic lives in `web/lib/availability/**` as plain functions taking a Supabase client, tested against the real local stack. Pages are thin.

**Tech Stack:** Next.js 16.3.5 App Router, React 19.2.8 (`useActionState`, one small client component for the public date picker), `@supabase/supabase-js` 2.117.0, Postgres (btree_gist exclusion constraints), Vitest 5 + Testing Library, `node --test` + `pg`. No new dependencies.

## Global Constraints

Every task implicitly includes these. They carry over from M5, plus M6 specifics.

- **Dates are nights, `[start, end)`.** `end_date` is exclusive everywhere in the DB and in `web/lib/availability/**`. Only form inputs and on-screen labels use inclusive "last night". Convert once, in the parse function. Dates are ISO `YYYY-MM-DD` strings; never `Date` objects in stored data. Date arithmetic uses UTC midnight (`Date.parse(d + "T00:00:00Z")`) so DST and timezones never shift a day.
- **"Today" is Pakistan time.** Use `localToday()` from `web/lib/dashboard/analytics.ts` (Asia/Karachi). Nights before today are unavailable to guests.
- **The database decides overlap (CAL-10).** Blocks already have an exclusion constraint; seasonal rules get one in Task 1. The app maps Postgres `23P01` to a readable message. It never pre-checks overlap as the source of truth.
- **Anon never reads** `availability_blocks.reason` or `id`, a draft property's blocks or rules, `properties.advance_percent`, or anything from M5's forbidden list (address, knowledge_base, ai_settings, owner_id, payment_instructions, policies, account_status). Anon grants are column-level, and anon reads always list columns (no `select *`).
- **Every change a guest could see revalidates the public pages:** call `revalidatePublicPages(organization.slug)` from `web/lib/public/revalidate.ts` in the Server Action, with the slug from `dashboardContext()`.
- **All layout uses CSS logical properties** (the auditor fails CI otherwise). **Match the current visual design:**
  - Dashboard pages use the existing primitives `PageHeader`, `Sheet`, `SheetHeader`, `Field`, `INPUT_CLASSES`, `Notice`, `Button`/`buttonClasses`, `Stamp` and `SubNav`, and the tokens in `web/app/globals.css`, with the same spacing as the existing property pages.
  - Public-page styles go in `web/app/s/[org]/public.css`, mobile-first with `min-width` queries only.
  - Never hardcode a new colour. Use `var(--accent)`, `var(--accent-soft)`, `var(--hairline)`, `var(--surface-muted)`, `var(--muted)`, `var(--ink)`, `var(--destructive)` and `var(--lime)`.
- **44px minimum touch targets** on every interactive element, including calendar day cells.
- **Read functions never turn a database error into "not found".** Only a missing row or `22P02` gives `null`/`[]`.
- **Every new SQL function** gets `revoke execute … from public, anon`, plus explicit grants (no `security definer`).
- **Money is integer paisa** (`*_cents`), shown with `formatRupees()`.
- **`// @req <ID>` above every test that proves a requirement.**
- **Test files under `web/lib/**` start with `// @vitest-environment node`** (tests/helpers.ts breaks under jsdom). Component tests use the default jsdom.
- **Tests clean up.** Deleting a test user cascades rows, not storage objects (M6 adds no storage).
- **Internal links use `next/link` `<Link>`** (the ESLint rule flags `<a href="/...">`).
- **Machine constraints:** low memory. Use `npx vitest run --maxWorkers=1 --testTimeout=120000 <paths>`. If Docker kills the local stack, restart it with `npx supabase start`. Touch only `*_airbnb_like_system` containers. Never `supabase db push` during tasks. Apply migrations locally with `npx supabase db reset`.
- **Before any push:** `npm run lint`, `npm test` (web vitest + `npm run test:scripts`), `npm run audit -- --milestone M6`, `git diff --exit-code docs/TRACKER.md`, `npm run build`, then the CI token grep.
- **Commit after every task**, with the message ending `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never stage an unrelated `docs/TRACKER.md` change, except in Task 7.

---

## File Structure

```
supabase/migrations/
└─ 20260926030000_m6_availability_pricing.sql    NEW — min stay, advance %, rule constraints, anon reads
tests/db/
└─ m6-availability-pricing.test.mjs              NEW
web/lib/availability/
├─ dates.ts            NEW — pure night/date helpers
├─ dates.test.ts       NEW
├─ quote.ts            NEW — quoteStay, nightStatus (pure)
├─ quote.test.ts       NEW — CAL-09, min stay
├─ blocks.ts           NEW — list/create/delete blocks (+ parse)
├─ blocks.test.ts      NEW — CAL-01, 02, 10
├─ pricing.ts          NEW — settings + seasonal rules CRUD (+ parse)
├─ pricing.test.ts     NEW — CAL-04, 05, 06, 10
├─ calendar.ts         NEW — all-properties calendar rows
└─ calendar.test.ts    NEW — CAL-03
web/lib/public/
├─ catalogue.ts        MODIFY — getPublicAvailability
└─ catalogue.test.ts   MODIFY — CAL-07, 08
web/components/calendar/
├─ month-grid.tsx      NEW — presentational month grid (host + public)
└─ month-grid.test.tsx NEW
web/app/dashboard/
├─ dashboard-nav.tsx                             MODIFY — enable Calendar (sidebar + mobile)
├─ layout.test.tsx                               MODIFY
├─ calendar/page.tsx, calendar/timeline.tsx      NEW — CAL-03
├─ calendar/timeline.test.tsx                    NEW
└─ properties/[id]/
   ├─ layout.tsx                                 MODIFY — Calendar + Pricing tabs
   ├─ calendar/page.tsx, block-form.tsx, block-list.tsx          NEW
   ├─ pricing/page.tsx, settings-form.tsx, rules-section.tsx     NEW
   └─ ../actions.ts (properties/actions.ts)      MODIFY — block/rule/settings actions
web/app/s/[org]/[property]/
├─ page.tsx                     MODIFY — load availability
├─ property-view.tsx            MODIFY — Availability section
├─ stay-picker.tsx              NEW — client: pick dates, live quote
└─ stay-picker.test.tsx         NEW — CAL-07, 08, 09
web/app/s/[org]/public.css      MODIFY
.github/workflows/ci.yml        MODIFY — --milestone M6
```

---

### Task 1: Migration — stay settings, rule constraints, anon availability reads

**Files:** Create `supabase/migrations/20260926030000_m6_availability_pricing.sql`, `tests/db/m6-availability-pricing.test.mjs`

**Interfaces:**
- Produces:
  - `properties.minimum_stay integer not null default 1` (1–60); anon can read it.
  - `properties.advance_percent integer not null default 30` (0–100); anon can NOT read it.
  - `seasonal_pricing_rules`: `rate_cents > 0`, `minimum_stay` 1–60, and no overlapping rules per property (`23P01`).
  - Anon SELECT on `availability_blocks(property_id, start_date, end_date)` and on `seasonal_pricing_rules(property_id, start_date, end_date, rate_cents, minimum_stay)`, both for published properties only.

- [ ] **Step 1: Write the failing tests** — `tests/db/m6-availability-pricing.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, actAsAnon, actAsAuthenticated, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

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

test("properties carry a minimum stay (1-60) and an advance percentage (0-100)", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query("select minimum_stay, advance_percent from public.properties where id = $1", [id]);
      assert.deepEqual(rows[0], { minimum_stay: 1, advance_percent: 30 });
      await expectPgError(db, "23514", () => db.query("update public.properties set minimum_stay = 0 where id = $1", [id]));
      await expectPgError(db, "23514", () => db.query("update public.properties set minimum_stay = 61 where id = $1", [id]));
      await expectPgError(db, "23514", () => db.query("update public.properties set advance_percent = 101 where id = $1", [id]));
    });
  } finally {
    await host.cleanup();
  }
});

test("seasonal rules reject overlaps, non-positive rates and bad minimum stays", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const insert = (start, end, rate = 2000000, min = 1) =>
        db.query(
          "insert into public.seasonal_pricing_rules (property_id, start_date, end_date, rate_cents, minimum_stay) values ($1, $2, $3, $4, $5)",
          [id, start, end, rate, min],
        );
      await insert("2026-12-20", "2027-01-03");
      // Touching ranges are fine: end is exclusive.
      await insert("2027-01-03", "2027-01-10");
      await expectPgError(db, "23P01", () => insert("2026-12-31", "2027-01-02"));
      await expectPgError(db, "23514", () => insert("2027-02-01", "2027-02-05", 0));
      await expectPgError(db, "23514", () => insert("2027-02-01", "2027-02-05", 100, 0));
    });
  } finally {
    await host.cleanup();
  }
});

test("anon reads block dates and seasonal rates of published properties only, never the block reason", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const published = await insertProperty(db, orgId, { published: true });
      const draft = await insertProperty(db, orgId, { published: false });
      for (const p of [published, draft]) {
        await db.query("insert into public.availability_blocks (property_id, start_date, end_date) values ($1, '2027-03-01', '2027-03-05')", [p]);
        await db.query(
          "insert into public.seasonal_pricing_rules (property_id, start_date, end_date, rate_cents, minimum_stay) values ($1, '2027-03-10', '2027-03-20', 2500000, 2)",
          [p],
        );
      }
      await actAsAnon(db);
      const blocks = await db.query("select property_id, start_date, end_date from public.availability_blocks where property_id = any($1)", [[published, draft]]);
      assert.deepEqual(blocks.rows.map((r) => r.property_id), [published]);
      const rules = await db.query(
        "select property_id, start_date, end_date, rate_cents, minimum_stay from public.seasonal_pricing_rules where property_id = any($1)",
        [[published, draft]],
      );
      assert.deepEqual(rules.rows.map((r) => r.property_id), [published]);
      const min = await db.query("select minimum_stay from public.properties where id = $1", [published]);
      assert.equal(min.rows[0].minimum_stay, 1);
      for (const sql of [
        "select reason from public.availability_blocks",
        "select id from public.availability_blocks",
        "select advance_percent from public.properties",
      ]) {
        await expectPgError(db, "42501", () => db.query(sql));
      }
      await expectPgError(db, "42501", () =>
        db.query("insert into public.availability_blocks (property_id, start_date, end_date) values ($1, '2027-04-01', '2027-04-02')", [published]),
      );
    });
  } finally {
    await host.cleanup();
  }
});
```

- [ ] **Step 2: Run to verify it fails.** Run `node --test tests/db/m6-availability-pricing.test.mjs`. Expected FAIL: `column "minimum_stay" does not exist`.

- [ ] **Step 3: Write the migration** — `supabase/migrations/20260926030000_m6_availability_pricing.sql`:

```sql
-- ---------------------------------------------------------------------------
-- M6 availability and pricing. Dates are nights: [start_date, end_date).
-- ---------------------------------------------------------------------------

-- Property-level stay settings (CAL-05, CAL-06).
alter table public.properties
  add column minimum_stay integer not null default 1,
  add column advance_percent integer not null default 30;

alter table public.properties
  add constraint properties_minimum_stay_range check (minimum_stay between 1 and 60),
  add constraint properties_advance_percent_range check (advance_percent between 0 and 100);

-- Guests need the minimum stay to pick valid dates. advance_percent is shown
-- at booking time (M10) and stays private until then.
grant select (minimum_stay) on public.properties to anon;

-- Seasonal rules (CAL-04): positive rate, sane minimum stay, and no two rules
-- for one property may cover the same night, so the price for a night is
-- never ambiguous (CAL-09, CAL-10). btree_gist exists since 20260922040000.
alter table public.seasonal_pricing_rules
  add constraint seasonal_pricing_rules_rate_positive check (rate_cents > 0),
  add constraint seasonal_pricing_rules_minimum_stay_range check (minimum_stay between 1 and 60),
  add constraint seasonal_pricing_rules_no_overlap exclude using gist (
    property_id with =,
    daterange(start_date, end_date, '[)') with &&
  );

-- ---------------------------------------------------------------------------
-- Anon reads for the public availability calendar (CAL-07, CAL-08, CAL-09).
-- Table-level revoke first: this stack grants anon a blanket table ACL that a
-- column grant alone cannot narrow (see 20260922090000).
-- ---------------------------------------------------------------------------
revoke select on public.availability_blocks from anon;
grant select (property_id, start_date, end_date) on public.availability_blocks to anon;

create policy "availability_blocks_select_published_anon" on public.availability_blocks
  for select
  to anon
  using (exists (select 1 from public.properties p where p.id = property_id and p.published));

revoke select on public.seasonal_pricing_rules from anon;
grant select (property_id, start_date, end_date, rate_cents, minimum_stay) on public.seasonal_pricing_rules to anon;

create policy "seasonal_pricing_rules_select_published_anon" on public.seasonal_pricing_rules
  for select
  to anon
  using (exists (select 1 from public.properties p where p.id = property_id and p.published));
```

- [ ] **Step 4: Apply and run.** Run `npx supabase db reset`, then `node --test tests/db/m6-availability-pricing.test.mjs` (expect 3/3 PASS), then `npm run test:scripts` (expect all PASS).

- [ ] **Step 5: Commit.** Message: `feat: stay settings, non-overlapping seasonal rules and public availability reads`

---

### Task 2: Pure date and quote logic

**Files:** Create `web/lib/availability/dates.ts`, `dates.test.ts`, `quote.ts`, `quote.test.ts`

**Interfaces — Produces:**

```ts
// dates.ts
export type DateRange = { start: string; end: string }; // [start, end), ISO dates
export function addDays(date: string, days: number): string
export function nightsBetween(start: string, end: string): number
export function eachNight(range: DateRange): string[]            // start … end-1
export function covers(range: DateRange, night: string): boolean // start <= night < end
export function overlaps(a: DateRange, b: DateRange): boolean
export function isIsoDate(value: string): boolean                // strict YYYY-MM-DD, real calendar date
export function monthStart(date: string): string                 // YYYY-MM-01
export function daysInMonth(month: string): number

// quote.ts
export type RateRule = DateRange & { rateCents: number; minimumStay: number };
export type QuoteInput = { baseRateCents: number; minimumStay: number; rules: RateRule[]; blocks: DateRange[]; today: string };
export type Quote =
  | { ok: true; nights: number; totalCents: number; breakdown: { night: string; rateCents: number }[]; minimumStay: number }
  | { ok: false; reason: "invalid" | "past" | "unavailable" | "minimum_stay"; minimumStay: number };
export function nightStatus(night: string, input: Pick<QuoteInput, "blocks" | "today">): "available" | "blocked" | "past"
export function requiredMinimumStay(checkIn: string, input: Pick<QuoteInput, "minimumStay" | "rules">): number
export function quoteStay(checkIn: string, checkOut: string, input: QuoteInput): Quote
```

Rules:
- A night's rate is the rate of the rule covering it, otherwise the base rate.
- The required minimum stay is the max of the property minimum and the `minimumStay` of the rule covering the check-in night.
- `invalid` means a non-ISO date or checkOut ≤ checkIn.
- `past` means checkIn < today.
- `unavailable` means any night in the range is blocked.
- `minimum_stay` means nights < required.

- [ ] **Step 1: Write the failing tests.** `web/lib/availability/dates.test.ts` (node env):

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, covers, daysInMonth, eachNight, isIsoDate, monthStart, nightsBetween, overlaps } from "./dates";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
  it("counts and lists nights with an exclusive end", () => {
    expect(nightsBetween("2026-10-12", "2026-10-15")).toBe(3);
    expect(eachNight({ start: "2026-10-12", end: "2026-10-15" })).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });
  it("covers and overlaps treat the end as the checkout morning", () => {
    const r = { start: "2026-10-12", end: "2026-10-15" };
    expect(covers(r, "2026-10-14")).toBe(true);
    expect(covers(r, "2026-10-15")).toBe(false);
    expect(overlaps(r, { start: "2026-10-15", end: "2026-10-16" })).toBe(false);
    expect(overlaps(r, { start: "2026-10-14", end: "2026-10-16" })).toBe(true);
  });
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-2-3")).toBe(false);
  });
  it("finds month boundaries", () => {
    expect(monthStart("2026-10-17")).toBe("2026-10-01");
    expect(daysInMonth("2028-02-01")).toBe(29);
  });
});
```

`web/lib/availability/quote.test.ts` (node env):

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { nightStatus, quoteStay, requiredMinimumStay, type QuoteInput } from "./quote";

const input: QuoteInput = {
  baseRateCents: 1_000_000,
  minimumStay: 2,
  today: "2026-10-01",
  rules: [{ start: "2026-12-20", end: "2027-01-03", rateCents: 2_000_000, minimumStay: 3 }],
  blocks: [{ start: "2026-10-10", end: "2026-10-12" }],
};

describe("quoteStay", () => {
  // @req CAL-09
  it("prices each night at the seasonal rate when a rule covers it, otherwise the base rate", () => {
    const q = quoteStay("2026-12-18", "2026-12-22", input);
    expect(q).toMatchObject({ ok: true, nights: 4, totalCents: 1_000_000 * 2 + 2_000_000 * 2 });
    if (q.ok) expect(q.breakdown.map((n) => n.rateCents)).toEqual([1_000_000, 1_000_000, 2_000_000, 2_000_000]);
  });

  // @req CAL-05
  it("enforces the larger of the property and seasonal minimum stay for the check-in night", () => {
    expect(requiredMinimumStay("2026-11-01", input)).toBe(2);
    expect(requiredMinimumStay("2026-12-24", input)).toBe(3);
    expect(quoteStay("2026-11-01", "2026-11-02", input)).toEqual({ ok: false, reason: "minimum_stay", minimumStay: 2 });
    expect(quoteStay("2026-12-24", "2026-12-26", input)).toEqual({ ok: false, reason: "minimum_stay", minimumStay: 3 });
  });

  // @req CAL-08
  it("refuses a stay that includes a blocked night, but allows checking out on one", () => {
    expect(quoteStay("2026-10-09", "2026-10-11", input)).toMatchObject({ ok: false, reason: "unavailable" });
    expect(quoteStay("2026-10-08", "2026-10-10", input)).toMatchObject({ ok: true, nights: 2 });
    expect(nightStatus("2026-10-11", input)).toBe("blocked");
    expect(nightStatus("2026-10-12", input)).toBe("available");
    expect(nightStatus("2026-09-30", input)).toBe("past");
  });

  it("rejects invalid and past ranges", () => {
    expect(quoteStay("2026-10-20", "2026-10-20", input)).toMatchObject({ ok: false, reason: "invalid" });
    expect(quoteStay("nope", "2026-10-20", input)).toMatchObject({ ok: false, reason: "invalid" });
    expect(quoteStay("2026-09-20", "2026-09-25", input)).toMatchObject({ ok: false, reason: "past" });
  });
});
```

- [ ] **Step 2: Run to verify it fails.** Run `cd web && npx vitest run --maxWorkers=1 lib/availability`. Expected FAIL: the modules don't exist.

- [ ] **Step 3: Implement** `web/lib/availability/dates.ts`:

```ts
// Dates are ISO YYYY-MM-DD strings and ranges are nights: [start, end), with end
// the checkout morning. All arithmetic is at UTC midnight, so a timezone or DST
// shift can never move a date.
export type DateRange = { start: string; end: string };

const DAY = 86_400_000;
const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return fromMs(toMs(date) + days * DAY);
}

export function nightsBetween(start: string, end: string): number {
  return Math.round((toMs(end) - toMs(start)) / DAY);
}

export function eachNight(range: DateRange): string[] {
  const nights: string[] = [];
  for (let d = range.start; d < range.end; d = addDays(d, 1)) nights.push(d);
  return nights;
}

export function covers(range: DateRange, night: string): boolean {
  return range.start <= night && night < range.end;
}

export function overlaps(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = toMs(value);
  return !Number.isNaN(ms) && fromMs(ms) === value;
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function daysInMonth(month: string): number {
  const start = monthStart(month);
  const [y, m] = start.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return nightsBetween(start, next);
}
```

`web/lib/availability/quote.ts`:

```ts
import { covers, eachNight, isIsoDate, type DateRange } from "./dates";

export type RateRule = DateRange & { rateCents: number; minimumStay: number };
export type QuoteInput = { baseRateCents: number; minimumStay: number; rules: RateRule[]; blocks: DateRange[]; today: string };
export type Quote =
  | { ok: true; nights: number; totalCents: number; breakdown: { night: string; rateCents: number }[]; minimumStay: number }
  | { ok: false; reason: "invalid" | "past" | "unavailable" | "minimum_stay"; minimumStay: number };

export function nightStatus(night: string, input: Pick<QuoteInput, "blocks" | "today">): "available" | "blocked" | "past" {
  if (night < input.today) return "past";
  return input.blocks.some((b) => covers(b, night)) ? "blocked" : "available";
}

export function requiredMinimumStay(checkIn: string, input: Pick<QuoteInput, "minimumStay" | "rules">): number {
  const rule = input.rules.find((r) => covers(r, checkIn));
  return Math.max(input.minimumStay, rule?.minimumStay ?? 1);
}

// The one price calculation. Host pages, the public page and M10's
// server-computed booking price all call this.
export function quoteStay(checkIn: string, checkOut: string, input: QuoteInput): Quote {
  const valid = isIsoDate(checkIn) && isIsoDate(checkOut) && checkOut > checkIn;
  const minimumStay = valid ? requiredMinimumStay(checkIn, input) : input.minimumStay;
  if (!valid) return { ok: false, reason: "invalid", minimumStay };
  if (checkIn < input.today) return { ok: false, reason: "past", minimumStay };
  const nights = eachNight({ start: checkIn, end: checkOut });
  if (nights.some((n) => nightStatus(n, input) !== "available")) return { ok: false, reason: "unavailable", minimumStay };
  if (nights.length < minimumStay) return { ok: false, reason: "minimum_stay", minimumStay };
  const breakdown = nights.map((night) => ({
    night,
    rateCents: input.rules.find((r) => covers(r, night))?.rateCents ?? input.baseRateCents,
  }));
  return { ok: true, nights: nights.length, totalCents: breakdown.reduce((s, n) => s + n.rateCents, 0), breakdown, minimumStay };
}
```

- [ ] **Step 4: Run to verify it passes.** Same command. Expect all PASS.
- [ ] **Step 5: Commit.** Message: `feat: pure night arithmetic and stay pricing`

---

### Task 3: Blocks — library and the property calendar page

**Files:**
- Create `web/lib/availability/blocks.ts`, `blocks.test.ts`, `web/components/calendar/month-grid.tsx`, `month-grid.test.tsx`, `web/app/dashboard/properties/[id]/calendar/page.tsx`, `block-form.tsx`, `block-list.tsx`
- Modify `web/app/dashboard/properties/actions.ts`, `web/app/dashboard/properties/[id]/layout.tsx`

**Interfaces:**
- Consumes: Task 2 `DateRange`, `addDays`, `isIsoDate`, `nightStatus`; `createTestHostWithOrg`, `createProperty(supabase, { organizationId, basics })`; `revalidatePublicPages`; `dashboardContext`.
- Produces:

```ts
// blocks.ts
export type Block = DateRange & { id: string; reason: "manual_block" | "booking" };
export function parseBlockInput(input: { firstNight: string; lastNight: string; today: string }): { range: DateRange } | { error: string }
export async function listBlocks(supabase, propertyId: string): Promise<Block[]>              // ordered by start
export async function createBlock(supabase, propertyId: string, range: DateRange): Promise<{ error: string | null }>
export async function deleteBlock(supabase, blockId: string): Promise<{ error: string | null }> // manual blocks only

// month-grid.tsx (presentational, no hooks)
export type DayState = "available" | "blocked" | "past" | "selected" | "in-range" | "booked";
export function MonthGrid(props: {
  month: string;                              // any date in the month
  stateFor: (date: string) => DayState;
  renderDay?: (date: string, state: DayState) => React.ReactNode; // default: the day number
  onSelect?: (date: string) => void;          // when given, available/selected/in-range cells are buttons
  labelFor?: (date: string, state: DayState) => string; // aria-label
}): JSX.Element
```

- **`parseBlockInput`:** takes inclusive first and last nights and returns `{ start: firstNight, end: addDays(lastNight, 1) }`.
  - Error "Enter both dates." when either is missing.
  - Error "The last night can't be before the first." when last < first.
  - Error "You can't block dates in the past." when firstNight < today.
  - Error "Block at most 366 nights at a time." over 366 nights.
- **`createBlock`:** maps `23P01` to "Those dates overlap a block you already have." (CAL-10). It always inserts `reason = 'manual_block'`.
- **`deleteBlock`:** deletes only where `reason = 'manual_block'`; a booking block returns "Bookings can't be removed here." It returns `{ error: "Block not found." }` when nothing matched.

- [ ] **Step 1: Write the failing tests.** `web/lib/availability/blocks.test.ts` (node env; set up hosts and properties exactly as `web/lib/properties/listing.test.ts` does):

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { createProperty } from "@/lib/properties/basics";
import { createBlock, deleteBlock, listBlocks, parseBlockInput } from "./blocks";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { while (cleanups.length) await cleanups.pop()!(); });

async function hostWithProperty() {
  const host = await createTestHostWithOrg();
  cleanups.push(host.cleanup);
  const { propertyId } = await createProperty(host.supabase, {
    organizationId: host.organizationId,
    basics: { name: "River Hut", property_type: "cabin", address: "Karimabad", base_rate_cents: 900_000, max_guests: 2 },
  });
  return { host, propertyId: propertyId! };
}

describe("parseBlockInput", () => {
  it("turns an inclusive first/last night into an exclusive range", () => {
    expect(parseBlockInput({ firstNight: "2027-03-01", lastNight: "2027-03-07", today: "2026-10-01" })).toEqual({ range: { start: "2027-03-01", end: "2027-03-08" } });
  });
  it("rejects missing, reversed, past and over-long ranges", () => {
    expect(parseBlockInput({ firstNight: "", lastNight: "2027-03-07", today: "2026-10-01" })).toEqual({ error: "Enter both dates." });
    expect(parseBlockInput({ firstNight: "2027-03-07", lastNight: "2027-03-01", today: "2026-10-01" })).toEqual({ error: "The last night can't be before the first." });
    expect(parseBlockInput({ firstNight: "2026-09-01", lastNight: "2026-09-03", today: "2026-10-01" })).toEqual({ error: "You can't block dates in the past." });
    expect(parseBlockInput({ firstNight: "2027-01-01", lastNight: "2028-06-01", today: "2026-10-01" })).toEqual({ error: "Block at most 366 nights at a time." });
  });
});

// @req CAL-01
it("a host can block a date range on a property", async () => {
  const { host, propertyId } = await hostWithProperty();
  expect(await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" })).toEqual({ error: null });
  expect(await listBlocks(host.supabase, propertyId)).toMatchObject([{ start: "2027-03-01", end: "2027-03-08", reason: "manual_block" }]);
});

// @req CAL-10
it("overlapping blocks are rejected with a readable message", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" });
  expect(await createBlock(host.supabase, propertyId, { start: "2027-03-07", end: "2027-03-10" })).toEqual({ error: "Those dates overlap a block you already have." });
  expect(await createBlock(host.supabase, propertyId, { start: "2027-03-08", end: "2027-03-10" })).toEqual({ error: null });
});

// @req CAL-02
it("a host can remove a block", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" });
  const [block] = await listBlocks(host.supabase, propertyId);
  expect(await deleteBlock(host.supabase, block.id)).toEqual({ error: null });
  expect(await listBlocks(host.supabase, propertyId)).toEqual([]);
});

// @req PROP-14
it("another host cannot block, list or remove this property's dates", async () => {
  const { host, propertyId } = await hostWithProperty();
  await createBlock(host.supabase, propertyId, { start: "2027-03-01", end: "2027-03-08" });
  const other = await createTestHostWithOrg();
  cleanups.push(other.cleanup);
  expect((await createBlock(other.supabase, propertyId, { start: "2027-05-01", end: "2027-05-02" })).error).not.toBeNull();
  expect(await listBlocks(other.supabase, propertyId)).toEqual([]);
  const [block] = await listBlocks(host.supabase, propertyId);
  expect(await deleteBlock(other.supabase, block.id)).toEqual({ error: "Block not found." });
  expect(await listBlocks(host.supabase, propertyId)).toHaveLength(1);
});
```

`web/components/calendar/month-grid.test.tsx` (jsdom):

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MonthGrid } from "./month-grid";

it("lays out a month Monday-first with the right day count and states", () => {
  const onSelect = vi.fn();
  render(
    <MonthGrid
      month="2026-10-15"
      stateFor={(d) => (d === "2026-10-10" ? "blocked" : d < "2026-10-05" ? "past" : "available")}
      onSelect={onSelect}
      labelFor={(d, s) => `${d} ${s}`}
    />,
  );
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  expect(screen.getAllByRole("gridcell")).toHaveLength(31);
  expect(screen.getByRole("button", { name: "2026-10-06 available" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "2026-10-10 blocked" })).toBeNull();
  screen.getByRole("button", { name: "2026-10-06 available" }).click();
  expect(onSelect).toHaveBeenCalledWith("2026-10-06");
});
```

- [ ] **Step 2: Run to verify it fails.** Run `cd web && npx vitest run --maxWorkers=1 lib/availability/blocks.test.ts components/calendar`.

- [ ] **Step 3: Implement `blocks.ts`:**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isIsoDate, nightsBetween, type DateRange } from "./dates";

export type Block = DateRange & { id: string; reason: "manual_block" | "booking" };
const MAX_NIGHTS = 366;

export function parseBlockInput({ firstNight, lastNight, today }: { firstNight: string; lastNight: string; today: string }): { range: DateRange } | { error: string } {
  if (!isIsoDate(firstNight) || !isIsoDate(lastNight)) return { error: "Enter both dates." };
  if (lastNight < firstNight) return { error: "The last night can't be before the first." };
  if (firstNight < today) return { error: "You can't block dates in the past." };
  const range = { start: firstNight, end: addDays(lastNight, 1) };
  if (nightsBetween(range.start, range.end) > MAX_NIGHTS) return { error: "Block at most 366 nights at a time." };
  return { range };
}

export async function listBlocks(supabase: SupabaseClient, propertyId: string): Promise<Block[]> {
  const { data, error } = await supabase
    .from("availability_blocks")
    .select("id, start_date, end_date, reason")
    .eq("property_id", propertyId)
    .order("start_date", { ascending: true });
  if (error) {
    if (error.code === "22P02") return [];
    throw error;
  }
  return (data ?? []).map((b) => ({ id: b.id, start: b.start_date, end: b.end_date, reason: b.reason }));
}

export async function createBlock(supabase: SupabaseClient, propertyId: string, range: DateRange): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("availability_blocks")
    .insert({ property_id: propertyId, start_date: range.start, end_date: range.end, reason: "manual_block" });
  if (!error) return { error: null };
  // CAL-10: the exclusion constraint is the authority on overlap.
  if (error.code === "23P01") return { error: "Those dates overlap a block you already have." };
  return { error: error.message };
}

export async function deleteBlock(supabase: SupabaseClient, blockId: string): Promise<{ error: string | null }> {
  const { data: found, error: readError } = await supabase
    .from("availability_blocks")
    .select("id, reason")
    .eq("id", blockId)
    .maybeSingle();
  if (readError && readError.code !== "22P02") return { error: readError.message };
  if (!found) return { error: "Block not found." };
  if (found.reason !== "manual_block") return { error: "Bookings can't be removed here." };
  const { error } = await supabase.from("availability_blocks").delete().eq("id", blockId).eq("reason", "manual_block");
  return { error: error ? error.message : null };
}
```

- [ ] **Step 4: Implement `web/components/calendar/month-grid.tsx`:**

```tsx
import { daysInMonth, monthStart } from "@/lib/availability/dates";

export type DayState = "available" | "blocked" | "past" | "selected" | "in-range" | "booked";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TITLE = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const SELECTABLE: DayState[] = ["available", "selected", "in-range"];

// Presentational only: the caller decides each day's state. Used by the
// host calendar and the public stay picker, so both look the same.
export function MonthGrid({
  month,
  stateFor,
  renderDay,
  onSelect,
  labelFor,
}: {
  month: string;
  stateFor: (date: string) => DayState;
  renderDay?: (date: string, state: DayState) => React.ReactNode;
  onSelect?: (date: string) => void;
  labelFor?: (date: string, state: DayState) => string;
}) {
  const first = monthStart(month);
  const count = daysInMonth(first);
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday-first
  const dates = Array.from({ length: count }, (_, i) => `${first.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);

  return (
    <div className="month-grid">
      <p className="month-grid-title">{TITLE.format(new Date(`${first}T00:00:00Z`))}</p>
      <div className="month-grid-weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div role="grid" className="month-grid-days">
        {Array.from({ length: lead }, (_, i) => <span key={`pad-${i}`} className="month-grid-pad" aria-hidden="true" />)}
        {dates.map((date) => {
          const state = stateFor(date);
          const content = renderDay ? renderDay(date, state) : Number(date.slice(8));
          const label = labelFor?.(date, state) ?? date;
          return (
            <span key={date} role="gridcell" className="month-grid-cell" data-state={state}>
              {onSelect && SELECTABLE.includes(state) ? (
                <button type="button" className="month-grid-day" aria-label={label} aria-pressed={state === "selected"} onClick={() => onSelect(date)}>
                  {content}
                </button>
              ) : (
                <span className="month-grid-day" aria-label={label}>{content}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

Add its styles to `web/app/globals.css`, in a clearly commented "Month grid (host calendar + public stay picker)" block. They are logical properties only, and every day cell is at least 44px:

```css
/* Month grid (host calendar + public stay picker). */
.month-grid { display: flex; flex-direction: column; gap: 10px; }
.month-grid-title { font-size: 15px; font-weight: 600; color: var(--ink); }
.month-grid-weekdays, .month-grid-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
.month-grid-weekdays span { text-align: center; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.month-grid-cell { display: block; }
.month-grid-day { display: grid; place-items: center; inline-size: 100%; min-block-size: 44px; border-radius: 10px; font-size: 14px; color: var(--ink); background: transparent; border: 1px solid transparent; }
button.month-grid-day { cursor: pointer; transition: background 150ms, border-color 150ms; }
button.month-grid-day:hover { border-color: var(--accent); }
.month-grid-cell[data-state="past"] .month-grid-day { color: color-mix(in srgb, var(--muted) 55%, transparent); }
.month-grid-cell[data-state="blocked"] .month-grid-day,
.month-grid-cell[data-state="booked"] .month-grid-day { color: var(--muted); background: var(--surface-muted); text-decoration: line-through; }
.month-grid-cell[data-state="booked"] .month-grid-day { background: var(--accent-soft); text-decoration: none; color: var(--accent); font-weight: 600; }
.month-grid-cell[data-state="in-range"] .month-grid-day { background: var(--accent-soft); }
.month-grid-cell[data-state="selected"] .month-grid-day { background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
```

- [ ] **Step 5: Server Actions.** Append to `web/app/dashboard/properties/actions.ts`, using the existing imports and patterns (`dashboardContext`, `revalidatePath`, `revalidatePublicPages`, `FormState`). Add `localToday` from `@/lib/dashboard/analytics`, and `parseBlockInput`, `createBlock` and `deleteBlock` from `@/lib/availability/blocks`:

```ts
export async function createBlockAction(propertyId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseBlockInput({
    firstNight: String(formData.get("firstNight") ?? ""),
    lastNight: String(formData.get("lastNight") ?? ""),
    today: localToday(),
  });
  if ("error" in parsed) return { error: parsed.error, success: false };
  const { supabase, organization } = await dashboardContext();
  const { error } = await createBlock(supabase, propertyId, parsed.range);
  if (error) return { error, success: false };
  revalidatePath(`/dashboard/properties/${propertyId}/calendar`);
  revalidatePath("/dashboard/calendar");
  revalidatePublicPages(organization.slug);
  return { error: null, success: true };
}

export async function deleteBlockAction(propertyId: string, blockId: string): Promise<{ error: string | null }> {
  const { supabase, organization } = await dashboardContext();
  const result = await deleteBlock(supabase, blockId);
  if (!result.error) {
    revalidatePath(`/dashboard/properties/${propertyId}/calendar`);
    revalidatePath("/dashboard/calendar");
    revalidatePublicPages(organization.slug);
  }
  return result;
}
```

- [ ] **Step 6: The page and its two components.**

- **`[id]/layout.tsx`:** extend `tabs` to Basics, Photos, **Calendar** (`/calendar`), **Pricing** (`/pricing`), Knowledge base.
- **`calendar/page.tsx`** (server):
  - Load `listBlocks` and `localToday()`.
  - Render a `Sheet` with `SheetHeader` title "Block dates" and description "Blocked nights can't be booked and show as unavailable on your public page." Its body is `<BlockForm action={createBlockAction.bind(null, id)} today={today} />`.
  - Render a second `Sheet`, "Next three months": three `MonthGrid`s in a responsive grid (1 column on mobile, 3 from `lg`). `stateFor` gives `past` before today, `booked` for a booking block, `blocked` for a manual block, otherwise `available`. There is no `onSelect`.
  - Render a third `Sheet`, "Blocked dates": `<BlockList propertyId={id} blocks={blocks.filter(b => b.end > today)} />`.
- **`block-form.tsx`** (client): `useActionState`, with two `Field`s side by side from `sm`, both `<input type="date" min={today}>`: "First night" (`name="firstNight"`) and "Last night" (`name="lastNight"`). Include `Notice` error and success ("Dates blocked."), and a primary `Button` "Block dates" / "Blocking…".
- **`block-list.tsx`** (client):
  - For an empty list, show the written empty state "No blocked dates. Your calendar is open."
  - Otherwise, a divided list. Each row shows `"12 Oct – 14 Oct 2026 · 3 nights"`: format with `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })`, using the inclusive last night (`addDays(end, -1)`) and `nightsBetween`.
  - A booking block shows a `Stamp tone="green"` "Booking" and no remove button.
  - A manual block has a `Button variant="ghost"` "Remove" that calls `deleteBlockAction(propertyId, block.id)` in `useTransition`, shows any returned error with `Notice`, and `router.refresh()`es on success.

- [ ] **Step 7: Verify.** Run `cd web && npx vitest run --maxWorkers=1 lib/availability components/calendar app/dashboard`, `npx tsc --noEmit`, `npx eslint app lib components`, and root `npm run audit`. All green.
- [ ] **Step 8: Commit.** Message: `feat: hosts can block and unblock dates per property`

---

### Task 4: Pricing — minimum stay, advance percentage, seasonal rules

**Files:**
- Create `web/lib/availability/pricing.ts`, `pricing.test.ts`, `web/app/dashboard/properties/[id]/pricing/page.tsx`, `settings-form.tsx`, `rules-section.tsx`
- Modify `web/app/dashboard/properties/actions.ts`

**Interfaces — Produces:**

```ts
export type StaySettings = { minimumStay: number; advancePercent: number };
export type SeasonalRule = { id: string; start: string; end: string; rateCents: number; minimumStay: number };
export function parseStaySettings(input: { minimumStay: string; advancePercent: string }): { settings: StaySettings } | { error: string }
export function parseSeasonalRule(input: { firstNight: string; lastNight: string; rate: string; minimumStay: string; today: string }): { rule: Omit<SeasonalRule, "id"> } | { error: string }
export async function getStaySettings(supabase, propertyId): Promise<StaySettings | null>
export async function updateStaySettings(supabase, propertyId, settings: StaySettings): Promise<{ error: string | null }>
export async function listSeasonalRules(supabase, propertyId): Promise<SeasonalRule[]>          // ordered by start
export async function createSeasonalRule(supabase, propertyId, rule: Omit<SeasonalRule, "id">): Promise<{ error: string | null }>
export async function deleteSeasonalRule(supabase, ruleId): Promise<{ error: string | null }>
```

- **`parseStaySettings`:** minimum stay must be a whole number 1–60, else "Minimum stay must be between 1 and 60 nights." Advance must be a whole number 0–100, else "Advance must be between 0% and 100%."
- **`parseSeasonalRule`:**
  - Dates are inclusive → exclusive end, with the same messages as `parseBlockInput`: "Enter both dates.", "The last night can't be before the first.", and "Seasonal rates can't start in the past."
  - `rate` is whole rupees > 0, else "Enter a nightly rate in rupees." Store as `rateCents = rupees * 100`.
  - `minimumStay` must be 1–60 (blank means 1), else "Minimum stay must be between 1 and 60 nights."
- **`createSeasonalRule`:** maps `23P01` to "That season overlaps another seasonal rate."
- **`deleteSeasonalRule`:** returns "Rate not found." when nothing matched.

- [ ] **Step 1: Write the failing tests.** Write `web/lib/availability/pricing.test.ts` (node env; same host/property setup as Task 3):
  - pure parse tests for each message above;
  - `// @req CAL-04`: create a rule (20 Dec–2 Jan inclusive, Rs 20,000, min 3), then `listSeasonalRules` returns `{ start: "2026-12-20", end: "2027-01-03", rateCents: 2_000_000, minimumStay: 3 }`;
  - `// @req CAL-10`: an overlapping second rule returns the overlap message;
  - `// @req CAL-05` and `// @req CAL-06`: `updateStaySettings(…, { minimumStay: 2, advancePercent: 50 })`, then `getStaySettings` returns it;
  - deleting a rule removes it;
  - `// @req PROP-14`: another host cannot create, list or delete (assert the failure, then re-read as the owner).

  Use real ISO dates in the future relative to `localToday()`, e.g. build them from `new Date().getFullYear() + 1`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement `pricing.ts`.** Follow `blocks.ts`'s structure exactly: explicit column lists (`minimum_stay, advance_percent` / `id, start_date, end_date, rate_cents, minimum_stay`), `22P02` → null/[] on reads, other errors thrown, `23P01` mapped on insert, and delete-then-verify for "not found" (select first, as `deleteBlock` does).
- [ ] **Step 4: Server Actions** in `properties/actions.ts`: `updateStaySettingsAction(propertyId, prev, formData)`, `createSeasonalRuleAction(propertyId, prev, formData)` and `deleteSeasonalRuleAction(propertyId, ruleId)`. They mirror Task 3's actions: parse, `dashboardContext`, lib call, then `revalidatePath` for `/dashboard/properties/${propertyId}/pricing` and `revalidatePublicPages(organization.slug)`.
- [ ] **Step 5: The page.** `pricing/page.tsx` (server) loads the settings and rules, then renders:
  - **"Stay rules" `Sheet`:** `SheetHeader` description "Apply to every booking unless a seasonal rate says otherwise." Its body is `SettingsForm`: two number `Field`s side by side from `sm`, "Minimum stay (nights)" (`name="minimumStay"`, min 1, max 60) and "Advance to confirm (%)" (`name="advancePercent"`, min 0, max 100, hint "Guests pay this share directly to you to confirm. The rest is due on arrival."), plus a `Notice` and a "Save" `Button`.
  - **"Seasonal rates" `Sheet`:** description "Charge a different nightly rate for busy seasons like Eid, summer or New Year." Its body is `RulesSection`:
    - an add form: First night, Last night, Nightly rate (Rs), and Minimum stay with placeholder "1"; laid out 2×2 on `sm`, with a "Add season" `Button`;
    - below it, the list of rules: each row shows the inclusive dates, `formatRupees(rateCents)` "/ night", and "min N nights" when N > 1, with a ghost "Remove" `Button`;
    - an empty state: "No seasonal rates. Every night uses your base rate of {formatRupees(base)}."
  - Pass `baseRateCents` from `getProperty`.
- [ ] **Step 6: Verify.** Run the same commands as Task 3 Step 7, with the `lib/availability` tests included.
- [ ] **Step 7: Commit.** Message: `feat: minimum stay, advance percentage and seasonal rates`

---

### Task 5: All-properties calendar (CAL-03)

**Files:**
- Create `web/lib/availability/calendar.ts`, `calendar.test.ts`, `web/app/dashboard/calendar/page.tsx`, `timeline.tsx`, `timeline.test.tsx`
- Modify `web/app/dashboard/dashboard-nav.tsx`, `web/app/dashboard/layout.test.tsx`

**Interfaces — Produces:**

```ts
export type CalendarEntry = DateRange & { kind: "blocked" | "booking"; label: string };
export type CalendarRow = { propertyId: string; propertyName: string; entries: CalendarEntry[] };
export async function listCalendar(supabase, organizationId: string, from: string, nights: number): Promise<CalendarRow[]>
export function Timeline(props: { from: string; nights: number; rows: CalendarRow[] }): JSX.Element
```

- **`listCalendar`:** returns every property of the org, including drafts, ordered by name. Its entries are:
  - manual blocks that overlap `[from, from+nights)`, as `kind: "blocked"`, label "Blocked";
  - bookings with status in `approved | paid | staying` that overlap, as `kind: "booking"`, label "Booked".

  Booking-reason rows in `availability_blocks` are skipped, because the `bookings` row already represents them. Read with explicit columns, and throw on error.
- **`Timeline`:** a horizontally scrollable grid.
  - A sticky first column holds the property names, with a `min-inline-size` of 160px.
  - One column per night, 44px wide, with a header showing weekday initial and day number. Today's column is highlighted with `var(--accent-soft)`.
  - Each entry is a bar spanning its nights, clipped to the window. Blocked bars use `var(--surface-muted)` with a hairline border; booking bars use `var(--accent)` and `var(--accent-contrast)` text. Each bar has `title`/`aria-label` "River Hut: Booked 12 Oct – 14 Oct".
  - With zero properties, show the written empty state "Add a property to see its calendar here." with a link to `/dashboard/properties/new`.
  - Styles go in `web/app/dashboard/workspace.css` under a `/* Calendar timeline */` comment, using logical properties only.

- [ ] **Step 1: Write the failing tests.**
  - `calendar.test.ts`, with `// @req CAL-03`:
    - one host with two properties, a block on property A, and a booking on property B inserted via the host client (`status: "approved"`, `total_price_cents`, `start_date`/`end_date`);
    - `listCalendar(host.supabase, orgId, from, 30)` returns both rows, with the right `kind`s and ranges;
    - an entry entirely outside the window is excluded.

    Check the bookings table's required columns in `supabase/migrations/20260922080000_bookings.sql` before writing the insert.
  - `timeline.test.tsx`, with `// @req CAL-03`: render two rows and assert both property names appear, and that a bar's `aria-label` is "River Hut: Booked 12 Oct – 14 Oct". Also cover the empty state.
  - `layout.test.tsx`: update the nav test so **Calendar** is now a link to `/dashboard/calendar` in both the sidebar and the mobile tab bar, and Inbox is still `aria-disabled`. Keep every other assertion.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
  - **`calendar.ts`:** fetch properties (`id, name`), blocks (`property_id, start_date, end_date, reason`, filtered `.in("property_id", ids)`, `.lt("start_date", to)`, `.gt("end_date", from)`) and bookings (the same filters, plus `.in("status", ["approved","paid","staying"])`). Then group by property.
  - **`timeline.tsx`:** a server-safe component with no hooks.
  - **`calendar/page.tsx`:**
    - `searchParams: Promise<{ from?: string }>`; `from` defaults to `localToday()` and must be `isIsoDate`, else use today.
    - `nights = 42`.
    - A `PageHeader` "Calendar" with description "Every property, the next six weeks. Blocks and confirmed bookings together."
    - Actions: "Previous" and "Next" links (`buttonClasses("secondary")`, `?from=` ± 42 days) and "Today".
    - The `Timeline` inside a `Sheet`.
  - **`dashboard-nav.tsx`:** remove `upcoming: true` from Calendar. In the mobile tab bar, add a Calendar tab (`IconCalendar`) between Properties and More.
- [ ] **Step 4: Verify.** Run the tests, tsc, eslint and audit.
- [ ] **Step 5: Commit.** Message: `feat: one calendar for every property`

---

### Task 6: Public availability and live price (CAL-07, CAL-08, CAL-09)

**Files:**
- Modify `web/lib/public/catalogue.ts`, `catalogue.test.ts`, `web/app/s/[org]/[property]/page.tsx`, `property-view.tsx`, `web/app/s/[org]/public.css`
- Create `web/app/s/[org]/[property]/stay-picker.tsx`, `stay-picker.test.tsx`

**Interfaces:**
- Consumes: Task 2 `quoteStay`, `nightStatus`, `QuoteInput`, `addDays`, `monthStart`; Task 3 `MonthGrid`; `localToday`; `formatRupees`.
- Produces:

```ts
// catalogue.ts
export type PublicAvailability = { minimumStay: number; rules: RateRule[]; blocks: DateRange[] };
export async function getPublicAvailability(supabase: SupabaseClient, propertyId: string, today: string): Promise<PublicAvailability>
// stay-picker.tsx ("use client")
export function StayPicker(props: { baseRateCents: number; availability: PublicAvailability; today: string; whatsappHref: string | null; propertyName: string }): JSX.Element
```

- **`getPublicAvailability`** reads with the anon client:
  - `properties.minimum_stay`;
  - `availability_blocks (start_date, end_date)` where `end_date > today`, over the next 12 months, i.e. `start_date < addDays(today, 366)`;
  - `seasonal_pricing_rules (start_date, end_date, rate_cents, minimum_stay)` with the same window.

  It uses explicit columns only and throws on error. The property must be published; the caller already ensures that.
- **`StayPicker`** is a client component, kept small (no date library):
  - It shows two months side by side from `sm` (one on mobile), with ‹ › buttons to move, starting from today's month and never going before it.
  - The first tap on an available night sets check-in. The second tap sets checkout, which must be after check-in. That date may be a blocked night, since checkout happens that morning. A tap before check-in restarts.
  - Every night from check-in up to the first blocked night after it is selectable as checkout. Nights past a blocked night are shown as not selectable for checkout.
  - It uses `quoteStay` for the live quote panel:
    - when valid: "3 nights · Rs 45,000", plus a per-rate breakdown line when rates differ ("2 × Rs 10,000 · 1 × Rs 25,000"), plus a primary link "Ask to book on WhatsApp" (`whatsappHref` with `?text=` "Hi, I'd like to book {property} from {12 Oct} to {15 Oct} (3 nights).");
    - when `minimum_stay`: "This stay needs at least N nights.";
    - before any selection: "Select your check-in date." and "Minimum stay: N nights" when N > 1;
    - a "Clear dates" ghost button.
  - The legend: available, unavailable (struck), selected.
  - Calendar day `aria-label`s: "Monday 12 October 2026, available" / ", unavailable" / ", check-in" / ", checkout".
- **`property-view.tsx`:**
  - Add an "Availability" section (`property-section`, heading "When you can stay") that renders `<StayPicker …>`. `PropertyView` gains props `availability: PublicAvailability` and `today: string`. Update the existing `property-view.test.tsx` fixtures, passing an empty availability and a fixed today.
  - In the desktop booking panel, change the note to: "Pick your dates below to see the total, then message the host to book."
- **`page.tsx`:** in `load`, also call `getPublicAvailability(supabase, property.id, localToday())` and pass it and `today` through.
- **`public.css`:** add `.stay-picker` layout (months grid 1 → 2 columns at 640px), `.stay-quote` panel (16px radius, `var(--surface-muted)`), and the legend swatches. Logical properties only, mobile-first.

- [ ] **Step 1: Write the failing tests.**
  - In `catalogue.test.ts`, add a test tagged `// @req CAL-07` and `// @req CAL-08`:
    - as the host, create a block (next month, 3 nights) and a seasonal rule on the published property;
    - `getPublicAvailability(anonClient(), …)` returns the block dates and the rule;
    - also check a draft property's availability comes back empty through anon.
  - `stay-picker.test.tsx` (jsdom), with `today="2026-10-01"`, base Rs 10,000, a block 10–12 Oct, and a rule 20–22 Oct at Rs 25,000:
    - `// @req CAL-08`: the 10 and 11 Oct day cells are not buttons, and their labels end in "unavailable";
    - `// @req CAL-09`: clicking 19 Oct and then 22 Oct shows "3 nights" and "Rs 60,000" (10,000 + 25,000 + 25,000);
    - `// @req CAL-07`: renders "October 2026" and "November 2026";
    - clicking 9 Oct and then 13 Oct is impossible (13 isn't selectable as checkout past the block), while 9 → 10 works (1 night, but the minimum stay is 2) and shows the minimum-stay message.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** `getPublicAvailability`, then `stay-picker.tsx`, then wire the view and page. Keep the client component under about 150 lines; put any helper logic in `quote.ts`/`dates.ts` if it's pure.
- [ ] **Step 4: Verify.** Run `cd web && npx vitest run --maxWorkers=1 lib/public lib/availability app/s components/calendar`, tsc, eslint and root `npm run audit`.
- [ ] **Step 5: Commit.** Message: `feat: live availability and pricing on the public property page`

---

### Task 7: Milestone gate

**Files:** Modify `.github/workflows/ci.yml` and `docs/TRACKER.md`.

- [ ] **Step 1:** In `ci.yml`, change `--milestone M5` to `--milestone M6`.
- [ ] **Step 2:** Run the full pre-push sequence from the Global Constraints. `npm run audit -- --milestone M6` must report M6 10/10. If a CAL requirement is uncovered, add the missing `// @req` tag to the test that proves it; never edit the auditor.
- [ ] **Step 3:** Commit `ci.yml` and the regenerated `docs/TRACKER.md`. Message: `chore: gate CI on M6`

---

## Milestone finish

1. Final whole-branch review, with emphasis on what anon can read now and on off-by-one night handling.
2. Browser walk at 1440 and 390px: block a week on a published property, then open the public page in a fresh (signed-out) context and see those nights unavailable (the M6 "done when"). Also check a seasonal price in the quote, the all-properties calendar, and the pricing page.
3. `npx supabase db push` to the hosted project, push `main`, watch CI, and curl a live `/s/…` page.
