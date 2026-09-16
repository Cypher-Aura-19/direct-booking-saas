create table bookings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id),
  property_id           uuid not null references properties(id),
  guest_id              uuid not null references guests(id),
  conversation_id       uuid not null references conversations(id),
  check_in              date not null,
  check_out             date not null,
  guest_count           int not null,
  total_price_pkr       numeric not null,
  advance_amount_pkr    numeric not null,
  status                text not null default 'requested',
  payment_confirmed_at  timestamptz,
  payment_confirmed_by  uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  check (check_out > check_in)
);
