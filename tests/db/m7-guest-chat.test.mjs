import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, actAsAnon, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

async function expectPgError(db, code, fn) {
  await db.query("savepoint e");
  try { await fn(); assert.fail(`expected ${code}`); }
  catch (error) { if (error.code === "ERR_ASSERTION") throw error; assert.equal(error.code, code, error.message); }
  finally { await db.query("rollback to savepoint e"); }
}

// @req SEC-07
test("anon has no access to conversations or messages at all", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId, { published: true });
      const { rows } = await db.query("insert into public.conversations (property_id) values ($1) returning id", [propertyId]);
      await actAsAnon(db);
      await expectPgError(db, "42501", () => db.query("select guest_token from public.conversations"));
      await expectPgError(db, "42501", () => db.query("select body from public.messages"));
      await expectPgError(db, "42501", () => db.query("insert into public.messages (conversation_id, sender, body) values ($1, 'guest', 'hi')", [rows[0].id]));
    });
  } finally { await host.cleanup(); }
});

test("message bodies must be 1-4000 characters", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const { rows } = await db.query("insert into public.conversations (property_id) values ($1) returning id", [propertyId]);
      await expectPgError(db, "23514", () => db.query("insert into public.messages (conversation_id, sender, body) values ($1, 'guest', '')", [rows[0].id]));
      await expectPgError(db, "23514", () => db.query("insert into public.messages (conversation_id, sender, body) values ($1, 'guest', repeat('a', 4001))", [rows[0].id]));
    });
  } finally { await host.cleanup(); }
});

// @req SEC-06
test("new conversation tokens are 64 lowercase hex characters and unique", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const { rows } = await db.query("insert into public.conversations (property_id) select $1 from generate_series(1, 20) returning guest_token", [propertyId]);
      for (const r of rows) assert.match(r.guest_token, /^[0-9a-f]{64}$/);
      assert.equal(new Set(rows.map((r) => r.guest_token)).size, 20);
    });
  } finally { await host.cleanup(); }
});
