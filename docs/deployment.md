# Deployment

Production: https://direct-booking-platform-eta.vercel.app (Vercel project `direct-booking-platform`).
Database: hosted Supabase project `direct-booking-platform`, ref `vhzplaphuaydfwtvryla`, region `ap-south-1`.

## Required Vercel environment variables

Set for Production, Preview and Development:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vhzplaphuaydfwtvryla.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's legacy `anon` key (`supabase projects api-keys --project-ref vhzplaphuaydfwtvryla`) |
| `STAY_HOST` | server-only, e.g. `stay.qayam.pk`. Requests to this host are rewritten onto `/s/*`. |
| `NEXT_PUBLIC_STAY_ORIGIN` | e.g. `https://stay.qayam.pk`, used to build public links shown to hosts. |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, never `NEXT_PUBLIC_`; bypasses RLS (`supabase projects api-keys --project-ref vhzplaphuaydfwtvryla`) |
| `GEMINI_API_KEY` | server only, used by the guest-chat AI orchestrator |
| `GEMINI_MODEL` | optional, defaults to `gemini-2.5-flash` |

Without them the session-refresh middleware throws on every request and Vercel
answers every route with `500 MIDDLEWARE_INVOCATION_FAILED`.

Leave `STAY_HOST` and `NEXT_PUBLIC_STAY_ORIGIN` unset until the domain exists;
everything works under `/s/` without them.

## Every milestone that adds migrations

```sh
npx supabase link --project-ref vhzplaphuaydfwtvryla   # once per machine
npx supabase db push                                   # applies new files in supabase/migrations
```

Then redeploy (`vercel --prod`, or push to `main`).

## Auth URLs on the hosted project

`supabase/config.toml` holds the *local* auth URLs (`127.0.0.1:3000`). The hosted
project's `site_url` is the production domain and its redirect allow-list covers
production, Vercel preview URLs, and local dev. Change these with
`supabase config push` from a copy of the config with the production URLs
substituted — never push the checked-in file as-is, or confirmation and reset
emails will link to `127.0.0.1`.
