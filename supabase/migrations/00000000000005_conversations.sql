create table conversations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations(id),
  property_id         uuid not null references properties(id),
  guest_id            uuid not null references guests(id),
  ai_state            text not null default 'enquiry',
  ai_enabled          boolean not null default true,
  ai_disabled_reason  text,
  last_message_at     timestamptz,
  created_at          timestamptz not null default now(),
  unique (property_id, guest_id),
  check (ai_state != 'payment' or ai_enabled = false)
);
