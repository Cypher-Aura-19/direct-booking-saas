create table guests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id),
  phone             text not null,
  name              text,
  created_at        timestamptz not null default now(),
  unique (organization_id, phone)
);
