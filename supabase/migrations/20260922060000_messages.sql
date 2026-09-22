create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender text not null check (sender in ('guest', 'ai', 'host')),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id);

alter table public.messages enable row level security;

create function public.owns_conversation(conv_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv_id and public.owns_property(c.property_id)
  );
$$;

create policy "messages_all_own" on public.messages
  for all
  to authenticated
  using (public.owns_conversation(conversation_id))
  with check (public.owns_conversation(conversation_id));

-- Enforces the Phase 1 core design decision that the AI can never speak
-- while a conversation is in payment state. A BEFORE INSERT trigger fires
-- for every role including service_role, unlike an RLS policy — this is
-- what makes the block non-overridable by the AI backend code M7 adds.
create function public.forbid_ai_message_during_payment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.sender = 'ai' and exists (
    select 1 from public.conversations c
    where c.id = new.conversation_id and c.ai_state = 'payment'
  ) then
    raise exception 'AI cannot send messages while the conversation is in payment state'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger messages_forbid_ai_during_payment
  before insert on public.messages
  for each row
  execute function public.forbid_ai_message_during_payment();
