import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withDb,
  actAsAuthenticated,
  actAsAnon,
  createTestHost,
  insertOrg,
} from "./helpers.mjs";

// @req DB-02
test("properties table carries its own knowledge base and AI settings", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const { rows } = await db.query(
        `insert into public.properties
           (organization_id, name, property_type, address, base_rate_cents, max_guests, knowledge_base, ai_settings)
         values ($1, 'Sunset Villa', 'villa', 'Lahore', 500000, 4, $2, $3)
         returning knowledge_base, ai_settings`,
        [
          orgId,
          JSON.stringify({ wifi_password: "guestwifi123", gate_code: "4821" }),
          JSON.stringify({ quote_nightly_rate: true }),
        ],
      );
      assert.equal(rows[0].knowledge_base.gate_code, "4821");
      assert.equal(rows[0].ai_settings.quote_nightly_rate, true);
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-15
test("the anon role can read only published properties", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const published = await db.query(
        `insert into public.properties
           (organization_id, name, property_type, address, base_rate_cents, max_guests, published)
         values ($1, 'Published Villa', 'villa', 'Lahore', 500000, 4, true) returning id`,
        [orgId],
      );
      await db.query(
        `insert into public.properties
           (organization_id, name, property_type, address, base_rate_cents, max_guests, published)
         values ($1, 'Draft Villa', 'villa', 'Lahore', 500000, 4, false)`,
        [orgId],
      );

      await actAsAnon(db);
      const { rows } = await db.query(
        `select id from public.properties where organization_id = $1`,
        [orgId],
      );
      assert.deepEqual(rows.map((r) => r.id), [published.rows[0].id]);
    });
  } finally {
    await host.cleanup();
  }
});
