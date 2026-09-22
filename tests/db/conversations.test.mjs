import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

// @req DB-07
test("conversations table stores guest token, AI state, AI enabled flag and escalation reason", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const { rows } = await db.query(
        `insert into public.conversations (property_id)
         values ($1)
         returning guest_token, ai_state, ai_enabled, escalated, escalation_reason`,
        [propertyId],
      );
      assert.equal(typeof rows[0].guest_token, "string");
      assert.equal(rows[0].ai_state, "enquiry");
      assert.equal(rows[0].ai_enabled, true);
      assert.equal(rows[0].escalated, false);
      assert.equal(rows[0].escalation_reason, null);
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-16
test("guest conversation tokens are unguessable and unique", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const a = await db.query(
        `insert into public.conversations (property_id) values ($1) returning guest_token`,
        [propertyId],
      );
      const b = await db.query(
        `insert into public.conversations (property_id) values ($1) returning guest_token`,
        [propertyId],
      );
      const tokenA = a.rows[0].guest_token;
      const tokenB = b.rows[0].guest_token;

      assert.notEqual(tokenA, tokenB);
      assert.match(tokenA, /^[0-9a-f]{64}$/, "expected a 256-bit hex token, not a guessable sequence");

      await assert.rejects(
        () =>
          db.query(
            `insert into public.conversations (property_id, guest_token) values ($1, $2)`,
            [propertyId, tokenA],
          ),
        (err) => err.code === "23505",
      );
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-09
test("a conversation cannot leave payment state except by moving to stay, closing the ai_state flip-flop", async () => {
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

      await db.query("savepoint before_backward_transition");
      await assert.rejects(
        () =>
          db.query(
            `update public.conversations set ai_state = 'enquiry' where id = $1`,
            [conversationId],
          ),
        (err) => err.code === "23514",
      );
      await db.query("rollback to savepoint before_backward_transition");

      const { rows } = await db.query(
        `update public.conversations set ai_state = 'stay' where id = $1 returning ai_state`,
        [conversationId],
      );
      assert.equal(rows[0].ai_state, "stay");
    });
  } finally {
    await host.cleanup();
  }
});

// @req DB-09
test("stay state is terminal — a conversation cannot leave it once reached", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);

      const conv = await db.query(
        `insert into public.conversations (property_id, ai_state) values ($1, 'stay') returning id`,
        [propertyId],
      );
      const conversationId = conv.rows[0].id;

      await db.query("savepoint before_leaving_stay");
      await assert.rejects(
        () =>
          db.query(
            `update public.conversations set ai_state = 'enquiry' where id = $1`,
            [conversationId],
          ),
        (err) => err.code === "23514",
      );
      await db.query("rollback to savepoint before_leaving_stay");

      const { rows } = await db.query(
        `select ai_state from public.conversations where id = $1`,
        [conversationId],
      );
      assert.equal(rows[0].ai_state, "stay");
    });
  } finally {
    await host.cleanup();
  }
});
