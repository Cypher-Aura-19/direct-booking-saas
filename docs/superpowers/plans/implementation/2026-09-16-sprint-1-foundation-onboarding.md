# Sprint 1: Foundation & Host Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host can sign up, log in, create their organization, add a property with its full knowledge base, and see it in a dashboard — end to end, on top of the already-implemented Phase 1 database schema.

**Architecture:** A Next.js 15 (App Router, TypeScript) app in `web/`, talking to the existing local Supabase project in `supabase/`. Business logic lives in a plain-function data-access layer (`web/lib/*.ts`) that takes a Supabase client and returns/throws normally — this is what gets unit/integration tested directly against the real local database. Next.js Server Actions in `app/**/actions.ts` are thin wrappers around that layer, so the framework glue is never what's under test. Auth uses `@supabase/ssr` for cookie-based sessions shared between Server Components, Server Actions, and middleware.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, `@supabase/ssr` + `@supabase/supabase-js`, Vitest for testing, npm.

## Global Constraints

- The app lives in `web/`, not the repo root — `supabase/` (already built) stays a sibling directory.
- All data access for authenticated host actions goes through `web/lib/*.ts` functions that accept an already-constructed Supabase client (never construct a client inside a lib function) — this is what makes them testable with both a real user session and a service-role client.
- RLS (already implemented in Sprint 0) is the authorization mechanism. App code never re-implements "does this user own this org/property" checks — it queries as the authenticated user and lets Postgres enforce it. Tests in this plan exist partly to prove that's actually true.
- Tests run against the **real local Supabase instance** (already running via `supabase start` on the custom ports from Sprint 0 — API on `54421`, DB on `54422`), using real signed-up users, not mocks — consistent with how the schema itself was tested.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the `supabase start` output, stored in `web/.env.local` (gitignored) and `web/.env.test.local` for the test runner.
- Full browser end-to-end testing (Playwright) is explicitly **out of scope for Sprint 1** — deferred to Sprint 5 hardening. This sprint's automated tests cover the data-access layer; the UI is verified manually via the end-of-sprint demo.
- Deploying to a live Vercel URL requires your own Vercel account login, which this plan cannot do for you — Task 8 prepares configuration only; running `vercel login`/`vercel deploy` is a manual step for you to do.

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create: `web/` (entire Next.js project via `create-next-app`)
- Create: `web/vitest.config.ts`
- Modify: root `.gitignore` (add `web/node_modules`, `web/.next`, `web/.env*.local`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a running Next.js dev server and a working `npm test` command. Every later task's `npm run dev`/`npm test` commands run from `web/`.

- [ ] **Step 1: Scaffold the app**

```bash
cd "C:\Users\HP\Desktop\open source projects\airbnb like system"
npx create-next-app@latest web --typescript --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install Supabase and test dependencies**

```bash
cd web
npm install @supabase/ssr @supabase/supabase-js
npm install -D vitest dotenv
```

- [ ] **Step 3: Configure Vitest**

```typescript
// web/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

```typescript
// web/vitest.setup.ts
import { config } from 'dotenv'
config({ path: '.env.test.local' })
```

- [ ] **Step 4: Add the test script and verify the toolchain**

Edit `web/package.json` `scripts` to add:

```json
"test": "vitest run"
```

Run:

```bash
npm run build
npm test
```

Expected: `npm run build` succeeds (default Next.js starter page). `npm test` reports "No test files found" (exit code 1 is expected here since there are no tests yet — this just confirms Vitest itself runs).

- [ ] **Step 5: Update .gitignore and commit**

```bash
cd "C:\Users\HP\Desktop\open source projects\airbnb like system"
```

Add to the root `.gitignore` (create it if it doesn't already exist from `create-next-app`, which generates one inside `web/` — keep that one and don't duplicate at root):

```bash
git add web
git status --short
```

Confirm `web/node_modules`, `web/.next`, and `web/.env*.local` are **not** listed (they should already be excluded by the `.gitignore` that `create-next-app` generated inside `web/`).

```bash
git commit -m "$(cat <<'EOF'
chore: scaffold Next.js app in web/

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Supabase client setup and connectivity test

**Files:**
- Create: `web/lib/supabase/server.ts`
- Create: `web/lib/supabase/client.ts`
- Create: `web/lib/supabase/service-role.ts`
- Create: `web/.env.local`, `web/.env.test.local`
- Test: `web/lib/supabase/service-role.test.ts`

**Interfaces:**
- Consumes: the local Supabase instance from Sprint 0 (must be running via `supabase start`)
- Produces: `createServerSupabaseClient()`, `createBrowserSupabaseClient()`, `createServiceRoleSupabaseClient()`. Tasks 3–7 use the server and service-role clients; the browser client isn't needed until client-side interactivity arrives in a later sprint (e.g. the Sprint 3 chat widget), but is scaffolded now alongside its siblings.

- [ ] **Step 1: Write the failing test**

```typescript
// web/lib/supabase/service-role.test.ts
import { describe, it, expect } from 'vitest'
import { createServiceRoleSupabaseClient } from './service-role'

describe('createServiceRoleSupabaseClient', () => {
  it('can connect to the local Supabase instance and query organizations', async () => {
    const supabase = createServiceRoleSupabaseClient()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web
npm test
```

Expected: FAIL — `Cannot find module './service-role'`.

- [ ] **Step 3: Create the env files**

Get the current local Supabase keys (from Sprint 0's `supabase start` output, or re-print them):

```bash
cd "C:\Users\HP\Desktop\open source projects\airbnb like system"
npx -y supabase status -o env
```

Using that output, create both files with matching values:

```bash
# web/.env.local and web/.env.test.local (same content)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>
```

- [ ] **Step 4: Write the three client factories**

```typescript
// web/lib/supabase/service-role.ts
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

```typescript
// web/lib/supabase/client.ts
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// web/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component that can't set cookies — the
            // middleware in Task 3 refreshes the session instead, so this is safe to ignore.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS. If it fails with a connection error, confirm `supabase start` is running (`npx supabase status` from the repo root).

- [ ] **Step 6: Commit**

```bash
git add web/lib/supabase web/.gitignore
git commit -m "$(cat <<'EOF'
feat(web): add Supabase client factories for server, browser, and service-role contexts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(`.env.local` and `.env.test.local` are gitignored by the `create-next-app` default — do not force-add them.)

---

### Task 3: Auth — signup, login, logout, session middleware

**Files:**
- Create: `web/middleware.ts`
- Create: `web/lib/supabase/middleware.ts`
- Create: `web/app/login/page.tsx`
- Create: `web/app/signup/page.tsx`
- Create: `web/app/login/actions.ts`
- Test: `web/lib/supabase/test-helpers.ts`
- Test: `web/app/login/actions.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient`, `createServiceRoleSupabaseClient` (Task 2)
- Produces: `signUpAction(formData)`, `signInAction(formData)`, `signOutAction()` in `web/app/login/actions.ts`, and a `createTestUser()` helper in `web/lib/supabase/test-helpers.ts` that every later test needing an authenticated user reuses. Session cookies are refreshed on every request via `middleware.ts`.

- [ ] **Step 1: Write the test helper for creating authenticated test users**

```typescript
// web/lib/supabase/test-helpers.ts
import { createClient } from '@supabase/supabase-js'
import { createServiceRoleSupabaseClient } from './service-role'

let counter = 0

export async function createTestUser() {
  counter += 1
  const email = `test-user-${Date.now()}-${counter}@example.com`
  const password = 'test-password-123'

  const admin = createServiceRoleSupabaseClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw error ?? new Error('failed to create test user')

  const signedInClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: session, error: signInError } = await signedInClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signInError || !session.session) throw signInError ?? new Error('failed to sign in test user')

  return { userId: data.user.id, client: signedInClient, email }
}

export async function deleteTestUser(userId: string) {
  const admin = createServiceRoleSupabaseClient()
  await admin.auth.admin.deleteUser(userId)
}
```

- [ ] **Step 2: Write the failing test for the auth actions' underlying behavior**

```typescript
// web/app/login/actions.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/service-role'
import { createTestUser, deleteTestUser } from '@/lib/supabase/test-helpers'

describe('auth', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = null
  })

  it('a created user can sign in and gets a valid session', async () => {
    const user = await createTestUser()
    userId = user.userId

    const { data, error } = await user.client.auth.getUser()
    expect(error).toBeNull()
    expect(data.user?.id).toBe(user.userId)
  })

  it('an unconfirmed random credential cannot sign in', async () => {
    const admin = createServiceRoleSupabaseClient()
    const { error } = await admin.auth.signInWithPassword({
      email: 'nobody@example.com',
      password: 'wrong-password',
    })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/supabase/test-helpers'` (the module doesn't exist as a resolvable path yet until Step 1's file is saved — if it's already saved this step should actually pass since nothing in it depends on unwritten code; verify by temporarily confirming, then proceed. The meaningful new-code check is Step 5 below, for the actions themselves.)

- [ ] **Step 4: Write the middleware session-refresh helper**

```typescript
// web/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}
```

```typescript
// web/middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 5: Write the auth actions and pages**

```typescript
// web/app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function signUpAction(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signUp({ email, password })
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`)

  redirect('/dashboard/onboarding')
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`)

  redirect('/dashboard')
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

```tsx
// web/app/signup/page.tsx
import { signUpAction } from '@/app/login/actions'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">Create your host account</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form action={signUpAction} className="space-y-4">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white">
          Sign up
        </button>
      </form>
    </main>
  )
}
```

```tsx
// web/app/login/page.tsx
import { signInAction } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form action={signInAction} className="space-y-4">
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white">
          Log in
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS (2/2 in the new `auth` describe block).

- [ ] **Step 7: Manually verify in the browser**

```bash
npm run dev
```

Visit `http://localhost:3000/signup`, create an account, confirm it redirects to `/dashboard/onboarding` (a 404 is expected right now — that page is built in Task 4 — the redirect itself succeeding is what this step confirms).

- [ ] **Step 8: Commit**

```bash
git add web/middleware.ts web/lib/supabase/middleware.ts web/lib/supabase/test-helpers.ts web/app/login web/app/signup
git commit -m "$(cat <<'EOF'
feat(web): add auth signup/login/logout and session-refresh middleware

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Organization creation (onboarding)

**Files:**
- Create: `web/lib/organizations.ts`
- Create: `web/app/dashboard/onboarding/page.tsx`
- Create: `web/app/dashboard/onboarding/actions.ts`
- Test: `web/lib/organizations.test.ts`

**Interfaces:**
- Consumes: `createTestUser`/`deleteTestUser` (Task 3), a Supabase client (Task 2)
- Produces: `createOrganization(supabase, input)` and `getOrganizationForUser(supabase, userId)` in `web/lib/organizations.ts`. Task 5 (dashboard shell) and Task 6 (properties) both call `getOrganizationForUser`.

- [ ] **Step 1: Write the failing test**

```typescript
// web/lib/organizations.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from './supabase/test-helpers'
import { createOrganization, getOrganizationForUser } from './organizations'

describe('organizations', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = null
  })

  it('creates an organization owned by the current user', async () => {
    const user = await createTestUser()
    userId = user.userId

    const org = await createOrganization(user.client, {
      name: 'Hunza View Guesthouse',
      slug: `hunza-view-${user.userId.slice(0, 8)}`,
      contactPhone: '03001234567',
      contactName: 'Ali Khan',
    })

    expect(org.owner_user_id).toBe(user.userId)
    expect(org.name).toBe('Hunza View Guesthouse')
  })

  it('getOrganizationForUser returns null when the user has no organization yet', async () => {
    const user = await createTestUser()
    userId = user.userId

    const org = await getOrganizationForUser(user.client, user.userId)
    expect(org).toBeNull()
  })

  it('getOrganizationForUser returns the organization once one exists', async () => {
    const user = await createTestUser()
    userId = user.userId

    await createOrganization(user.client, {
      name: 'Naran Cabins',
      slug: `naran-cabins-${user.userId.slice(0, 8)}`,
      contactPhone: '03009999999',
      contactName: 'Sara Ahmed',
    })

    const org = await getOrganizationForUser(user.client, user.userId)
    expect(org?.name).toBe('Naran Cabins')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web
npm test
```

Expected: FAIL — `Cannot find module './organizations'`.

- [ ] **Step 3: Write the data-access functions**

```typescript
// web/lib/organizations.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Organization = {
  id: string
  owner_user_id: string
  name: string
  slug: string
  contact_phone: string
  contact_name: string
  contact_photo_url: string | null
  bio: string | null
  created_at: string
}

export async function createOrganization(
  supabase: SupabaseClient,
  input: { name: string; slug: string; contactPhone: string; contactName: string }
): Promise<Organization> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw userError ?? new Error('not authenticated')

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      owner_user_id: userData.user.id,
      name: input.name,
      slug: input.slug,
      contact_phone: input.contactPhone,
      contact_name: input.contactName,
    })
    .select()
    .single()

  if (error) throw error
  return data as Organization
}

export async function getOrganizationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select()
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as Organization | null
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS (3/3 in the new `organizations` describe block).

- [ ] **Step 5: Build the onboarding page and action**

```typescript
// web/app/dashboard/onboarding/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createOrganization } from '@/lib/organizations'

export async function createOrganizationAction(formData: FormData) {
  const supabase = await createServerSupabaseClient()

  try {
    await createOrganization(supabase, {
      name: String(formData.get('name')),
      slug: String(formData.get('slug')),
      contactPhone: String(formData.get('contactPhone')),
      contactName: String(formData.get('contactName')),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create organization'
    redirect(`/dashboard/onboarding?error=${encodeURIComponent(message)}`)
  }

  redirect('/dashboard')
}
```

```tsx
// web/app/dashboard/onboarding/page.tsx
import { createOrganizationAction } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Set up your organization</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form action={createOrganizationAction} className="space-y-4">
        <input
          name="name"
          required
          placeholder="Business name, e.g. Hunza View Guesthouse"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="slug"
          required
          pattern="[a-z0-9-]+"
          placeholder="URL slug, e.g. hunza-view"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="contactName"
          required
          placeholder="Your name"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="contactPhone"
          required
          placeholder="Your phone number"
          className="w-full rounded border px-3 py-2"
        />
        <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white">
          Continue
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/organizations.ts web/lib/organizations.test.ts web/app/dashboard/onboarding
git commit -m "$(cat <<'EOF'
feat(web): add organization creation (host onboarding)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Dashboard shell with organization guard

**Files:**
- Create: `web/app/dashboard/layout.tsx`
- Create: `web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getOrganizationForUser` (Task 4)
- Produces: a `/dashboard` route that redirects to `/login` if unauthenticated and to `/dashboard/onboarding` if authenticated but orgless. Task 6/7's property pages nest under this layout and can assume an organization exists.

- [ ] **Step 1: Write the dashboard layout guard**

```tsx
// web/app/dashboard/layout.tsx
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrganizationForUser } from '@/lib/organizations'
import { signOutAction } from '@/app/login/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) redirect('/login')

  const org = await getOrganizationForUser(supabase, userData.user.id)

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">{org?.name ?? 'Host Dashboard'}</span>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-gray-600">
            Log out
          </button>
        </form>
      </header>
      <div className="p-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Write the dashboard landing page**

```tsx
// web/app/dashboard/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrganizationForUser } from '@/lib/organizations'
import { listPropertiesForOrganization } from '@/lib/properties'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const org = await getOrganizationForUser(supabase, userData.user.id)
  if (!org) redirect('/dashboard/onboarding')

  const properties = await listPropertiesForOrganization(supabase, org.id)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Properties</h1>
        <Link href="/dashboard/properties/new" className="rounded bg-black px-4 py-2 text-white">
          New property
        </Link>
      </div>
      {properties.length === 0 ? (
        <p className="text-gray-600">No properties yet.</p>
      ) : (
        <ul className="space-y-2">
          {properties.map((p) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/properties/${p.id}`}
                className="flex items-center justify-between rounded border px-4 py-3 hover:bg-gray-50"
              >
                <span>{p.name}</span>
                <span className="text-sm text-gray-500">{p.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

This task has no new automated test of its own — `listPropertiesForOrganization` (used above) is written and tested in Task 6, and this page is a thin composition of already-tested functions. Verification is manual (Step 3) plus the RLS-focused test added in Task 7.

- [ ] **Step 3: Manually verify the guard chain**

```bash
npm run dev
```

- Visit `/dashboard` logged out → redirected to `/login`.
- Log in as a user with no organization → redirected to `/dashboard/onboarding`.
- Complete onboarding → lands on `/dashboard` showing "No properties yet."

- [ ] **Step 4: Commit**

```bash
git add web/app/dashboard/layout.tsx web/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): add dashboard shell with auth/onboarding guard chain

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Property creation (the knowledge-base form)

**Files:**
- Create: `web/lib/properties.ts`
- Create: `web/app/dashboard/properties/new/page.tsx`
- Create: `web/app/dashboard/properties/new/actions.ts`
- Test: `web/lib/properties.test.ts`

**Interfaces:**
- Consumes: `createOrganization` (Task 4, for test fixtures), a Supabase client (Task 2)
- Produces: `createProperty`, `listPropertiesForOrganization`, `getProperty`, `updateProperty` in `web/lib/properties.ts`. `listPropertiesForOrganization` is already consumed by Task 5's dashboard page; `updateProperty`/`getProperty` are consumed by Task 7.

- [ ] **Step 1: Write the failing test**

```typescript
// web/lib/properties.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from './supabase/test-helpers'
import { createOrganization } from './organizations'
import { createProperty, listPropertiesForOrganization, getProperty, updateProperty } from './properties'

describe('properties', () => {
  let userId: string | null = null

  afterEach(async () => {
    if (userId) await deleteTestUser(userId)
    userId = null
  })

  it('creates a property scoped to the caller\'s organization with expected defaults', async () => {
    const user = await createTestUser()
    userId = user.userId
    const org = await createOrganization(user.client, {
      name: 'Hunza View Guesthouse',
      slug: `hunza-view-${user.userId.slice(0, 8)}`,
      contactPhone: '03001234567',
      contactName: 'Ali Khan',
    })

    const property = await createProperty(user.client, {
      organizationId: org.id,
      name: 'Deluxe Cabin',
      slug: 'deluxe-cabin',
      maxGuests: 4,
      nightlyRatePkr: 8000,
    })

    expect(property.organization_id).toBe(org.id)
    expect(property.status).toBe('draft')
    expect(property.airbnb_verified).toBe(false)
    expect(property.minimum_nights).toBe(1)
  })

  it('lists only properties belonging to the given organization', async () => {
    const user = await createTestUser()
    userId = user.userId
    const org = await createOrganization(user.client, {
      name: 'Naran Cabins',
      slug: `naran-cabins-${user.userId.slice(0, 8)}`,
      contactPhone: '03009999999',
      contactName: 'Sara Ahmed',
    })
    await createProperty(user.client, {
      organizationId: org.id,
      name: 'Garden Room',
      slug: 'garden-room',
      maxGuests: 2,
      nightlyRatePkr: 5000,
    })

    const properties = await listPropertiesForOrganization(user.client, org.id)
    expect(properties).toHaveLength(1)
    expect(properties[0].name).toBe('Garden Room')
  })

  it('updateProperty modifies the row and getProperty reflects the change', async () => {
    const user = await createTestUser()
    userId = user.userId
    const org = await createOrganization(user.client, {
      name: 'Skardu Stays',
      slug: `skardu-stays-${user.userId.slice(0, 8)}`,
      contactPhone: '03005555555',
      contactName: 'Bilal Raza',
    })
    const property = await createProperty(user.client, {
      organizationId: org.id,
      name: 'Lake View Room',
      slug: 'lake-view-room',
      maxGuests: 2,
      nightlyRatePkr: 6000,
    })

    await updateProperty(user.client, property.id, { wifiPassword: 'skardu-guest-2026' })

    const updated = await getProperty(user.client, property.id)
    expect(updated?.wifi_password).toBe('skardu-guest-2026')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './properties'`.

- [ ] **Step 3: Write the data-access functions**

```typescript
// web/lib/properties.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Property = {
  id: string
  organization_id: string
  name: string
  slug: string
  description: string | null
  address: string | null
  city: string | null
  max_guests: number
  nightly_rate_pkr: number
  minimum_nights: number
  status: 'draft' | 'published'
  wifi_network: string | null
  wifi_password: string | null
  gate_code: string | null
  generator_instructions: string | null
  geyser_instructions: string | null
  ac_instructions: string | null
  parking_instructions: string | null
  checkin_time: string | null
  checkout_time: string | null
  directions: string | null
  nearby_recommendations: string | null
  house_rules: string | null
  additional_notes: string | null
  airbnb_listing_url: string | null
  airbnb_verification_code: string | null
  airbnb_verified: boolean
  airbnb_verified_at: string | null
  created_at: string
}

export type CreatePropertyInput = {
  organizationId: string
  name: string
  slug: string
  maxGuests: number
  nightlyRatePkr: number
  description?: string
  address?: string
  city?: string
}

export async function createProperty(
  supabase: SupabaseClient,
  input: CreatePropertyInput
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .insert({
      organization_id: input.organizationId,
      name: input.name,
      slug: input.slug,
      max_guests: input.maxGuests,
      nightly_rate_pkr: input.nightlyRatePkr,
      description: input.description,
      address: input.address,
      city: input.city,
    })
    .select()
    .single()

  if (error) throw error
  return data as Property
}

export async function listPropertiesForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select()
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Property[]
}

export async function getProperty(
  supabase: SupabaseClient,
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select()
    .eq('id', propertyId)
    .maybeSingle()

  if (error) throw error
  return data as Property | null
}

export type UpdatePropertyInput = Partial<{
  name: string
  description: string
  address: string
  city: string
  maxGuests: number
  nightlyRatePkr: number
  minimumNights: number
  status: 'draft' | 'published'
  wifiNetwork: string
  wifiPassword: string
  gateCode: string
  generatorInstructions: string
  geyserInstructions: string
  acInstructions: string
  parkingInstructions: string
  checkinTime: string
  checkoutTime: string
  directions: string
  nearbyRecommendations: string
  houseRules: string
  additionalNotes: string
  airbnbListingUrl: string
}>

const UPDATE_COLUMN_MAP: Record<keyof UpdatePropertyInput, string> = {
  name: 'name',
  description: 'description',
  address: 'address',
  city: 'city',
  maxGuests: 'max_guests',
  nightlyRatePkr: 'nightly_rate_pkr',
  minimumNights: 'minimum_nights',
  status: 'status',
  wifiNetwork: 'wifi_network',
  wifiPassword: 'wifi_password',
  gateCode: 'gate_code',
  generatorInstructions: 'generator_instructions',
  geyserInstructions: 'geyser_instructions',
  acInstructions: 'ac_instructions',
  parkingInstructions: 'parking_instructions',
  checkinTime: 'checkin_time',
  checkoutTime: 'checkout_time',
  directions: 'directions',
  nearbyRecommendations: 'nearby_recommendations',
  houseRules: 'house_rules',
  additionalNotes: 'additional_notes',
  airbnbListingUrl: 'airbnb_listing_url',
}

export async function updateProperty(
  supabase: SupabaseClient,
  propertyId: string,
  input: UpdatePropertyInput
): Promise<Property> {
  const columns: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    columns[UPDATE_COLUMN_MAP[key as keyof UpdatePropertyInput]] = value
  }

  const { data, error } = await supabase
    .from('properties')
    .update(columns)
    .eq('id', propertyId)
    .select()
    .single()

  if (error) throw error
  return data as Property
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test
```

Expected: PASS (3/3 in the new `properties` describe block).

- [ ] **Step 5: Build the "new property" form and action**

```typescript
// web/app/dashboard/properties/new/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrganizationForUser } from '@/lib/organizations'
import { createProperty } from '@/lib/properties'

export async function createPropertyAction(formData: FormData) {
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) redirect('/login')

  const org = await getOrganizationForUser(supabase, userData.user.id)
  if (!org) redirect('/dashboard/onboarding')

  let property
  try {
    property = await createProperty(supabase, {
      organizationId: org.id,
      name: String(formData.get('name')),
      slug: String(formData.get('slug')),
      maxGuests: Number(formData.get('maxGuests')),
      nightlyRatePkr: Number(formData.get('nightlyRatePkr')),
      description: String(formData.get('description') ?? ''),
      address: String(formData.get('address') ?? ''),
      city: String(formData.get('city') ?? ''),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create property'
    redirect(`/dashboard/properties/new?error=${encodeURIComponent(message)}`)
  }

  redirect(`/dashboard/properties/${property.id}`)
}
```

```tsx
// web/app/dashboard/properties/new/page.tsx
import { createPropertyAction } from './actions'

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">New property</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <form action={createPropertyAction} className="space-y-4">
        <input name="name" required placeholder="Property name" className="w-full rounded border px-3 py-2" />
        <input name="slug" required pattern="[a-z0-9-]+" placeholder="URL slug" className="w-full rounded border px-3 py-2" />
        <textarea name="description" placeholder="Description" className="w-full rounded border px-3 py-2" />
        <input name="address" placeholder="Address" className="w-full rounded border px-3 py-2" />
        <input name="city" placeholder="City" className="w-full rounded border px-3 py-2" />
        <div className="flex gap-4">
          <input
            name="maxGuests"
            type="number"
            required
            min={1}
            placeholder="Max guests"
            className="w-full rounded border px-3 py-2"
          />
          <input
            name="nightlyRatePkr"
            type="number"
            required
            min={0}
            placeholder="Nightly rate (PKR)"
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white">
          Create property
        </button>
      </form>
    </main>
  )
}
```

Note: this form intentionally covers only the fields needed to create a valid row (matching the `properties` table's `not null` columns plus a few common optional ones). The full knowledge-base field set (wifi, gate code, generator instructions, etc.) is edited on the property detail page built in Task 7, via `updateProperty` — splitting "create" from "fill in the knowledge base" keeps this form short enough for a host to actually complete in one sitting.

- [ ] **Step 6: Commit**

```bash
git add web/lib/properties.ts web/lib/properties.test.ts web/app/dashboard/properties/new
git commit -m "$(cat <<'EOF'
feat(web): add property creation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Property detail/edit page and cross-tenant RLS regression test

**Files:**
- Create: `web/app/dashboard/properties/[id]/page.tsx`
- Create: `web/app/dashboard/properties/[id]/actions.ts`
- Test: `web/lib/properties.rls.test.ts`

**Interfaces:**
- Consumes: `getProperty`, `updateProperty` (Task 6)
- Produces: a page where a host edits every knowledge-base field of one of their own properties, and an automated proof that RLS (built in Sprint 0) actually blocks a different host from reading or editing it through this app's own code path — not just at the raw database level.

- [ ] **Step 1: Write the failing cross-tenant test**

```typescript
// web/lib/properties.rls.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { createTestUser, deleteTestUser } from './supabase/test-helpers'
import { createOrganization } from './organizations'
import { createProperty, getProperty, updateProperty } from './properties'

describe('properties RLS', () => {
  let hostAId: string | null = null
  let hostBId: string | null = null

  afterEach(async () => {
    if (hostAId) await deleteTestUser(hostAId)
    if (hostBId) await deleteTestUser(hostBId)
    hostAId = null
    hostBId = null
  })

  it('a second host cannot read or update the first host\'s property', async () => {
    const hostA = await createTestUser()
    hostAId = hostA.userId
    const orgA = await createOrganization(hostA.client, {
      name: 'Hunza View Guesthouse',
      slug: `hunza-view-${hostA.userId.slice(0, 8)}`,
      contactPhone: '03001234567',
      contactName: 'Ali Khan',
    })
    const property = await createProperty(hostA.client, {
      organizationId: orgA.id,
      name: 'Deluxe Cabin',
      slug: 'deluxe-cabin',
      maxGuests: 4,
      nightlyRatePkr: 8000,
    })

    const hostB = await createTestUser()
    hostBId = hostB.userId

    const seenByHostB = await getProperty(hostB.client, property.id)
    expect(seenByHostB).toBeNull()

    await expect(
      updateProperty(hostB.client, property.id, { wifiPassword: 'hacked' })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it currently passes (this is a regression test, not new behavior)**

```bash
npm test
```

Expected: PASS already — this test exercises RLS policies from Sprint 0, which are already correct. It's written here specifically to catch any future regression introduced by app-layer code (e.g., someone accidentally routing a read through the service-role client and bypassing RLS). If it fails, stop and investigate before continuing — it means either the RLS policy or the data-access function has a real bug.

- [ ] **Step 3: Build the property detail/edit page and action**

```typescript
// web/app/dashboard/properties/[id]/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { updateProperty, type UpdatePropertyInput } from '@/lib/properties'

export async function updatePropertyAction(propertyId: string, formData: FormData) {
  const supabase = await createServerSupabaseClient()

  const fields = [
    'name', 'description', 'address', 'city',
    'wifiNetwork', 'wifiPassword', 'gateCode', 'generatorInstructions',
    'geyserInstructions', 'acInstructions', 'parkingInstructions',
    'checkinTime', 'checkoutTime', 'directions', 'nearbyRecommendations',
    'houseRules', 'additionalNotes', 'airbnbListingUrl',
  ] as const satisfies readonly (keyof UpdatePropertyInput)[]

  const input: UpdatePropertyInput = {}
  for (const field of fields) {
    const value = formData.get(field)
    if (value !== null) input[field] = String(value)
  }

  try {
    await updateProperty(supabase, propertyId, input)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update property'
    redirect(`/dashboard/properties/${propertyId}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(`/dashboard/properties/${propertyId}`)
  redirect(`/dashboard/properties/${propertyId}?saved=true`)
}
```

```tsx
// web/app/dashboard/properties/[id]/page.tsx
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getProperty } from '@/lib/properties'
import { updatePropertyAction } from './actions'

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const { id } = await params
  const { error, saved } = await searchParams
  const supabase = await createServerSupabaseClient()
  const property = await getProperty(supabase, id)

  if (!property) notFound()

  const updateWithId = updatePropertyAction.bind(null, property.id)

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">{property.name}</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {saved && <p className="mb-4 text-sm text-green-600">Saved.</p>}
      <form action={updateWithId} className="space-y-4">
        <input name="name" defaultValue={property.name} className="w-full rounded border px-3 py-2" />
        <textarea name="description" defaultValue={property.description ?? ''} placeholder="Description" className="w-full rounded border px-3 py-2" />
        <input name="address" defaultValue={property.address ?? ''} placeholder="Address" className="w-full rounded border px-3 py-2" />
        <input name="city" defaultValue={property.city ?? ''} placeholder="City" className="w-full rounded border px-3 py-2" />

        <h2 className="pt-4 font-semibold">Knowledge base (used by the AI agent)</h2>
        <input name="wifiNetwork" defaultValue={property.wifi_network ?? ''} placeholder="Wifi network" className="w-full rounded border px-3 py-2" />
        <input name="wifiPassword" defaultValue={property.wifi_password ?? ''} placeholder="Wifi password" className="w-full rounded border px-3 py-2" />
        <input name="gateCode" defaultValue={property.gate_code ?? ''} placeholder="Gate code" className="w-full rounded border px-3 py-2" />
        <textarea name="generatorInstructions" defaultValue={property.generator_instructions ?? ''} placeholder="Generator instructions" className="w-full rounded border px-3 py-2" />
        <textarea name="geyserInstructions" defaultValue={property.geyser_instructions ?? ''} placeholder="Geyser instructions" className="w-full rounded border px-3 py-2" />
        <textarea name="acInstructions" defaultValue={property.ac_instructions ?? ''} placeholder="AC instructions" className="w-full rounded border px-3 py-2" />
        <textarea name="parkingInstructions" defaultValue={property.parking_instructions ?? ''} placeholder="Parking instructions" className="w-full rounded border px-3 py-2" />
        <div className="flex gap-4">
          <input name="checkinTime" type="time" defaultValue={property.checkin_time ?? ''} className="w-full rounded border px-3 py-2" />
          <input name="checkoutTime" type="time" defaultValue={property.checkout_time ?? ''} className="w-full rounded border px-3 py-2" />
        </div>
        <textarea name="directions" defaultValue={property.directions ?? ''} placeholder="Directions" className="w-full rounded border px-3 py-2" />
        <textarea name="nearbyRecommendations" defaultValue={property.nearby_recommendations ?? ''} placeholder="Nearby recommendations" className="w-full rounded border px-3 py-2" />
        <textarea name="houseRules" defaultValue={property.house_rules ?? ''} placeholder="House rules" className="w-full rounded border px-3 py-2" />
        <textarea name="additionalNotes" defaultValue={property.additional_notes ?? ''} placeholder="Additional notes" className="w-full rounded border px-3 py-2" />

        <h2 className="pt-4 font-semibold">Airbnb trust badge</h2>
        <input name="airbnbListingUrl" defaultValue={property.airbnb_listing_url ?? ''} placeholder="Airbnb listing URL" className="w-full rounded border px-3 py-2" />
        <p className="text-sm text-gray-500">
          Verification flow (checking a code in your Airbnb listing) is built in a later sprint — this field is saved but the badge won&apos;t show as verified yet.
        </p>

        <button type="submit" className="w-full rounded bg-black px-3 py-2 text-white">
          Save
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 4: Manually verify**

```bash
npm run dev
```

Log in, open a property from the dashboard list, edit a few knowledge-base fields, save, and confirm they persist on reload.

- [ ] **Step 5: Commit**

```bash
git add web/app/dashboard/properties/[id] web/lib/properties.rls.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add property detail/edit page; add RLS cross-tenant regression test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Vercel deployment preparation

**Files:**
- Create: `web/.env.example`
- Modify: root `README.md` (create if it doesn't exist) with a "Deploying" section

**Interfaces:**
- Consumes: nothing new
- Produces: documented environment variables and a deploy checklist. No later task depends on this one.

- [ ] **Step 1: Document the required environment variables**

```bash
# web/.env.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Write the deploy checklist**

Add to (or create) the repo root `README.md`:

```markdown
## Deploying

This app (`web/`) deploys to Vercel; the database is a hosted Supabase project (not the local Docker instance used in development).

Before the first deploy:
1. Create a hosted Supabase project at supabase.com.
2. From the repo root: `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push` to apply every migration in `supabase/migrations/` to the hosted project.
3. In the Vercel project settings for `web/`, set the three variables listed in `web/.env.example` to the hosted project's values (Project Settings > API in the Supabase dashboard).
4. `vercel login` and `vercel --cwd web` (or connect the GitHub repo to Vercel with `web` as the project root) — this step requires your own Vercel account and is not automated by this plan.
```

- [ ] **Step 3: Commit**

```bash
git add web/.env.example README.md
git commit -m "$(cat <<'EOF'
docs: add deployment checklist and env var template

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Sprint-level verification

After Task 8, run the full test suite once end-to-end:

```bash
cd web
npm test
npm run build
```

Expected: all tests pass, the production build succeeds. Then walk the full manual path once: sign up → create organization → create a property → fill in its knowledge base → log out → log back in → see it still there. This is Sprint 1's end-of-sprint demo from the roadmap (`docs/superpowers/plans/roadmap/2026-09-16-phase-1-sprint-roadmap.md`).
