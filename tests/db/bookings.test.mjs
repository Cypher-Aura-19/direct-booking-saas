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
