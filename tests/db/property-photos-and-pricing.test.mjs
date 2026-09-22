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
