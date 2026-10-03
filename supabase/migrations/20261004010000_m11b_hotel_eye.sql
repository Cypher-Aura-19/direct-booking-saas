-- ---------------------------------------------------------------------------
-- M11b Hotel Eye. Upload links, retention cap, private ID bucket. Every
-- function here runs with the caller's own rights: the host paths are gated
-- by the existing owns_organization()/owns_property() helpers exactly as
-- direct access is.
-- ---------------------------------------------------------------------------

-- One upload link per booking (so one ID per booking). The token is the
-- guest's whole credential and is only ever resolved with the service role
-- behind a Server Action; hosts read/insert through RLS.
create table public.id_upload_links (
  token text primary key check (token ~ '^[0-9a-f]{64}$'),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index id_upload_links_organization_id_idx on public.id_upload_links (organization_id);

alter table public.id_upload_links enable row level security;

create policy "id_upload_links_all_own" on public.id_upload_links
  for all
  to authenticated
  using (public.owns_organization(organization_id))
  with check (public.owns_organization(organization_id));

-- Supabase grants anon every privilege on new public tables by default.
revoke all on public.id_upload_links from anon;

-- guest_documents: tie a record to its booking, and make the retention cap a
-- database rule so RLS + this trigger are the whole story (CNIC-11/12).
alter table public.guest_documents
  add column booking_id uuid unique references public.bookings (id) on delete cascade;
alter table public.guest_documents alter column retention_expires_at drop default;

create function public.guest_document_retention_cap(stay_end date)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select ((stay_end + 90)::timestamp at time zone 'Asia/Karachi');
$$;

create function public.guest_documents_enforce_retention()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stay_end is null then
    raise exception 'a guest document needs a stay end date' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.stay_end is distinct from old.stay_end or new.booking_id is distinct from old.booking_id) then
    raise exception 'stay_end and booking_id cannot be changed' using errcode = '23514';
  end if;
  if new.retention_expires_at > public.guest_document_retention_cap(new.stay_end) then
    raise exception 'retention cannot exceed 90 days after checkout' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guest_documents_enforce_retention
  before insert or update on public.guest_documents
  for each row execute function public.guest_documents_enforce_retention();

revoke execute on function public.guest_document_retention_cap(date) from public, anon;
revoke execute on function public.guest_documents_enforce_retention() from public, anon;
grant execute on function public.guest_document_retention_cap(date) to authenticated;

-- mark_booking_paid: M11a's body plus the upload link. Still security
-- invoker, still one transaction, and the single AI message is still inserted
-- AFTER the conversation leaves 'payment'. The acknowledgement carries a
-- relative /id/<token> path (the database does not know the site origin); the
-- guest chat renders it as a same-origin link.
create or replace function public.mark_booking_paid(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  link_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  select * into b from public.bookings where id = booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.status <> 'approved' then
    raise exception 'booking is not awaiting payment' using errcode = '55000';
  end if;

  update public.bookings set status = 'paid' where id = b.id;

  insert into public.id_upload_links (token, booking_id, organization_id, expires_at)
  select link_token, b.id, p.organization_id, ((b.end_date + 1)::timestamp at time zone 'Asia/Karachi')
  from public.properties p
  where p.id = b.property_id;

  if b.conversation_id is not null then
    update public.conversations set ai_state = 'stay' where id = b.conversation_id;
    insert into public.messages (conversation_id, sender, body)
    values (
      b.conversation_id,
      'ai',
      'Payment received - you''re confirmed. Please upload your ID before you arrive: /id/' || link_token
        || ' - and ask me anything about check-in or the house.'
    );
  end if;
end;
$$;

-- Private ID bucket. Object path: <organization_id>/<booking_id>/<uuid>.<ext>.
-- Uploads and deletions use the service role; the host may only read (to sign
-- a URL) objects under an organisation it owns. No anon policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-ids', 'guest-ids', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']);

create function public.owns_guest_id_object(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id::text = split_part(object_name, '/', 1)
      and public.owns_organization(o.id)
  );
$$;

revoke execute on function public.owns_guest_id_object(text) from public, anon;
grant execute on function public.owns_guest_id_object(text) to authenticated;

create policy "guest_ids_objects_owner_read" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'guest-ids' and public.owns_guest_id_object(name));
