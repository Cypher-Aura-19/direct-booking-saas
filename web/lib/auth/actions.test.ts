// @vitest-environment node
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { signUpHost, signInHost, signOutHost, requestPasswordReset, updatePassword } from "./actions";
import { supabaseEnv, createTestHost, pollMailpitFor } from "../../tests/helpers";

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

// @req AUTH-06
test("a host can request a password reset and a real email is sent", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    const { error } = await requestPasswordReset(supabase, {
      email: host.email,
      redirectTo: "http://127.0.0.1:3000/auth/callback?next=/reset-password",
    });
    expect(error).toBeNull();

    const mail = await pollMailpitFor(host.email);
    expect(mail.subject.toLowerCase()).toMatch(/reset|recovery|password/);
  } finally {
    await host.cleanup();
  }
});

// @req AUTH-06
test("a host can set a new password and then log in with it", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    await signInHost(supabase, { email: host.email, password: host.password });

    const newPassword = "New-password-456!";
    const { error } = await updatePassword(supabase, { password: newPassword });
    expect(error).toBeNull();

    await signOutHost(supabase);
    const { error: oldPasswordError } = await signInHost(supabase, {
      email: host.email,
      password: host.password,
    });
    expect(oldPasswordError).not.toBeNull();

    const { error: newPasswordError } = await signInHost(supabase, {
      email: host.email,
      password: newPassword,
    });
    expect(newPasswordError).toBeNull();
  } finally {
    await host.cleanup();
  }
});
