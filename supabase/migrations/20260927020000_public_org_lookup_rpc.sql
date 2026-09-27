-- ---------------------------------------------------------------------------
-- Closes anon organisation enumeration (open owner call from M5, resolved
-- 2026-09-27): `organizations_select_public_anon` was `using (true)` with no
-- filter, so a raw PostgREST query with no `.eq` (e.g.
-- `/rest/v1/organizations?select=name,slug,profile`) could dump every host's
-- name, city and phone number, including orgs with zero properties.
--
-- The policy was that broad on purpose, not by accident: PUB-10 requires
-- that even an organisation with nothing published still renders a written
-- empty state, so `web/lib/public/catalogue.ts`'s `getPublicOrganization`
-- must be able to look up ANY org by slug, published or not. RLS can't tell
-- a single targeted slug lookup apart from an unfiltered bulk listing — both
-- evaluate the same per-row condition — so scoping the policy to "orgs with
-- a published property" would satisfy PUB-10's happy path but 404 the exact
-- empty-state case PUB-10 exists for.
--
-- The fix instead moves the read behind a single-row RPC, the same pattern
-- `is_published_property_object` already uses in 20260926010000: anon loses
-- direct table access entirely, and can only ever get one row back per call,
-- for a slug it already knows. Enumerating every org now takes one guess per
-- slug instead of one unfiltered query — the RLS-level "read anything" hole
-- is closed, and PUB-10's per-slug empty-state lookup is unaffected.
-- ---------------------------------------------------------------------------

drop policy "organizations_select_public_anon" on public.organizations;
revoke select (id, slug, name, profile, created_at) on public.organizations from anon;

create function public.get_public_organization(org_slug text)
returns table (id uuid, slug text, name text, profile jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.slug, o.name, o.profile, o.created_at
  from public.organizations o
  where o.slug = org_slug
  limit 1;
$$;

-- Supabase grants EXECUTE to anon by name at creation time regardless of the
-- `revoke ... from public` below (the same gotcha 20260925010000 already
-- documents), so anon's own grant is revoked explicitly before being
-- re-granted deliberately.
revoke execute on function public.get_public_organization(text) from public, anon, authenticated;
grant execute on function public.get_public_organization(text) to anon, authenticated;
