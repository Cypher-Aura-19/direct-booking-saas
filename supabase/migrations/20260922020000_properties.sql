create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  property_type text not null,
  address text not null,
  base_rate_cents integer not null,
  max_guests integer not null,
  published boolean not null default false,
  knowledge_base jsonb not null default '{}'::jsonb,
  ai_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index properties_organization_id_idx on public.properties (organization_id);

alter table public.properties enable row level security;

create function public.owns_property(prop_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id = prop_id and public.owns_organization(p.organization_id)
  );
$$;

create policy "properties_all_own" on public.properties
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));

create policy "properties_select_published_anon" on public.properties
  for select
  to anon
  using (published = true);
