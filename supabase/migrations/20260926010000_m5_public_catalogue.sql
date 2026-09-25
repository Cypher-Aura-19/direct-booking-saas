-- ---------------------------------------------------------------------------
-- M5 public catalogue. Everything here widens what the anon role can read,
-- so every grant is column-level and every policy is scoped to published
-- properties. RLS filters rows, not columns (see 20260922090000).
-- ---------------------------------------------------------------------------

-- Guest-facing listing fields (PUB-02). The amenity list must match
-- AMENITIES in web/lib/properties/listing.ts exactly.
alter table public.properties
  add column description text not null default '',
  add column amenities text[] not null default '{}';

alter table public.properties
  add constraint properties_description_length check (char_length(description) <= 2000),
  add constraint properties_amenities_known check (
    amenities <@ array[
      'wifi', 'parking', 'hot_water', 'backup_power', 'heating', 'air_conditioning',
      'kitchen', 'breakfast', 'mountain_view', 'family_friendly', 'workspace', 'garden'
    ]::text[]
  );

grant select (description, amenities) on public.properties to anon;

-- properties.address was granted to anon by 20260922090000, before the
-- 2026-09-25 owner decision that guest-facing pages show only the host's
-- city (via organizations.profile), never the street address. Revoke it: a
-- column-level revoke is sufficient here because 20260922090000 already
-- converted anon's privilege on this table from a blanket table-level grant
-- to column-level grants, so this narrows one column without touching the
-- others (unlike the table-level case that migration describes).
revoke select (address) on public.properties from anon;

-- Photos uploaded from M5 on carry 480/960/1600px WebP variants stored beside
-- the original (<property_id>/<uuid>.w480.webp etc.). Older photos don't.
alter table public.property_photos add column has_variants boolean not null default false;

-- ---------------------------------------------------------------------------
-- Organisations: anon reads the public face of every organisation (PUB-01,
-- PUB-03, PUB-06, PUB-10). profile holds city, phone and headline, all public
-- by owner decision (2026-09-25). owner_id, payment_instructions, policies,
-- badge_status and account_status are not granted.
-- Table-level revoke first: this stack grants anon a blanket table ACL, which
-- a column-level grant alone cannot narrow (same finding as 20260922090000).
-- ---------------------------------------------------------------------------
revoke select on public.organizations from anon;
grant select (id, slug, name, profile, created_at) on public.organizations to anon;

create policy "organizations_select_public_anon" on public.organizations
  for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- Photos of published properties: the rows (gallery order, cover) and the
-- storage objects (so anon can create signed URLs for them).
-- ---------------------------------------------------------------------------
create policy "property_photos_select_published_anon" on public.property_photos
  for select
  to anon
  using (exists (
    select 1 from public.properties p
    where p.id = property_id and p.published
  ));

create function public.is_published_property_object(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.properties p
    where p.id::text = split_part(object_name, '/', 1)
      and p.published
  );
$$;

revoke execute on function public.is_published_property_object(text) from public;
grant execute on function public.is_published_property_object(text) to anon, authenticated;

create policy "property_photos_objects_published_anon_read" on storage.objects
  for select
  to anon
  using (bucket_id = 'property-photos' and public.is_published_property_object(name));
