create table availability_blocks (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id),
  start_date    date not null,
  end_date      date not null,
  reason        text not null,
  booking_id    uuid references bookings(id),
  created_at    timestamptz not null default now(),
  check (end_date > start_date),
  exclude using gist (
    property_id with =,
    daterange(start_date, end_date) with &&
  )
);
