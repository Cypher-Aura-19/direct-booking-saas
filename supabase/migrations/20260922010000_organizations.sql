create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  slug text not null unique,
  name text not null,
  profile jsonb not null default '{}'::jsonb,
  payment_instructions jsonb not null default '{}'::jsonb,
  policies jsonb not null default '{}'::jsonb,
  badge_status text not null default 'none'
    check (badge_status in ('none', 'pending', 'approved', 'rejected')),
  account_status text not null default 'pending'
    check (account_status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Every later table's RLS policy calls this instead of repeating the
-- subquery, so the ownership chain is defined exactly once.
create function public.owns_organization(org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org_id and o.owner_id = auth.uid()
  );
$$;

create policy "organizations_all_own" on public.organizations
  for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
