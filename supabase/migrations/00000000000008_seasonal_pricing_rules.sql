create table seasonal_pricing_rules (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references properties(id),
  start_date        date not null,
  end_date          date not null,
  nightly_rate_pkr  numeric not null,
  minimum_nights    int,
  created_at        timestamptz not null default now()
);
