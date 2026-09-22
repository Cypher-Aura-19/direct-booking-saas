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

-- Postgres grants EXECUTE on every newly created function to PUBLIC by
-- default. That's harmless for a `security invoker` function like
-- owns_organization (it still only runs with the caller's own RLS-scoped
-- privileges either way), but this function is `security definer` — the
-- one place in this schema that runs with elevated, RLS-bypassing
-- privilege — so leaving the implicit PUBLIC grant in place here is
-- exactly the wrong spot to be permissive. Revoke it explicitly before
-- granting only to the two roles that need it.
revoke execute on function public.organization_slug_taken(text) from public;
grant execute on function public.organization_slug_taken(text) to authenticated, anon;
