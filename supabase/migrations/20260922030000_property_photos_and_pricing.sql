create table public.property_photos (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  storage_path text not null,
  position integer not null,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index property_photos_property_id_idx on public.property_photos (property_id);

alter table public.property_photos enable row level security;

create policy "property_photos_all_own" on public.property_photos
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));

create table public.seasonal_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  rate_cents integer not null,
  minimum_stay integer not null default 1,
  created_at timestamptz not null default now(),
  constraint seasonal_pricing_rules_dates_valid check (end_date > start_date)
);

create index seasonal_pricing_rules_property_id_idx on public.seasonal_pricing_rules (property_id);

alter table public.seasonal_pricing_rules enable row level security;

create policy "seasonal_pricing_rules_all_own" on public.seasonal_pricing_rules
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
