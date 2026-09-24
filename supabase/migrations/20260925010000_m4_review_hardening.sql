-- ---------------------------------------------------------------------------
-- Final-review fix wave for M4 (properties and knowledge base).
-- ---------------------------------------------------------------------------

-- Supabase seeds pg_default_acl for schema `public` so that every new
-- function is granted EXECUTE to anon, authenticated and service_role BY
-- NAME at creation time. `revoke execute ... from public` (as migration
-- 20260924010000 did) only removes the PUBLIC pseudo-role's grant — it does
-- nothing to anon's own, separately-recorded grant. Each of these functions
-- must have anon's grant revoked explicitly, in addition to (not instead of)
-- the existing `revoke ... from public`.
revoke execute on function public.reorder_property_photos(uuid, uuid[]) from anon;
revoke execute on function public.set_property_cover(uuid) from anon;
revoke execute on function public.owns_property_object(text) from anon;

-- properties_default_slug is a trigger-only helper: it must never be callable
-- directly by any client role. Triggers still fire regardless of EXECUTE
-- grants, because Postgres invokes trigger functions as the table owner, not
-- as the calling role.
revoke execute on function public.properties_default_slug() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A property_photos row's storage_path must live under its own property_id
-- (the object path convention is <property_id>/<uuid>.<ext>). Without this,
-- nothing in the schema stops a row from pointing at another property's
-- object path.
-- ---------------------------------------------------------------------------
alter table public.property_photos
  add constraint property_photos_path_matches_property
  check (split_part(storage_path, '/', 1) = property_id::text);
