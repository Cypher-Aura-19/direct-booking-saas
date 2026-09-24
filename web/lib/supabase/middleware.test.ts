// @vitest-environment node
import { test, expect, afterAll } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { updateSession, isProtectedPath } from "./middleware";
import { supabaseEnv, createTestHost } from "../../tests/helpers";

const host = await createTestHost();

afterAll(async () => {
  await host.cleanup();
});

// @req AUTH-04
test("middleware refreshes the session and forwards the updated cookies", async () => {
  const { apiUrl, anonKey } = supabaseEnv();

  // Sign in through a real ssr server client so the cookie(s) it produces
  // are in the exact format the middleware itself needs to parse back —
  // no need to hardcode or guess @supabase/ssr's cookie encoding.
  const written: Array<{ name: string; value: string }> = [];
  const signInClient = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookiesToSet) => {
        written.push(...cookiesToSet.map((c) => ({ name: c.name, value: c.value })));
      },
    },
  });
  const { error: signInError } = await signInClient.auth.signInWithPassword({
    email: host.email,
    password: host.password,
  });
  expect(signInError).toBeNull();
  expect(written.length).toBeGreaterThan(0);

  // A session fresh off signInWithPassword has ~1h left before expiry, well
  // outside @supabase/ssr's ~90s refresh margin (EXPIRY_MARGIN_MS) -- so
  // handing it to updateSession as-is would have nothing to refresh and no
  // cookies would come back (auth-js's _recoverAndRefresh() deliberately
  // skips re-persisting a session it just loaded unchanged). To exercise the
  // real refresh path, back-date the client-visible expires_at (not the JWT
  // itself, which the server still accepts) into that margin. The refresh
  // that follows still round-trips the real refresh_token to the local
  // GoTrue server and comes back with a genuinely new session.
  const authCookie = written.find((c) => c.name.endsWith("-auth-token"));
  if (!authCookie) throw new Error("sign-in did not produce an auth-token cookie");
  const session = JSON.parse(Buffer.from(authCookie.value.replace(/^base64-/, ""), "base64url").toString("utf8"));
  session.expires_at = Math.floor(Date.now() / 1000) + 30;
  authCookie.value = "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");

  const cookieHeader = written.map((c) => `${c.name}=${c.value}`).join("; ");
  const request = new NextRequest("http://localhost/dashboard", {
    headers: { cookie: cookieHeader },
  });

  const response = await updateSession(request);
  // A signed-in request to /dashboard must pass through, not bounce to login.
  expect(response.headers.get("location")).toBeNull();
  const responseCookies = response.cookies.getAll();

  expect(responseCookies.length).toBeGreaterThan(0);
});

// @req AUTH-04
test("middleware does not throw for an anonymous request with no session", async () => {
  const request = new NextRequest("http://localhost/");
  const response = await updateSession(request);
  expect(response).toBeDefined();
});

test("isProtectedPath covers the dashboard tree and onboarding only", () => {
  expect(isProtectedPath("/dashboard")).toBe(true);
  expect(isProtectedPath("/dashboard/properties/abc/photos")).toBe(true);
  expect(isProtectedPath("/onboarding")).toBe(true);
  expect(isProtectedPath("/")).toBe(false);
  expect(isProtectedPath("/login")).toBe(false);
  expect(isProtectedPath("/dashboardx")).toBe(false);
  expect(isProtectedPath("/s/sunset-stays")).toBe(false);
});

// @req AUTH-07
test("middleware redirects a signed-out request for any dashboard route to /login", async () => {
  const response = await updateSession(new NextRequest("http://localhost/dashboard/properties/abc/photos"));
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
});

test("middleware lets signed-out requests for public routes through", async () => {
  for (const path of ["/", "/login", "/signup"]) {
    const response = await updateSession(new NextRequest(`http://localhost${path}`));
    expect(response.headers.get("location")).toBeNull();
  }
});
