import { test } from "node:test";
import assert from "node:assert/strict";
import {
  withDb,
  actAsAuthenticated,
  actAsAnon,
  createTestHost,
  insertOrg,
  insertProperty,
} from "./helpers.mjs";

// A failed statement aborts the surrounding transaction. Wrapping each
// expected failure in a savepoint lets one test assert several of them.
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

test("a property inserted without a slug gets a generated, well-formed one", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      await actAsAuthenticated(db, host.userId);
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId);
      const { rows } = await db.query("select slug from public.properties where id = $1", [id]);
      assert.match(rows[0].slug, /^p-[0-9a-f]{8}$/);
    });
  } finally {
    await host.cleanup();
  }
});

test("two properties in one organisation cannot share a slug, but two organisations can", async () => {
  const hostA = await createTestHost();
  const hostB = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgA = await insertOrg(db, hostA.userId);
      const orgB = await insertOrg(db, hostB.userId);
      const insert = (orgId) =>
        db.query(
          `insert into public.properties
             (organization_id, name, property_type, address, base_rate_cents, max_guests, slug)
           values ($1, 'Sea View', 'villa', 'Karachi', 500000, 4, 'sea-view')`,
          [orgId],
        );
      await insert(orgA);
      await expectPgError(db, "23505", () => insert(orgA));
      await insert(orgB);
    });
  } finally {
    await hostA.cleanup();
    await hostB.cleanup();
  }
});

test("slug format, base rate and max guests are enforced by the database", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      await expectPgError(db, "23514", () => insertProperty(db, orgId, { base_rate_cents: 0 }));
      await expectPgError(db, "23514", () => insertProperty(db, orgId, { max_guests: 0 }));
      await expectPgError(db, "23514", () => insertProperty(db, orgId, { max_guests: 51 }));
      await expectPgError(db, "23514", () =>
        db.query(
          `insert into public.properties
             (organization_id, name, property_type, address, base_rate_cents, max_guests, slug)
           values ($1, 'Bad', 'villa', 'Lahore', 500000, 4, 'Not A Slug')`,
          [orgId],
        ),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("the anon role can read a published property's slug but still not its knowledge base", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const id = await insertProperty(db, orgId, { published: true });
      await actAsAnon(db);
      const { rows } = await db.query("select slug from public.properties where id = $1", [id]);
      assert.equal(rows.length, 1);
      await expectPgError(db, "42501", () =>
        db.query("select knowledge_base from public.properties where id = $1", [id]),
      );
    });
  } finally {
    await host.cleanup();
  }
});

test("only one photo per property can be the cover", async () => {
  const host = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgId = await insertOrg(db, host.userId);
      const propertyId = await insertProperty(db, orgId);
      const insertCover = (position) =>
        db.query(
          `insert into public.property_photos (property_id, storage_path, position, is_cover)
           values ($1, $2, $3, true)`,
          [propertyId, `${propertyId}/${position}.jpg`, position],
        );
      await insertCover(0);
      await expectPgError(db, "23505", () => insertCover(1));
    });
  } finally {
    await host.cleanup();
  }
});

test("the property-photos bucket is private and accepts only images up to 10 MiB", async () => {
  await withDb(async (db) => {
    const { rows } = await db.query(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'property-photos'",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].public, false);
    assert.equal(Number(rows[0].file_size_limit), 10 * 1024 * 1024);
    assert.deepEqual([...rows[0].allowed_mime_types].sort(), ["image/jpeg", "image/png", "image/webp"]);
  });
});

// Supabase's pg_default_acl for schema public grants EXECUTE to anon,
// authenticated and service_role by name on every new function, so
// `revoke ... from public` alone does not remove anon's grant (migration
// 20260925010000). anon must be revoked explicitly on every one of these.
test("anon cannot execute the photo-management functions; authenticated still can", async () => {
  await withDb(async (db) => {
    const functions = [
      "public.reorder_property_photos(uuid, uuid[])",
      "public.set_property_cover(uuid)",
      "public.owns_property_object(text)",
    ];
    for (const signature of functions) {
      const anon = await db.query("select has_function_privilege('anon', $1, 'execute') as allowed", [signature]);
      assert.equal(anon.rows[0].allowed, false, `anon should not be able to execute ${signature}`);
      const authenticated = await db.query(
        "select has_function_privilege('authenticated', $1, 'execute') as allowed",
        [signature],
      );
      assert.equal(authenticated.rows[0].allowed, true, `authenticated should be able to execute ${signature}`);
    }
  });
});

test("no role can execute the slug trigger function directly", async () => {
  await withDb(async (db) => {
    for (const role of ["anon", "authenticated"]) {
      const { rows } = await db.query(
        "select has_function_privilege($1, 'public.properties_default_slug()', 'execute') as allowed",
        [role],
      );
      assert.equal(rows[0].allowed, false, `${role} should not be able to execute properties_default_slug directly`);
    }
  });
});

test("a photo's storage_path must start with its own property's id", async () => {
  const hostA = await createTestHost();
  const hostB = await createTestHost();
  try {
    await withDb(async (db) => {
      const orgA = await insertOrg(db, hostA.userId);
      const orgB = await insertOrg(db, hostB.userId);
      const propertyA = await insertProperty(db, orgA);
      const propertyB = await insertProperty(db, orgB);

      await expectPgError(db, "23514", () =>
        db.query(
          `insert into public.property_photos (property_id, storage_path, position, is_cover)
           values ($1, $2, 0, true)`,
          [propertyA, `${propertyB}/evil.jpg`],
        ),
      );

      const { rows } = await db.query(
        `insert into public.property_photos (property_id, storage_path, position, is_cover)
         values ($1, $2, 0, true) returning id`,
        [propertyA, `${propertyA}/ok.jpg`],
      );
      assert.equal(rows.length, 1);
    });
  } finally {
    await hostA.cleanup();
    await hostB.cleanup();
  }
});
