create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create index guests_organization_id_idx on public.guests (organization_id);

alter table public.guests enable row level security;

create policy "guests_all_own" on public.guests
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));

-- organization_id is denormalised here (rather than joined through guests)
-- so the RLS policy is a single equality check, not a nested subquery —
-- this table is read on every Hotel Eye export and should stay cheap to plan.
create table public.guest_documents (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  image_path text not null,
  cnic_number text,
  stay_start date,
  stay_end date,
  retention_expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

create index guest_documents_guest_id_idx on public.guest_documents (guest_id);
create index guest_documents_organization_id_idx on public.guest_documents (organization_id);

alter table public.guest_documents enable row level security;

create policy "guest_documents_all_own" on public.guest_documents
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));
