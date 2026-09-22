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
