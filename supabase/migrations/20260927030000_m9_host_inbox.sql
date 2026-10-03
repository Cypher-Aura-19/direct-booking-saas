-- ---------------------------------------------------------------------------
-- M9 host inbox: read-tracking, realtime, and the one-round-trip list query.
-- No RLS or grant changes — the existing owns_property/owns_conversation
-- policies (M2) are exactly what must also gate Realtime delivery below.
-- ---------------------------------------------------------------------------

alter table public.conversations add column host_last_read_at timestamptz;

-- Realtime honors each table's existing RLS for the connecting role, so
-- adding these two tables to the publication exposes nothing new: anon still
-- has zero grants on either (M7), and an authenticated host still only ever
-- sees rows owns_property/owns_conversation already let them see.
alter publication supabase_realtime add table public.conversations, public.messages;

-- One round trip for the inbox list: PostgREST alone can't express "the
-- latest message per conversation" (a LATERAL join), and N+1 queries don't
-- scale. security invoker (like is_published_property_object, M4) means
-- this runs as the caller — RLS still applies to every table it touches.
create function public.list_host_conversations(org_id uuid)
returns table (
  id uuid,
  property_id uuid,
  property_name text,
  guest_token text,
  ai_state text,
  ai_enabled boolean,
  escalated boolean,
  last_sender text,
  last_body text,
  last_created_at timestamptz,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.property_id, p.name as property_name, c.guest_token, c.ai_state, c.ai_enabled, c.escalated,
    m.sender as last_sender, m.body as last_body, m.created_at as last_created_at,
    (
      select count(*) from public.messages um
      where um.conversation_id = c.id
        and um.sender <> 'host'
        and (c.host_last_read_at is null or um.created_at > c.host_last_read_at)
    ) as unread_count
  from public.conversations c
  join public.properties p on p.id = c.property_id
  left join lateral (
    select sender, body, created_at from public.messages mm
    where mm.conversation_id = c.id
    order by created_at desc, id desc
    limit 1
  ) m on true
  where p.organization_id = org_id
  order by coalesce(m.created_at, c.created_at) desc;
$$;

-- Supabase grants EXECUTE to anon and authenticated by name at creation
-- time regardless of the `revoke ... from public` below (the same gotcha
-- 20260925010000 documents) — anon's own grant is revoked explicitly.
revoke execute on function public.list_host_conversations(uuid) from public, anon;
grant execute on function public.list_host_conversations(uuid) to authenticated;
