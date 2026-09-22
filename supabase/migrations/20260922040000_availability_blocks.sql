-- Needed for the exclusion constraint below: GiST needs an operator class
-- for `=` on uuid, which only exists once btree_gist is installed.
create extension if not exists btree_gist with schema extensions;

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default 'manual_block' check (reason in ('manual_block', 'booking')),
  created_at timestamptz not null default now(),
  constraint availability_blocks_dates_valid check (end_date > start_date),
  exclude using gist (
    property_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
);

alter table public.availability_blocks enable row level security;

create policy "availability_blocks_all_own" on public.availability_blocks
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
