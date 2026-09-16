# Direct Booking Platform

A direct-booking SaaS for Pakistani guesthouse and cabin hosts. See `direct-booking-saas-proposal.md` for the product proposal, and `docs/superpowers/` for the schema spec, implementation plans, and sprint roadmap.

## Local development

```bash
# Database (from repo root)
npx supabase start   # starts local Postgres + Auth + Storage in Docker

# App
cd web
npm install
npm run dev           # http://localhost:3000 (or next available port)
npm test              # runs against the local Supabase instance above
```

`web/.env.local` and `web/.env.test.local` hold the local Supabase URL and keys (from `npx supabase status -o env`) — both are gitignored.

## Deploying

This app (`web/`) deploys to Vercel; the database is a hosted Supabase project (not the local Docker instance used in development).

Before the first deploy:
1. Create a hosted Supabase project at supabase.com.
2. From the repo root: `npx supabase link --project-ref <your-project-ref>`, then `npx supabase db push` to apply every migration in `supabase/migrations/` to the hosted project.
3. In the Vercel project settings for `web/`, set the three variables listed in `web/.env.example` to the hosted project's values (Project Settings > API in the Supabase dashboard).
4. `vercel login` and `vercel --cwd web` (or connect the GitHub repo to Vercel with `web` as the project root) — this step requires your own Vercel account and isn't something that can be automated on your behalf.
