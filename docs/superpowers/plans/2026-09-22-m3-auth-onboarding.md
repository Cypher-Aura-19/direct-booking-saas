# M3 Auth and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host can sign up, confirm their email, log in, create their organisation through an onboarding wizard, reach a dashboard shell that stays reachable across logins, and log out — with every guard (auth required, organisation required) enforced server-side, not just hidden in the UI.

**Architecture:** Every requirement's substantive logic is a plain, exported async function that takes an already-constructed Supabase client as its first argument — `signUpHost(supabase, {...})`, `createOrganization(supabase, {...})`, `resolveDashboardAccess({ user, organization })`. These are the only things this plan tests directly, against the real local Supabase stack (no mocks), exactly like M2's database tests. Next.js Server Actions and Route Handlers that call `cookies()`/`redirect()` are thin wrappers around those functions — a few lines each, wiring the real cookie-bound client and handling navigation. Those wrappers are trusted framework glue, exercised by hand in the browser, the same way M1 never wrote a test for Next's own router. Session refresh middleware is the one piece of glue worth testing directly, because `NextRequest`/`NextResponse` are plain Fetch API objects constructible in a test without a running server.

**Tech Stack:** `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.0 (web dependencies — the root already has `supabase-js` as a dev dependency for M2's DB tests, that's separate and unaffected), Next.js 16.3.5 App Router, React 19.2.8 Server Actions (`useActionState`), Vitest 5.

## Global Constraints

Copied or derived from `docs/superpowers/specs/2026-09-20-phase-1-design.md` and the M1/M2 plans. These apply to every task below.

- **All layout uses CSS logical properties** (`padding-inline-start`, never `padding-left`). Tailwind logical utilities only. Enforced by the auditor (FOUND-14, A11Y-02).
- **One accent colour**, `bg-accent`/`text-accent-contrast`; semantic colours (`destructive`, `warning`, `success`) are separate tokens — use `text-destructive` for form error text, never a hardcoded red.
- **Interactive targets at least 44px on mobile** (A11Y-01) — the existing `Button` component (`web/components/ui/button.tsx`) already guarantees this; use it for every button, never a bare `<button>`.
- **The service-role key never reaches client-side code** (SEC-01). This milestone never uses it at all — every auth operation runs as the user's own session via the anon key. If a later task seems to need `SERVICE_ROLE_KEY`, that's a signal something is wrong with the design, not a reason to reach for it.
- **Every test that proves a requirement carries a `// @req <ID>` comment** immediately above it, with an ID that exists in `docs/requirements.md`. The auditor scans every `*.test.(ts|tsx|mjs|js)` file in the repo, so this applies to `web/**` exactly as it did to `tests/db/**` in M2.
- **No business logic lives inside a `"use server"` function or a Route Handler.** Extract it to a plain function first; the wrapper only constructs the real client, calls the function, and handles cookies/redirect. This is what keeps everything testable without a running Next server.
- **Password minimum length is 6** (`supabase/config.toml`'s `auth.minimum_password_length`) — do not invent a stricter client-side rule; Supabase itself is the source of truth and will reject anything shorter with a real error the UI already surfaces.
- **This machine is shared with unrelated projects.** Never stop, restart, remove or reconfigure a Docker container, volume or network you did not create. Only touch containers named `*_airbnb_like_system`.
- **Node's test runner needs glob arguments, not directories** (root-level tests only; this milestone's own tests all run under Vitest, which doesn't have this quirk).
- **`npm test` requires the local Supabase stack running** (`npm run db:start`) — already true since M2; this milestone adds a second requirement: `web/.env.local` must exist (Task 1 creates it) with `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` pointing at the local stack, or every test in this plan fails to connect.

**Commit after every task.** Never mark a step done without running the command and reading its output.

---

## File Structure

Almost entirely application code — the one exception is `supabase/migrations/20260923010000_organization_slug_lookup.sql` (Task 6), a single narrow function the live slug-availability check needs; see that task for why.

```
web/
├─ .env.local                          NEW, gitignored — local Supabase URL + anon key
├─ middleware.ts                       NEW — thin wrapper around updateSession()
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts                     NEW — browser client factory
│  │  ├─ server.ts                     NEW — cookie-bound server client factory
│  │  ├─ middleware.ts                 NEW — updateSession(request), the testable part
│  │  └─ middleware.test.ts            AUTH-04
│  ├─ auth/
│  │  ├─ actions.ts                    NEW — signUpHost, signInHost, signOutHost, requestPasswordReset, updatePassword
│  │  ├─ actions.test.ts               AUTH-01, AUTH-02, AUTH-03, AUTH-06
│  │  ├─ confirmation.test.ts          AUTH-05 (real Mailpit round trip)
│  │  └─ dashboard-access.ts           NEW — resolveDashboardAccess(), pure
│  │  └─ dashboard-access.test.ts      AUTH-07, AUTH-08
│  └─ organizations/
│     ├─ actions.ts                    NEW — RESERVED_SLUGS, slug validation, createOrganization
│     └─ actions.test.ts               AUTH-09, AUTH-10, AUTH-11, AUTH-12
├─ tests/
│  └─ helpers.ts                       NEW — supabaseEnv(), createTestHost(), Mailpit polling
└─ app/
   ├─ signup/{page.tsx, actions.ts, page.test.tsx}
   ├─ verify-email/page.tsx
   ├─ login/{page.tsx, actions.ts, page.test.tsx}
   ├─ forgot-password/{page.tsx, actions.ts}
   ├─ reset-password/{page.tsx, actions.ts}
   ├─ auth/callback/route.ts
   ├─ onboarding/{page.tsx, actions.ts, page.test.tsx}
   └─ dashboard/
      ├─ layout.tsx                    guard chain + responsive nav shell
      ├─ layout.test.tsx               AUTH-14 (nav renders both forms, CSS-toggled)
      ├─ page.tsx                      dashboard home
      ├─ page.test.tsx                 AUTH-13 (empty states)
      └─ settings/account/{page.tsx, actions.ts}
```

**Why `tests/helpers.ts` is separate from the root's `tests/db/helpers.mjs`:** `web/` is a separate npm package with its own `node_modules` (no `pg`) and its own test runner (Vitest, not `node --test`). Nothing here imports across that boundary.

---

## Task 1: Supabase client/server/middleware helpers and local env wiring

**Files:**
- Create: `web/.env.local` (gitignored, not committed)
- Create: `web/lib/supabase/client.ts`
- Create: `web/lib/supabase/server.ts`
- Create: `web/lib/supabase/middleware.ts`
- Create: `web/lib/supabase/middleware.test.ts`
- Create: `web/middleware.ts`
- Create: `web/tests/helpers.ts`
- Modify: `web/package.json` (add `@supabase/ssr`, `@supabase/supabase-js`)

**Interfaces:**
- Consumes: local Supabase stack (`npm run db:start`)
- Produces: `createClient()` (browser, from `lib/supabase/client.ts`), `createClient()` (server, from `lib/supabase/server.ts` — async, different module, same name is intentional and matches Supabase's own convention of importing whichever one the calling context needs), `updateSession(request: NextRequest): Promise<NextResponse>`, and from `tests/helpers.ts`: `supabaseEnv()`, `createTestHost()`, `pollMailpitFor(email): Promise<{ subject, text, html }>`

- [ ] **Step 1: Install dependencies**

Run: `npm install --prefix web @supabase/ssr@0.12.7 @supabase/supabase-js@2.117.0`
Expected: both appear in `web/package.json` dependencies (not devDependencies — these run in production) and `web/package-lock.json` updates.

- [ ] **Step 2: Write the local env file**

Run: `npx supabase status -o json` and read `API_URL` and `ANON_KEY` from the output.

Create `web/.env.local` (values below are placeholders — use the real values the command just printed):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

This file is gitignored by `web/.gitignore`'s existing `.env*` rule — confirm with `git status` that it does not appear as untracked.

- [ ] **Step 3: Write the browser and server client factories**

Create `web/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Create `web/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-bound client for Server Components, Server Actions and Route
// Handlers. Every write goes through setAll, which throws when called from
// a Server Component (cookies are read-only there) — middleware.ts is what
// actually refreshes the session, so that failure is expected and ignored.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — no-op, see comment above.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Write the failing middleware test**

Create `web/lib/supabase/middleware.test.ts`:

```ts
// @vitest-environment node
import { test, expect, afterAll } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";
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

  const cookieHeader = written.map((c) => `${c.name}=${c.value}`).join("; ");
  const request = new NextRequest("http://localhost/dashboard", {
    headers: { cookie: cookieHeader },
  });

  const response = await updateSession(request);
  const responseCookies = response.cookies.getAll();

  expect(responseCookies.length).toBeGreaterThan(0);
});

// @req AUTH-04
test("middleware does not throw for an anonymous request with no session", async () => {
  const request = new NextRequest("http://localhost/");
  const response = await updateSession(request);
  expect(response).toBeDefined();
});
```

- [ ] **Step 5: Write `tests/helpers.ts`, which the test above depends on**

Create `web/tests/helpers.ts`:

```ts
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

let cachedEnv: { apiUrl: string; anonKey: string; serviceRoleKey: string; mailpitUrl: string } | undefined;

// execSync always goes through a shell, so "npx" resolves correctly on
// Windows without the execFileSync("npx.cmd", ..., {shell:true}) dance
// tests/db/helpers.mjs needed at the repo root — no DEP0190 noise here.
export function supabaseEnv() {
  if (cachedEnv) return cachedEnv;
  const raw = execSync("npx supabase status -o json", { cwd: repoRoot, encoding: "utf8" });
  const status = JSON.parse(raw);
  cachedEnv = {
    apiUrl: status.API_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
    mailpitUrl: status.MAILPIT_URL,
  };
  return cachedEnv;
}

let counter = 0;

// Creates a real auth.users row with a real, known password, via the local
// GoTrue admin API. Callers must call cleanup().
export async function createTestHost(overrides: { emailConfirm?: boolean } = {}) {
  const { apiUrl, serviceRoleKey } = supabaseEnv();
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = `test-host-${crypto.randomUUID()}@example.test`;
  const password = "Test-password-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: overrides.emailConfirm ?? true,
  });
  if (error) throw error;
  const userId = data.user.id;
  return {
    userId,
    email,
    password,
    async cleanup() {
      await admin.auth.admin.deleteUser(userId);
    },
  };
}

type MailpitMessage = { ID: string; To: Array<{ Address: string }>; Subject: string };

// Polls Mailpit (the local stack's email-testing service) for the most
// recent message to `email`, up to `timeoutMs`. Returns its rendered text
// and HTML bodies. Real email delivery, not a mock.
export async function pollMailpitFor(
  email: string,
  { timeoutMs = 10_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ subject: string; text: string; html: string }> {
  const { mailpitUrl } = supabaseEnv();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const listResponse = await fetch(`${mailpitUrl}/api/v1/messages`);
    const list = (await listResponse.json()) as { messages: MailpitMessage[] };
    const match = list.messages.find((m) => m.To.some((to) => to.Address === email));
    if (match) {
      const detailResponse = await fetch(`${mailpitUrl}/api/v1/message/${match.ID}`);
      const detail = (await detailResponse.json()) as { Subject: string; Text: string; HTML: string };
      return { subject: detail.Subject, text: detail.Text, html: detail.HTML };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`no email arrived for ${email} within ${timeoutMs}ms`);
}

// Extracts the first http(s) URL from an email body, regardless of the
// exact Supabase email template wording — robust to template changes.
export function firstLinkIn(text: string): string {
  const match = text.match(/https?:\/\/[^\s"<>]+/);
  if (!match) throw new Error(`no link found in: ${text}`);
  return match[0];
}
```

- [ ] **Step 6: Run the middleware test and confirm it fails**

Run: `npm run test --prefix web -- middleware.test.ts`
Expected: FAIL — `Cannot find module './middleware'` (it doesn't exist yet).

- [ ] **Step 7: Write the middleware**

Create `web/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // The actual refresh: this call is what re-issues an expiring access
  // token using the refresh token, and writes the new pair back via
  // setAll above if the token had to be rotated.
  await supabase.auth.getUser();

  return response;
}
```

Create `web/middleware.ts`:

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 8: Run the test and confirm it passes**

Run: `npm run test --prefix web -- middleware.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 9: Commit**

```bash
git add web/package.json web/package-lock.json web/lib/supabase web/middleware.ts web/tests
git commit -m "feat: add Supabase SSR client helpers and session-refresh middleware"
```

Note: `web/.env.local` is gitignored and intentionally not part of this commit.

---

## Task 2: Sign up and email confirmation

**Files:**
- Create: `web/lib/auth/actions.ts`
- Create: `web/lib/auth/actions.test.ts`
- Create: `web/lib/auth/confirmation.test.ts`
- Create: `web/app/signup/page.tsx`
- Create: `web/app/signup/actions.ts`
- Create: `web/app/signup/page.test.tsx`
- Create: `web/app/verify-email/page.tsx`
- Create: `web/app/auth/callback/route.ts`
- Modify: `supabase/config.toml` (enable email confirmations, raise the local rate limit)

**Interfaces:**
- Consumes: `createClient()` (server), `pollMailpitFor`, `firstLinkIn`, `createTestHost` from Task 1
- Produces: `signUpHost(supabase, { email, password, name, emailRedirectTo }): Promise<{ error: string | null }>` — consumed by `web/app/signup/actions.ts` in this task and by nothing later

- [ ] **Step 1: Flip local auth config for a real confirmation-email test**

`supabase/config.toml` currently has confirmations disabled for fast local iteration (a decision from M1, before any auth flow existed to test). AUTH-05 needs a real email round trip, so this milestone needs them on.

In `supabase/config.toml`, under `[auth.email]`, change:

```toml
enable_confirmations = false
```

to:

```toml
enable_confirmations = true
```

And under `[auth.rate_limit]`, change:

```toml
email_sent = 2
```

to:

```toml
# Raised for local dev: M3's test suite sends multiple confirmation and
# password-reset emails per run. The production default (2/hour) is a
# real anti-abuse limit that should NOT be raised outside local config.
email_sent = 100
```

And under `[auth]`, change:

```toml
additional_redirect_urls = ["https://127.0.0.1:3000"]
```

to:

```toml
# The existing entry was both scheme-mismatched (https, while site_url is
# http) and an exact match with no wildcard, so GoTrue would reject
# emailRedirectTo/redirectTo values that include a path or query string —
# exactly what /auth/callback?next=... needs. The `**` wildcard allows any
# path under this origin.
additional_redirect_urls = ["http://127.0.0.1:3000/**"]
```

- [ ] **Step 2: Restart the stack to apply the config change**

Run: `npx supabase stop` then `npx supabase start`
Expected: both succeed; the printed status still shows the same ports/keys as before (config, not data, changed).

- [ ] **Step 3: Write the failing tests**

Create `web/lib/auth/actions.ts` with just enough to make the import resolve (the real implementation is Step 5):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function signUpHost(
  supabase: SupabaseClient,
  _args: { email: string; password: string; name: string; emailRedirectTo: string },
): Promise<{ error: string | null }> {
  throw new Error("not implemented");
}
```

Create `web/lib/auth/actions.test.ts`:

```ts
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
```

Add `supabaseAdmin` to `web/tests/helpers.ts` (append after `createTestHost`, before `pollMailpitFor`):

```ts
export function supabaseAdmin() {
  const { apiUrl, serviceRoleKey } = supabaseEnv();
  return createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Create `web/lib/auth/confirmation.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npm run test --prefix web -- lib/auth`
Expected: FAIL — `signUpHost` throws "not implemented".

- [ ] **Step 5: Implement `signUpHost`**

Replace the contents of `web/lib/auth/actions.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export async function signUpHost(
  supabase: SupabaseClient,
  { email, password, name, emailRedirectTo }: { email: string; password: string; name: string; emailRedirectTo: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo,
    },
  });
  return { error: error?.message ?? null };
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm run test --prefix web -- lib/auth`
Expected: PASS, 2 tests. The confirmation test genuinely waits for a real email — it may take a few seconds.

- [ ] **Step 7: Build the signup page and its Server Action wrapper**

Create `web/app/signup/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signUpHost } from "@/lib/auth/actions";

export async function signUpAction(_prevState: { error: string | null }, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
  const { error } = await signUpHost(supabase, {
    email,
    password,
    name,
    emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
  });

  if (error) return { error };
  redirect("/verify-email");
}
```

Create `web/app/signup/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signUpAction } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUpAction, { error: null });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Create your account</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            type="text"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </main>
  );
}
```

Create `web/app/signup/page.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SignupPage from "./page";

// @req AUTH-01
test("the signup page renders name, email and password fields", () => {
  render(<SignupPage />);
  expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
});
```

Create `web/app/verify-email/page.tsx`:

```tsx
export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-medium tracking-tight">Check your email</h1>
      <p className="text-muted">
        We sent you a confirmation link. Click it to finish creating your account.
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Build the callback route handler**

Create `web/app/auth/callback/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
```

This route handler is trusted glue (Global Constraints) — it is exercised by hand via `npm run dev`, not by an automated test, because `cookies()` (inside `createClient()`) only works when Next's own runtime is handling a real request.

- [ ] **Step 9: Run the full web test suite and confirm everything passes**

Run: `npm run test --prefix web`
Expected: PASS, no regressions on M1's existing tests.

- [ ] **Step 10: Commit**

```bash
git add web/lib/auth web/app/signup web/app/verify-email web/app/auth web/tests/helpers.ts supabase/config.toml
git commit -m "feat: add signup with email confirmation"
```

---

## Task 3: Log in and log out

**Files:**
- Modify: `web/lib/auth/actions.ts` (add `signInHost`, `signOutHost`)
- Modify: `web/lib/auth/actions.test.ts` (add two tests)
- Create: `web/app/login/page.tsx`
- Create: `web/app/login/actions.ts`
- Create: `web/app/login/page.test.tsx`

**Interfaces:**
- Consumes: `signUpHost` pattern from Task 2 (same file, same style)
- Produces: `signInHost(supabase, { email, password }): Promise<{ error: string | null }>`, `signOutHost(supabase): Promise<{ error: string | null }>` — `signOutHost` is consumed again in Task 8 (`/dashboard/settings/account`)

- [ ] **Step 1: Write the failing tests**

Add to `web/lib/auth/actions.test.ts` (new imports at top: add `signInHost, signOutHost` to the existing `signUpHost` import, and `createTestHost` to the existing helpers import):

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test --prefix web -- actions.test.ts`
Expected: FAIL — `signInHost`/`signOutHost` are not exported yet.

- [ ] **Step 3: Implement `signInHost` and `signOutHost`**

Add to `web/lib/auth/actions.ts` (after `signUpHost`):

```ts
export async function signInHost(
  supabase: SupabaseClient,
  { email, password }: { email: string; password: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signOutHost(supabase: SupabaseClient): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test --prefix web -- actions.test.ts`
Expected: PASS, 5 tests total (2 from Task 2, 3 new).

- [ ] **Step 5: Build the login page**

Create `web/app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signInHost } from "@/lib/auth/actions";

export async function loginAction(_prevState: { error: string | null }, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await signInHost(supabase, { email, password });

  if (error) return { error };
  redirect("/dashboard");
}
```

Create `web/app/login/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Log in</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
        <a href="/forgot-password" className="text-sm text-muted underline">
          Forgot password?
        </a>
      </form>
    </main>
  );
}
```

Create `web/app/login/page.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

// @req AUTH-02
test("the login page renders email and password fields", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run the full web test suite and confirm everything passes**

Run: `npm run test --prefix web`

- [ ] **Step 7: Commit**

```bash
git add web/lib/auth/actions.ts web/lib/auth/actions.test.ts web/app/login
git commit -m "feat: add login and logout"
```

---

## Task 4: Forgot password and reset password

**Files:**
- Modify: `web/lib/auth/actions.ts` (add `requestPasswordReset`, `updatePassword`)
- Modify: `web/lib/auth/actions.test.ts` (add two tests)
- Create: `web/app/forgot-password/page.tsx`
- Create: `web/app/forgot-password/actions.ts`
- Create: `web/app/reset-password/page.tsx`
- Create: `web/app/reset-password/actions.ts`

**Interfaces:**
- Consumes: `pollMailpitFor` from Task 1, `createTestHost` from Task 1
- Produces: `requestPasswordReset(supabase, { email, redirectTo }): Promise<{ error: string | null }>`, `updatePassword(supabase, { password }): Promise<{ error: string | null }>` — `updatePassword` is consumed again in Task 8

- [ ] **Step 1: Write the failing tests**

Add to `web/lib/auth/actions.test.ts` (add `requestPasswordReset, updatePassword` to the imports, and `pollMailpitFor` to the helpers import):

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test --prefix web -- actions.test.ts`
Expected: FAIL — `requestPasswordReset`/`updatePassword` are not exported yet.

- [ ] **Step 3: Implement both functions**

Add to `web/lib/auth/actions.ts` (after `signOutHost`):

```ts
export async function requestPasswordReset(
  supabase: SupabaseClient,
  { email, redirectTo }: { email: string; redirectTo: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { error: error?.message ?? null };
}

export async function updatePassword(
  supabase: SupabaseClient,
  { password }: { password: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error?.message ?? null };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test --prefix web -- actions.test.ts`
Expected: PASS, 7 tests total.

- [ ] **Step 5: Build the two pages**

Create `web/app/forgot-password/actions.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { requestPasswordReset } from "@/lib/auth/actions";

export async function forgotPasswordAction(
  _prevState: { error: string | null; sent: boolean },
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

  const { error } = await requestPasswordReset(supabase, {
    email,
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error, sent: false };
  return { error: null, sent: true };
}
```

Create `web/app/forgot-password/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {
    error: null,
    sent: false,
  });

  if (state.sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-medium tracking-tight">Check your email</h1>
        <p className="text-muted">If that address has an account, a reset link is on its way.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Reset your password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </main>
  );
}
```

Create `web/app/reset-password/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/lib/auth/actions";

export async function resetPasswordAction(_prevState: { error: string | null }, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await updatePassword(supabase, { password });

  if (error) return { error };
  redirect("/dashboard");
}
```

Create `web/app/reset-password/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, { error: null });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Set a new password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </main>
  );
}
```

This page relies on the recovery session `/auth/callback` established via the emailed link — trusted glue, exercised by hand, same rationale as Task 2's callback handler.

- [ ] **Step 6: Run the full web test suite and confirm everything passes**

Run: `npm run test --prefix web`

- [ ] **Step 7: Commit**

```bash
git add web/lib/auth/actions.ts web/lib/auth/actions.test.ts web/app/forgot-password web/app/reset-password
git commit -m "feat: add forgot-password and reset-password"
```

---

## Task 5: Dashboard guard chain

**Files:**
- Create: `web/lib/auth/dashboard-access.ts`
- Create: `web/lib/auth/dashboard-access.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks — pure, synchronous, no I/O
- Produces: `resolveDashboardAccess({ user, organization }): "login" | "onboarding" | "allow"` — consumed by `web/app/dashboard/layout.tsx` in Task 7

- [ ] **Step 1: Write the failing tests**

Create `web/lib/auth/dashboard-access.test.ts`:

```ts
import { test, expect } from "vitest";
import { resolveDashboardAccess } from "./dashboard-access";

// @req AUTH-07
test("an unauthenticated visitor is sent to login", () => {
  expect(resolveDashboardAccess({ user: null, organization: null })).toBe("login");
});

// @req AUTH-08
test("a host without an organisation is sent to onboarding", () => {
  expect(resolveDashboardAccess({ user: { id: "u1" }, organization: null })).toBe("onboarding");
});

// @req AUTH-12
test("a host with an organisation is allowed onto the dashboard", () => {
  expect(
    resolveDashboardAccess({ user: { id: "u1" }, organization: { id: "org1" } }),
  ).toBe("allow");
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test --prefix web -- dashboard-access.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the resolver**

Create `web/lib/auth/dashboard-access.ts`:

```ts
export type DashboardAccess = "login" | "onboarding" | "allow";

// Pure decision, deliberately taking already-fetched data rather than
// fetching it itself — the fetching (a real Supabase call, needing
// cookies()) lives in dashboard/layout.tsx, which is trusted glue around
// this function. This split is what makes the guard chain testable at all.
export function resolveDashboardAccess({
  user,
  organization,
}: {
  user: { id: string } | null;
  organization: { id: string } | null;
}): DashboardAccess {
  if (!user) return "login";
  if (!organization) return "onboarding";
  return "allow";
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test --prefix web -- dashboard-access.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add web/lib/auth/dashboard-access.ts web/lib/auth/dashboard-access.test.ts
git commit -m "feat: add the dashboard access guard as a pure, testable decision"
```

---

## Task 6: Organisation onboarding

**Files:**
- Create: `supabase/migrations/20260923010000_organization_slug_lookup.sql`
- Create: `web/lib/organizations/actions.ts`
- Create: `web/lib/organizations/actions.test.ts`
- Create: `web/app/onboarding/page.tsx`
- Create: `web/app/onboarding/actions.ts`
- Create: `web/app/onboarding/page.test.tsx`

**Interfaces:**
- Consumes: `createTestHost` from Task 1
- Produces: `RESERVED_SLUGS`, `isValidSlugFormat(slug)`, `isReservedSlug(slug)`, `isSlugAvailable(supabase, slug)`, `createOrganization(supabase, { ownerId, name, slug, city, phone }): Promise<{ error: string | null; organizationId?: string }>` — nothing later in this plan consumes these, but M4 (properties) will read `organizations.profile` for the city/phone this task writes

**Why this task needs a migration:** the live slug-availability check (AUTH-10) must work for a host who does not yet own *any* organisation, checking a slug that might belong to someone else's. `organizations`' only RLS policy (from M2) is `owner_id = auth.uid()` — a host can never see another host's row, by design (that's SEC-02). A plain `select` for uniqueness-checking would therefore report every already-taken slug as "available" whenever the checking host isn't its owner. The fix is a single `security definer` function that reveals nothing except whether an exact slug string exists — not the row, not the owner, nothing else about the organisation — so it doesn't reopen the cross-org read M2's whole-branch review fixed.

- [ ] **Step 1: Write the failing tests**

Create `web/lib/organizations/actions.test.ts`:

```ts
import { test, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  RESERVED_SLUGS,
  isValidSlugFormat,
  isReservedSlug,
  isSlugAvailable,
  createOrganization,
} from "./actions";
import { supabaseEnv, createTestHost } from "../../tests/helpers";

test("isValidSlugFormat accepts lowercase letters, digits and hyphens", () => {
  expect(isValidSlugFormat("sunset-villas-lahore")).toBe(true);
  expect(isValidSlugFormat("ab")).toBe(false); // too short
  expect(isValidSlugFormat("Has-Capitals")).toBe(false);
  expect(isValidSlugFormat("trailing-")).toBe(false);
  expect(isValidSlugFormat("has spaces")).toBe(false);
});

// @req AUTH-11
test("every reserved word is rejected", () => {
  for (const word of RESERVED_SLUGS) {
    expect(isReservedSlug(word)).toBe(true);
  }
  expect(isReservedSlug("sunset-villas-lahore")).toBe(false);
});

// @req AUTH-09
// @req AUTH-12
test("onboarding creates an organisation with name, slug, city and phone", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const host = await createTestHost();
  try {
    const supabase = createClient(apiUrl, anonKey);
    await supabase.auth.signInWithPassword({ email: host.email, password: host.password });

    const slug = `sunset-villas-${crypto.randomUUID().slice(0, 8)}`;
    const { error, organizationId } = await createOrganization(supabase, {
      ownerId: host.userId,
      name: "Sunset Villas",
      slug,
      city: "Lahore",
      phone: "0300-1234567",
    });
    expect(error).toBeNull();
    expect(organizationId).toBeTruthy();

    const { data } = await supabase
      .from("organizations")
      .select("name, slug, profile")
      .eq("id", organizationId)
      .single();
    expect(data?.name).toBe("Sunset Villas");
    expect(data?.slug).toBe(slug);
    expect(data?.profile.city).toBe("Lahore");
    expect(data?.profile.phone).toBe("0300-1234567");
  } finally {
    await host.cleanup();
  }
});

// @req AUTH-10
test("the slug field rejects a slug already in use, even for a host who doesn't own it", async () => {
  const { apiUrl, anonKey } = supabaseEnv();
  const hostA = await createTestHost();
  const hostB = await createTestHost();
  try {
    const slug = `taken-slug-${crypto.randomUUID().slice(0, 8)}`;

    const supabaseA = createClient(apiUrl, anonKey);
    await supabaseA.auth.signInWithPassword({ email: hostA.email, password: hostA.password });
    const created = await createOrganization(supabaseA, {
      ownerId: hostA.userId,
      name: "Org A",
      slug,
      city: "Lahore",
      phone: "0300-0000000",
    });
    expect(created.error).toBeNull();

    // hostB owns no organisation at all and cannot see hostA's row under
    // RLS — this is exactly the case a plain `select` would get wrong.
    const supabaseB = createClient(apiUrl, anonKey);
    await supabaseB.auth.signInWithPassword({ email: hostB.email, password: hostB.password });
    const availableToB = await isSlugAvailable(supabaseB, slug);
    expect(availableToB).toBe(false);

    const { error } = await createOrganization(supabaseB, {
      ownerId: hostB.userId,
      name: "Org B",
      slug,
      city: "Karachi",
      phone: "0300-1111111",
    });
    expect(error).not.toBeNull();
  } finally {
    await hostA.cleanup();
    await hostB.cleanup();
  }
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test --prefix web -- organizations`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the slug-lookup migration**

Create `supabase/migrations/20260923010000_organization_slug_lookup.sql`:

```sql
-- isSlugAvailable() must work for a host who owns no organisation yet,
-- checking a slug that may belong to someone else's — organizations' only
-- RLS policy (owner_id = auth.uid(), from M2) hides every other host's row
-- by design. This function reveals nothing beyond "does this exact slug
-- exist" — not the row, not the owner — so it doesn't reopen a cross-org
-- read.
create function public.organization_slug_taken(check_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.organizations where slug = check_slug);
$$;

grant execute on function public.organization_slug_taken(text) to authenticated, anon;
```

Run: `npx supabase db reset`
Expected: applies cleanly on top of M2's migrations.

- [ ] **Step 4: Implement `web/lib/organizations/actions.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

// Every one of these collides with a real top-level route in this app (see
// docs/superpowers/specs/2026-09-20-phase-1-design.md §9's routing tables)
// or is a generic platform reservation. An org slug matching any of these
// would make /s/<slug> or a future subdomain ambiguous with a real route.
export const RESERVED_SLUGS = [
  "www", "api", "admin", "dashboard", "onboarding", "login", "signup",
  "logout", "verify-email", "forgot-password", "reset-password", "auth",
  "s", "c", "id", "pricing", "privacy", "terms", "contact",
  "static", "public", "assets", "app", "mail", "ftp", "blog",
  "help", "support", "status", "_next",
];

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugFormat(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && SLUG_PATTERN.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}

export async function isSlugAvailable(supabase: SupabaseClient, slug: string): Promise<boolean> {
  // A plain `select` against organizations is scoped by RLS to the
  // caller's own row (or nothing, for a host with no org yet) — this RPC
  // is the only way to check another host's slug without exposing their row.
  const { data, error } = await supabase.rpc("organization_slug_taken", { check_slug: slug });
  if (error) throw error;
  return data === false;
}

export async function createOrganization(
  supabase: SupabaseClient,
  { ownerId, name, slug, city, phone }: { ownerId: string; name: string; slug: string; city: string; phone: string },
): Promise<{ error: string | null; organizationId?: string }> {
  if (!isValidSlugFormat(slug)) {
    return { error: "Slug must be 3-40 lowercase letters, digits and hyphens." };
  }
  if (isReservedSlug(slug)) {
    return { error: "That slug is reserved. Please choose another." };
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({ owner_id: ownerId, name, slug, profile: { city, phone } })
    .select("id")
    .single();

  if (error) {
    // Postgres unique_violation on the slug column.
    if (error.code === "23505") return { error: "That slug is already taken." };
    return { error: error.message };
  }

  return { error: null, organizationId: data.id };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm run test --prefix web -- organizations`
Expected: PASS, 5 tests.

- [ ] **Step 6: Build the onboarding page**

Create `web/app/onboarding/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOrganization, isSlugAvailable } from "@/lib/organizations/actions";

export async function checkSlugAction(slug: string): Promise<{ available: boolean }> {
  const supabase = await createClient();
  const available = await isSlugAvailable(supabase, slug);
  return { available };
}

export async function onboardingAction(_prevState: { error: string | null }, formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const city = String(formData.get("city") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { error } = await createOrganization(supabase, {
    ownerId: userData.user.id,
    name,
    slug,
    city,
    phone,
  });

  if (error) return { error };
  redirect("/dashboard");
}
```

Create `web/app/onboarding/page.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { onboardingAction, checkSlugAction } from "./actions";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(onboardingAction, { error: null });
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  async function handleSlugBlur(event: React.FocusEvent<HTMLInputElement>) {
    const slug = event.target.value.trim();
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const { available } = await checkSlugAction(slug);
    setSlugStatus(available ? "available" : "taken");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Set up your business</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Business name
          <input
            name="name"
            type="text"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Public slug
          <input
            name="slug"
            type="text"
            required
            onBlur={handleSlugBlur}
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
          {slugStatus === "checking" && <span className="text-xs text-muted">Checking…</span>}
          {slugStatus === "available" && <span className="text-xs text-success">Available</span>}
          {slugStatus === "taken" && <span className="text-xs text-destructive">Already taken</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          City
          <input
            name="city"
            type="text"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input
            name="phone"
            type="tel"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
```

Create `web/app/onboarding/page.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OnboardingPage from "./page";

// @req AUTH-09
test("the onboarding page renders name, slug, city and phone fields", () => {
  render(<OnboardingPage />);
  expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/public slug/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
});
```

Note: the design spec's onboarding prose also mentions a "first property" step. `docs/requirements.md`'s AUTH-09 does not — it only requires org name/slug/city/phone, and the registry is the definition of complete. Property creation belongs to M4 (`PROP-01`), which doesn't exist yet; building property-creation UI here would be building M4 inside M3. This is a deliberate scope cut, not an oversight.

- [ ] **Step 7: Run the full web test suite and confirm everything passes**

Run: `npm run test --prefix web`

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260923010000_organization_slug_lookup.sql web/lib/organizations web/app/onboarding
git commit -m "feat: add organisation onboarding with slug validation"
```

---

## Task 7: Dashboard shell — guard chain wiring, responsive nav, home page

**Files:**
- Create: `web/app/dashboard/layout.tsx`
- Create: `web/app/dashboard/layout.test.tsx`
- Create: `web/app/dashboard/page.tsx`
- Create: `web/app/dashboard/page.test.tsx`

**Interfaces:**
- Consumes: `resolveDashboardAccess` from Task 5
- Produces: nothing new consumed later in this plan; M6 (`/dashboard/calendar`) and M9 (`/dashboard/inbox`) will later fill in the nav links this task creates but does not build pages for

- [ ] **Step 1: Write the failing layout test**

Create `web/app/dashboard/layout.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardNav } from "./layout";

// @req AUTH-14
test("dashboard nav renders both a desktop sidebar and a mobile bottom tab bar", () => {
  render(<DashboardNav />);

  const sidebar = screen.getByTestId("dashboard-sidebar");
  const tabBar = screen.getByTestId("dashboard-tabbar");

  expect(sidebar.className).toMatch(/hidden/);
  expect(sidebar.className).toMatch(/md:flex/);
  expect(tabBar.className).toMatch(/md:hidden/);

  for (const label of ["Home", "Inbox", "Calendar", "More"]) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test --prefix web -- dashboard/layout.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the layout, nav, and guard wiring**

Create `web/app/dashboard/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveDashboardAccess } from "@/lib/auth/dashboard-access";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/settings/account", label: "More" },
];

export function DashboardNav() {
  return (
    <>
      <nav
        data-testid="dashboard-sidebar"
        className="hidden md:flex md:w-56 md:flex-col md:gap-1 md:border-e md:border-hairline md:p-4"
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-card px-4 py-2 text-sm text-ink hover:bg-surface-muted"
          >
            {item.label}
          </a>
        ))}
      </nav>
      <nav
        data-testid="dashboard-tabbar"
        className="fixed inset-x-0 bottom-0 flex justify-around border-t border-hairline bg-surface py-2 md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex min-h-11 min-w-11 items-center justify-center px-3 text-xs text-ink"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  let organization: { id: string } | null = null;
  if (userData.user) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userData.user.id)
      .maybeSingle();
    organization = data;
  }

  const access = resolveDashboardAccess({ user: userData.user, organization });
  if (access === "login") redirect("/login");
  if (access === "onboarding") redirect("/onboarding");

  return (
    <div className="flex min-h-dvh">
      <DashboardNav />
      <main className="flex-1 p-6 pb-20 md:pb-6">{children}</main>
    </div>
  );
}
```

This layout is the trusted glue (Global Constraints) around Task 5's tested `resolveDashboardAccess` — it is exercised by hand (sign up, confirm, log in without onboarding, confirm the onboarding redirect; complete onboarding, confirm the dashboard renders) rather than by an automated test, because `createClient()` needs a real request's `cookies()`.

- [ ] **Step 4: Run the nav test and confirm it passes**

Run: `npm run test --prefix web -- dashboard/layout.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Write the failing dashboard home test**

Create `web/app/dashboard/page.test.tsx`:

```tsx
import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardHome from "./page";

// @req AUTH-13
test("the dashboard home lists the four sections it promises, empty by default", () => {
  render(
    <DashboardHome
      pendingBookings={[]}
      escalatedConversations={[]}
      unreadMessages={[]}
      todaysArrivalsAndDepartures={[]}
    />,
  );
  expect(screen.getByText(/nothing needs you right now/i)).toBeInTheDocument();
});
```

- [ ] **Step 6: Run the test and confirm it fails**

Run: `npm run test --prefix web -- dashboard/page.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Write the dashboard home page**

Create `web/app/dashboard/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

// Takes its four lists as props (rather than fetching them itself) so this
// component — the actual AUTH-13 requirement — is directly testable. The
// default export below is the thin, unfetched-from-props version Next.js
// renders; the fetching is one straightforward block, not business logic.
export function DashboardHome({
  pendingBookings,
  escalatedConversations,
  unreadMessages,
  todaysArrivalsAndDepartures,
}: {
  pendingBookings: Row[];
  escalatedConversations: Row[];
  unreadMessages: Row[];
  todaysArrivalsAndDepartures: Row[];
}) {
  const nothingToShow =
    pendingBookings.length === 0 &&
    escalatedConversations.length === 0 &&
    unreadMessages.length === 0 &&
    todaysArrivalsAndDepartures.length === 0;

  if (nothingToShow) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-muted">Nothing needs you right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
      {pendingBookings.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Waiting booking requests</h2>
          <p>{pendingBookings.length}</p>
        </section>
      )}
      {escalatedConversations.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Escalated chats</h2>
          <p>{escalatedConversations.length}</p>
        </section>
      )}
      {unreadMessages.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Unread messages</h2>
          <p>{unreadMessages.length}</p>
        </section>
      )}
      {todaysArrivalsAndDepartures.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted">Today&apos;s arrivals and departures</h2>
          <p>{todaysArrivalsAndDepartures.length}</p>
        </section>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_id", userData.user!.id)
    .single();

  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("organization_id", organization!.id);
  const propertyIds = properties?.map((p) => p.id) ?? [];

  // bookings/conversations/messages have no application-level producers
  // until M9-M10 — every list is genuinely empty in M3, not stubbed.
  const [{ data: pendingBookings }, { data: escalatedConversations }] = await Promise.all([
    supabase.from("bookings").select("id").eq("status", "requested").in("property_id", propertyIds),
    supabase.from("conversations").select("id").eq("escalated", true).in("property_id", propertyIds),
  ]);

  return (
    <DashboardHome
      pendingBookings={pendingBookings ?? []}
      escalatedConversations={escalatedConversations ?? []}
      unreadMessages={[]}
      todaysArrivalsAndDepartures={[]}
    />
  );
}
```

`unreadMessages` and `todaysArrivalsAndDepartures` are hardcoded empty arrays rather than queried: "unread" has no definition yet (no read-tracking column exists until M9's inbox), and "today's arrivals/departures" needs `bookings.status = 'staying'` semantics M10 hasn't built yet. Querying `bookings`/`conversations` for the two that already have a clear, real column-level meaning (`status = 'requested'`, `escalated = true`) and hardcoding the two that don't is more honest than querying tables for numbers construed to always be zero.

- [ ] **Step 8: Run the test and confirm it passes**

Run: `npm run test --prefix web -- dashboard/page.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 9: Run the full web test suite and confirm everything passes**

Run: `npm run test --prefix web`

- [ ] **Step 10: Commit**

```bash
git add web/app/dashboard/layout.tsx web/app/dashboard/layout.test.tsx web/app/dashboard/page.tsx web/app/dashboard/page.test.tsx
git commit -m "feat: add dashboard shell with guard chain, responsive nav, and home"
```

---

## Task 8: Account settings — email, password, log out

**Files:**
- Create: `web/app/dashboard/settings/account/page.tsx`
- Create: `web/app/dashboard/settings/account/actions.ts`

**Interfaces:**
- Consumes: `updatePassword`, `signOutHost` from Tasks 3–4
- Produces: nothing consumed later in this plan

- [ ] **Step 1: Write the page and its actions**

This route's substantive logic (`updatePassword`, `signOutHost`) is already tested in Task 3/4. This task only wires the page — no new pure function, so no new test file; it is exercised by hand like the other page-level glue in this plan.

Create `web/app/dashboard/settings/account/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword, signOutHost } from "@/lib/auth/actions";

export async function changePasswordAction(_prevState: { error: string | null; success: boolean }, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await updatePassword(supabase, { password });
  if (error) return { error, success: false };
  return { error: null, success: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await signOutHost(supabase);
  redirect("/login");
}
```

Create `web/app/dashboard/settings/account/page.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { changePasswordAction, logoutAction } from "./actions";

export default function AccountSettingsPage() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {
    error: null,
    success: false,
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium tracking-tight">Account</h1>

      <form action={formAction} className="flex max-w-sm flex-col gap-4">
        <h2 className="text-sm font-medium text-muted">Change password</h2>
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.success && <p className="text-sm text-success">Password updated.</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="secondary">
          Log out
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Run the full web test suite and confirm no regressions**

Run: `npm run test --prefix web`

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/settings
git commit -m "feat: add account settings page with password change and log out"
```

---

## Task 9: CI wiring and the milestone audit

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: everything from Tasks 1–8
- Produces: nothing further — this closes the milestone

- [ ] **Step 1: Add a step that writes `web/.env.local` in CI**

M2's CI already starts Supabase before "Test". This milestone's web tests additionally need `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, which only exist as a local, gitignored file today. Modify `.github/workflows/ci.yml`, inserting a new step immediately after "Start Supabase" and before "Lint":

```yaml
      - name: Write web env vars from the local Supabase stack
        shell: bash
        run: |
          STATUS=$(npx supabase status -o json)
          echo "NEXT_PUBLIC_SUPABASE_URL=$(echo "$STATUS" | jq -r .API_URL)" >> web/.env.local
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$STATUS" | jq -r .ANON_KEY)" >> web/.env.local
```

`jq` is preinstalled on `ubuntu-latest` runners.

- [ ] **Step 2: Update the audit milestone flag**

In the same file, change:

```yaml
      - name: Audit requirements
        run: npm run audit -- --milestone M2
```

to:

```yaml
      - name: Audit requirements
        run: npm run audit -- --milestone M3
```

- [ ] **Step 3: Confirm locally before pushing**

Run: `npm test`
Expected: PASS — includes every test from Tasks 1–8, plus all of M1/M2's existing tests, with zero regressions.

Run: `npm run audit -- --milestone M3`
Expected: all of AUTH-01 through AUTH-14 show as covered. Output ends with `Audit passed.`

Run: `git diff docs/TRACKER.md`
Expected: matches what the audit command just wrote.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml docs/TRACKER.md
git commit -m "feat: wire web auth tests into CI and close M3 audit"
```

- [ ] **Step 5: Push and confirm CI is green**

Run: `git push`
Expected: CI writes `web/.env.local` from the fresh stack, runs every test including the real Mailpit round trip, passes the M3 audit, and goes green.

---

## Milestone exit audit

M3 is not closed until every line below is true, with output pasted:

- [ ] `npm test` — green, output pasted, including every `web/**` auth/onboarding test
- [ ] `npm run audit -- --milestone M3` — passes, no untested M3 requirement
- [ ] `docs/TRACKER.md` is committed and matches what the auditor generates
- [ ] CI is green on `main`
- [ ] Manually walk the full flow in a browser (`npm run dev`): sign up, find the confirmation email in Mailpit's web UI (the `MAILPIT_URL` printed by `npx supabase status`), click it, land signed in; get redirected to `/onboarding` (no org yet); complete onboarding with a slug, land on `/dashboard`; log out; log back in and confirm you land on `/dashboard` directly, not onboarding again
- [ ] Manually confirm the reserved-slug and taken-slug rejections show a real error message in the onboarding form, not just in tests
- [ ] No `TODO` or stub remains in any file created by this milestone
