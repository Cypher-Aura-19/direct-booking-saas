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
      // M11b changed this contract: retention is checkout-based
      // (stay_end + 90 days, capped by a trigger) and has no default, so
      // the row must say which stay it belongs to.
      const { rows } = await db.query(
        `insert into public.guest_documents
           (guest_id, organization_id, image_path, cnic_number, stay_start, stay_end, retention_expires_at)
         values ($1, $2, 'cnic/ali.jpg', '35202-1234567-1', '2026-12-01', '2026-12-03',
                 public.guest_document_retention_cap('2026-12-03'))
         returning image_path, retention_expires_at, stay_end`,
        [guest.rows[0].id, orgId],
      );
      assert.equal(rows[0].image_path, "cnic/ali.jpg");
      const checkout = new Date("2026-12-03T00:00:00+05:00");
      const days = (new Date(rows[0].retention_expires_at) - checkout) / (1000 * 60 * 60 * 24);
      assert.equal(days, 90, `expected retention 90 days after checkout, got ${days} days`);

      // A record that does not say when the stay ends is refused.
      await assert.rejects(
        db.query(
          `insert into public.guest_documents (guest_id, organization_id, image_path, retention_expires_at)
           values ($1, $2, 'cnic/x.jpg', now())`,
          [guest.rows[0].id, orgId],
        ),
        /stay end date/,
      );
    });
  } finally {
    await host.cleanup();
  }
});
