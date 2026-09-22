import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb } from "./helpers.mjs";

// @req DB-13
test("row level security is enabled on every table in the public schema", async () => {
  await withDb(async (db) => {
    const { rows } = await db.query(`
      select relname
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relkind = 'r'
        and pg_class.relrowsecurity = false
    `);
    assert.deepEqual(
      rows,
      [],
      `tables without row level security: ${rows.map((r) => r.relname).join(", ")}`,
    );
  });
});
