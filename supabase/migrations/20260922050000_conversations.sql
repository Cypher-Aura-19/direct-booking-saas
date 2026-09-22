-- Needed for gen_random_bytes(), used below to mint the guest token.
create extension if not exists pgcrypto with schema extensions;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  guest_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
  ai_state text not null default 'enquiry' check (ai_state in ('enquiry', 'payment', 'stay')),
  ai_enabled boolean not null default true,
  escalated boolean not null default false,
  escalation_reason text,
  created_at timestamptz not null default now()
);

create index conversations_property_id_idx on public.conversations (property_id);

alter table public.conversations enable row level security;

create policy "conversations_all_own" on public.conversations
  for all
  to authenticated
  using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
