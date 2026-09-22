import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-08
test("messages table records a sender of guest, ai or host", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const conv = await db.query(
        `insert into public.conversations (property_id) values ($1) returning id`,
        [propertyId],
      );
      const conversationId = conv.rows[0].id;

      for (const sender of ["guest", "ai", "host"]) {
        const { rows } = await db.query(
          `insert into public.messages (conversation_id, sender, body)
           values ($1, $2, 'hi') returning sender`,
          [conversationId, sender],
        );
        assert.equal(rows[0].sender, sender);
      }

      await assert.rejects(
        () =>
          db.query(
            `insert into public.messages (conversation_id, sender, body) values ($1, 'system', 'hi')`,
            [conversationId],
          ),
        (err) => err.code === "23514",
      );
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-09
test("a constraint forbids an ai message on a conversation in payment state", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const conv = await db.query(
        `insert into public.conversations (property_id, ai_state) values ($1, 'payment') returning id`,
        [propertyId],
      );
      const conversationId = conv.rows[0].id;

      await db.query("savepoint before_ai_message");
      await assert.rejects(() =>
        db.query(
          `insert into public.messages (conversation_id, sender, body) values ($1, 'ai', 'your total is...')`,
          [conversationId],
        ),
      );
      await db.query("rollback to savepoint before_ai_message");

      const { rows } = await db.query(
        `insert into public.messages (conversation_id, sender, body)
         values ($1, 'host', 'sending payment link') returning sender`,
        [conversationId],
      );
      assert.equal(rows[0].sender, "host");
    });
  } finally {
    await host.cleanup();
  }
});
