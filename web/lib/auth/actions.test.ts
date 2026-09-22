// @vitest-environment node
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { signUpHost, signInHost, signOutHost } from "./actions";
import { supabaseEnv, supabaseAdmin, createTestHost } from "../../tests/helpers";

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

// @req AUTH-02
test("a host can log in with the correct password", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    const { error } = await signInHost(supabase, { email: host.email, password: host.password });
    expect(error).toBeNull();

    const { data } = await supabase.auth.getUser();
    expect(data.user?.id).toBe(host.userId);
  } finally {
    await host.cleanup();
  }
});

// @req AUTH-02
test("a host cannot log in with the wrong password", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    const { error } = await signInHost(supabase, { email: host.email, password: "wrong-password" });
    expect(error).not.toBeNull();
  } finally {
    await host.cleanup();
  }
});

// @req AUTH-03
test("a host can log out, ending the session", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    await signInHost(supabase, { email: host.email, password: host.password });
    const { error } = await signOutHost(supabase);
    expect(error).toBeNull();

    const { data } = await supabase.auth.getUser();
    expect(data.user).toBeNull();
  } finally {
    await host.cleanup();
  }
});
