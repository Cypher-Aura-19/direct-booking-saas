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
