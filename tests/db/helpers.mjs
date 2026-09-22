import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

let cachedEnv;

// Reads connection info from the running local stack instead of hardcoding
// ports or keys, so this keeps working if either ever changes.
export function supabaseEnv() {
  if (cachedEnv) return cachedEnv;
  const raw = execFileSync(NPX, ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    // Required on Windows: Node refuses to spawn a .cmd file directly
    // without shell:true (post CVE-2024-27980), throwing EINVAL otherwise.
    // Arguments here are static literals, not user input, so this is safe.
    shell: process.platform === "win32",
  });
  const status = JSON.parse(raw);
  cachedEnv = {
    dbUrl: status.DB_URL,
    apiUrl: status.API_URL,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
  return cachedEnv;
}

// Runs `fn` inside a transaction that is always rolled back, so tests never
// need to clean up the rows they insert. Only real auth.users rows created
// via createTestHost() live outside this transaction and need cleanup().
export async function withDb(fn) {
  const { dbUrl } = supabaseEnv();
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    try {
      await client.query("rollback");
    } catch {
      // Transaction may already be aborted by an expected failed query.
    }
    await client.end();
  }
}

// Switches the current session to the `authenticated` role with a forged
// JWT claim, exactly as PostgREST would for a real logged-in host. This is
// Supabase's own documented technique for testing RLS without a live
// HTTP round trip through GoTrue for every assertion.
export async function actAsAuthenticated(db, userId) {
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
}

// Switches the current session to the `anon` role with a forged JWT claim,
// exactly as PostgREST would for an unauthenticated request. Used to prove
// public-catalogue RLS policies only expose what they should.
export async function actAsAnon(db) {
  await db.query("set local role anon");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ role: "anon" }),
  ]);
}

let counter = 0;

// Creates a real row in auth.users via the local GoTrue admin API. Callers
// must call cleanup() so repeated local test runs don't accumulate users.
export async function createTestHost() {
  const { apiUrl, serviceRoleKey } = supabaseEnv();
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `test-host-${Date.now()}-${counter++}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Test-password-123!",
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  return {
    userId,
    async cleanup() {
      await admin.auth.admin.deleteUser(userId);
    },
  };
}

// Inserts an organisation owned by `ownerId`. Runs under whatever role is
// active on `db` — pass a plain superuser connection for schema tests, or
// call actAsAuthenticated first to exercise RLS.
export async function insertOrg(db, ownerId, overrides = {}) {
  const org = {
    slug: `org-${Date.now()}-${counter++}`,
    name: "Test Org",
    ...overrides,
  };
  const { rows } = await db.query(
    `insert into public.organizations (owner_id, slug, name)
     values ($1, $2, $3) returning id`,
    [ownerId, org.slug, org.name],
  );
  return rows[0].id;
}

// Inserts a property under `organizationId`. Runs under whatever role is
// active on `db` — pass a plain superuser connection for schema tests, or
// call actAsAuthenticated first to exercise RLS.
export async function insertProperty(db, organizationId, overrides = {}) {
  const p = {
    name: "Test Property",
    property_type: "villa",
    address: "Lahore",
    base_rate_cents: 500000,
    max_guests: 4,
    published: false,
    ...overrides,
  };
  const { rows } = await db.query(
    `insert into public.properties
       (organization_id, name, property_type, address, base_rate_cents, max_guests, published)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [organizationId, p.name, p.property_type, p.address, p.base_rate_cents, p.max_guests, p.published],
  );
  return rows[0].id;
}
