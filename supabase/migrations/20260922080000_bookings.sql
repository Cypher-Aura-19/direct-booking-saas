-- No exclusion constraint here: double-booking prevention lives on
-- availability_blocks (20260922040000). A future milestone (M10's booking
-- approval flow) is expected to write a matching availability_blocks row
-- when a booking is approved — until then, two overlapping bookings rows
-- can exist simultaneously without a DB-level error.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'paid', 'staying', 'checked_out', 'rejected')),
  total_price_cents integer not null,
  created_at timestamptz not null default now(),
  constraint bookings_dates_valid check (end_date > start_date)
);

create index bookings_property_id_idx on public.bookings (property_id);
create index bookings_conversation_id_idx on public.bookings (conversation_id);
create index bookings_guest_id_idx on public.bookings (guest_id);

alter table public.bookings enable row level security;

create policy "bookings_all_own" on public.bookings
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
