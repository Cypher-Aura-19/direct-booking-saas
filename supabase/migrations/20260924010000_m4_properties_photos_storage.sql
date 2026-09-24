-- ---------------------------------------------------------------------------
-- properties.slug — the second half of the public URL /s/<org>/<property>.
-- The app derives it from the property name; the trigger is the fallback for
-- names with no Latin letters (e.g. written in Urdu) and for direct inserts.
-- ---------------------------------------------------------------------------
alter table public.properties add column slug text;

update public.properties
  set slug = 'p-' || left(replace(id::text, '-', ''), 8)
  where slug is null;

create function public.properties_default_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := 'p-' || left(replace(new.id::text, '-', ''), 8);
  end if;
  return new;
end;
$$;

create trigger properties_default_slug
  before insert on public.properties
  for each row execute function public.properties_default_slug();

alter table public.properties alter column slug set not null;
alter table public.properties
  add constraint properties_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint properties_organization_slug_unique unique (organization_id, slug),
  add constraint properties_base_rate_positive check (base_rate_cents > 0),
  add constraint properties_max_guests_range check (max_guests between 1 and 50);

-- anon holds column-level SELECT only (20260922090000); a new column is not
-- covered until granted explicitly. slug is public by design.
grant select (slug) on public.properties to anon;

-- ---------------------------------------------------------------------------
-- property_photos: exactly one cover, and atomic multi-row operations.
-- ---------------------------------------------------------------------------
create unique index property_photos_one_cover_idx
  on public.property_photos (property_id)
  where is_cover;

-- security invoker: runs under the caller's RLS, so another host's photos are
-- simply invisible here and the completeness check below fails for them.
create function public.reorder_property_photos(target_property_id uuid, ordered_photo_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_count integer;
  matched_count integer;
begin
  select count(*) into existing_count
    from public.property_photos where property_id = target_property_id;

  select count(distinct p.id) into matched_count
    from unnest(ordered_photo_ids) as o(id)
    join public.property_photos p on p.id = o.id and p.property_id = target_property_id;

  if existing_count = 0
     or cardinality(ordered_photo_ids) <> existing_count
     or matched_count <> existing_count then
    raise exception 'ordered_photo_ids must list every photo of the property exactly once'
      using errcode = '22023';
  end if;

  update public.property_photos p
    set position = o.ord - 1
    from unnest(ordered_photo_ids) with ordinality as o(id, ord)
    where p.id = o.id and p.property_id = target_property_id;
end;
$$;

create function public.set_property_cover(target_photo_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_property uuid;
begin
  select property_id into target_property
    from public.property_photos where id = target_photo_id;

  if target_property is null then
    raise exception 'photo not found' using errcode = 'P0002';
  end if;

  -- Clear first: the partial unique index is checked per statement.
  update public.property_photos set is_cover = false
    where property_id = target_property and is_cover;
  update public.property_photos set is_cover = true
    where id = target_photo_id;
end;
$$;

revoke execute on function public.reorder_property_photos(uuid, uuid[]) from public;
revoke execute on function public.set_property_cover(uuid) from public;
grant execute on function public.reorder_property_photos(uuid, uuid[]) to authenticated;
grant execute on function public.set_property_cover(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage. Private: the dashboard reads through signed URLs, and M5's
-- public pages will read through a server-side image route, so a draft
-- property's photos are never world-readable (PROP-04).
-- Object path convention: <property_id>/<uuid>.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp']);

create function public.owns_property_object(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id::text = split_part(object_name, '/', 1)
      and public.owns_organization(p.organization_id)
  );
$$;

revoke execute on function public.owns_property_object(text) from public;
grant execute on function public.owns_property_object(text) to authenticated;

create policy "property_photos_objects_owner_all" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'property-photos' and public.owns_property_object(name))
  with check (bucket_id = 'property-photos' and public.owns_property_object(name));
