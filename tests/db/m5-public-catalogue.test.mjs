import { test } from "node:test";
import assert from "node:assert/strict";
import { withDb, actAsAuthenticated, actAsAnon, createTestHost, insertOrg, insertProperty } from "./helpers.mjs";

async function expectPgError(db, code, fn) {
  await db.query("savepoint expect_error");
  try {
    await fn();
    assert.fail(`expected Postgres error ${code}, but the statement succeeded`);
  } catch (error) {
    if (error.code === "ERR_ASSERTION") throw error;
    assert.equal(error.code, code, error.message);
  } finally {
    await db.query("rollback to savepoint expect_error");
  }
}

test("properties carry a description and known amenities, and reject unknown ones", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query("select description, amenities from public.properties where id = $1", [id]);
      assert.equal(rows[0].description, "");
      assert.deepEqual(rows[0].amenities, []);
      await db.query("update public.properties set description = 'Quiet rooms', amenities = '{wifi,parking}' where id = $1", [id]);
      await expectPgError(db, "23514", () =>
        db.query("update public.properties set amenities = '{jacuzzi}' where id = $1", [id]),
      );
      await expectPgError(db, "23514", () =>
        db.query("update public.properties set description = repeat('a', 2001) where id = $1", [id]),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("anon reads an organisation's public columns but never its owner, payments or policies", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId, { slug: `m5-org-${Date.now()}` });
      await db.query(
        `update public.organizations set profile = '{"city":"Hunza","phone":"03001234567","headline":"Cabins"}',
           payment_instructions = '{"bank":"secret"}' where id = $1`,
        [orgId],
      );
      await actAsAnon(db);
      const { rows } = await db.query("select id, slug, name, profile, created_at from public.organizations where id = $1", [orgId]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].profile.city, "Hunza");
      for (const column of ["owner_id", "payment_instructions", "policies", "account_status"]) {
        await expectPgError(db, "42501", () => db.query(`select ${column} from public.organizations where id = $1`, [orgId]));
      }
    });
  } finally {
    await host.cleanup();
  }
});

test("anon reads listing columns of published properties but not the address or knowledge base", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId, { published: true });
      await actAsAnon(db);
      const { rows } = await db.query("select description, amenities from public.properties where id = $1", [id]);
      assert.equal(rows.length, 1);
      for (const column of ["address", "knowledge_base", "ai_settings"]) {
        await expectPgError(db, "42501", () => db.query(`select ${column} from public.properties where id = $1`, [id]));
      }
    });
  } finally {
    await host.cleanup();
  }
});

test("anon sees photo rows and storage objects of published properties only", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const published = await insertProperty(db, orgId, { published: true });
      const draft = await insertProperty(db, orgId, { published: false });
      for (const propertyId of [published, draft]) {
        await db.query(
          "insert into public.property_photos (property_id, storage_path, position, is_cover) values ($1, $2, 0, true)",
          [propertyId, `${propertyId}/a.jpg`],
        );
      }
      await db.query("reset role");
      for (const propertyId of [published, draft]) {
        await db.query(
          "insert into storage.objects (bucket_id, name, owner) values ('property-photos', $1, $2)",
          [`${propertyId}/a.jpg`, host.userId],
        );
      }
      await actAsAnon(db);
      const rows = await db.query("select property_id from public.property_photos where property_id = any($1)", [[published, draft]]);
      assert.deepEqual(rows.rows.map((r) => r.property_id), [published]);
      const objects = await db.query(
        "select name from storage.objects where bucket_id = 'property-photos' and name = any($1)",
        [[`${published}/a.jpg`, `${draft}/a.jpg`]],
      );
      assert.deepEqual(objects.rows.map((r) => r.name), [`${published}/a.jpg`]);
      await expectPgError(db, "42501", () =>
        db.query("insert into public.property_photos (property_id, storage_path, position) values ($1, $2, 1)", [published, `${published}/b.jpg`]),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("photos record whether resized variants exist, defaulting to false", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query(
        "insert into public.property_photos (property_id, storage_path, position) values ($1, $2, 0) returning has_variants",
        [id, `${id}/a.jpg`],
      );
      assert.equal(rows[0].has_variants, false);
    });
  } finally {
    await host.cleanup();
  }
});
