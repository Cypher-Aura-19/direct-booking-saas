import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";
import { types } from "pg";

// Override the DATE type parser to handle timezone correctly.
// The pg library's default DATE parser creates Date objects with timezone offsets,
// which causes .toISOString() to return the wrong date. This parser returns a Date
// that represents the same date in UTC, regardless of the client's timezone.
types.setTypeParser(1082, (val) => {
  return new Date(val + "T00:00:00Z");
});

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
