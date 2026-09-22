// @vitest-environment node
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { signUpHost } from "./actions";
import { supabaseEnv, supabaseAdmin } from "../../tests/helpers";

// @req AUTH-01
test("a host can sign up with email, password and name", async () => {
  const { apiUrl, anonKey, serviceRoleKey } = supabaseEnv();
  const supabase = createClient(apiUrl, anonKey);
  const email = `test-signup-${crypto.randomUUID()}@example.test`;

  const { error } = await signUpHost(supabase, {
    email,
    password: "Test-password-123!",
    name: "Ali Khan",
    emailRedirectTo: "http://127.0.0.1:3000/auth/callback",
  });
  expect(error).toBeNull();

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userList } = await admin.auth.admin.listUsers();
  const created = userList.users.find((u) => u.email === email);
  expect(created).toBeDefined();
  expect(created!.user_metadata.full_name).toBe("Ali Khan");
  // Confirmations are on: signing up must not confirm the email immediately.
  expect(created!.email_confirmed_at).toBeFalsy();

  await admin.auth.admin.deleteUser(created!.id);
});
