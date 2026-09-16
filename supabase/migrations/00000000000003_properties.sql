create table properties (
  id                        uuid primary key default gen_random_uuid(),
  organization_id           uuid not null references organizations(id),
  name                      text not null,
  slug                      text not null,
  description               text,
  address                   text,
  city                      text,
  max_guests                int not null,
  nightly_rate_pkr          numeric not null,
  minimum_nights            int not null default 1,
  status                    text not null default 'draft',

  wifi_network              text,
  wifi_password             text,
  gate_code                 text,
  generator_instructions    text,
  geyser_instructions       text,
  ac_instructions           text,
  parking_instructions      text,
  checkin_time              time,
  checkout_time             time,
  directions                text,
  nearby_recommendations    text,
  house_rules               text,
  additional_notes          text,

  airbnb_listing_url        text,
  airbnb_verification_code  text,
  airbnb_verified           boolean not null default false,
  airbnb_verified_at        timestamptz,

  created_at                timestamptz not null default now(),
  unique (organization_id, slug)
);

create table property_photos (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id),
  storage_path  text not null,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
