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
