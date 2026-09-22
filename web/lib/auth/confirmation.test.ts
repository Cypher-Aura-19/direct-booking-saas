// @vitest-environment node
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { signUpHost } from "./actions";
import { supabaseEnv, supabaseAdmin, pollMailpitFor, firstLinkIn } from "../../tests/helpers";

// @req AUTH-05
test("email confirmation lands on a real link and completes signup", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const supabase = createClient(apiUrl, anonKey);
  const email = `test-confirm-${crypto.randomUUID()}@example.test`;
  const admin = supabaseAdmin();

  const { error } = await signUpHost(supabase, {
    email,
    password: "Test-password-123!",
    name: "Ali Khan",
    emailRedirectTo: "http://127.0.0.1:3000/auth/callback",
  });
  expect(error).toBeNull();

  const { data: beforeList } = await admin.auth.admin.listUsers();
  const before = beforeList.users.find((u) => u.email === email)!;
  expect(before.email_confirmed_at).toBeFalsy();

  const mail = await pollMailpitFor(email);
  const link = firstLinkIn(mail.html || mail.text);

  // Follow the real confirmation link GoTrue put in the real email. Don't
  // follow the redirect it issues afterward — our Next app isn't running
  // during this test, only the local Supabase API is. GoTrue confirms the
  // user server-side as a side effect of processing this request,
  // independent of whatever it redirects to next.
  await fetch(link, { redirect: "manual" });

  const { data: afterList } = await admin.auth.admin.listUsers();
  const after = afterList.users.find((u) => u.email === email)!;
  expect(after.email_confirmed_at).toBeTruthy();

  await admin.auth.admin.deleteUser(before.id);
});
