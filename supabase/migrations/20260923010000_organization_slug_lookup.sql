-- isSlugAvailable() must work for a host who owns no organisation yet,
-- checking a slug that may belong to someone else's — organizations' only
-- RLS policy (owner_id = auth.uid(), from M2) hides every other host's row
-- by design. This function reveals nothing beyond "does this exact slug
-- exist" — not the row, not the owner — so it doesn't reopen a cross-org
-- read.
create function public.organization_slug_taken(check_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.organizations where slug = check_slug);
$$;

grant execute on function public.organization_slug_taken(text) to authenticated, anon;
