-- properties_select_published_anon (20260922020000) grants row-level access
-- to published properties, but Postgres RLS filters rows, not columns — the
-- anon key could otherwise read knowledge_base (wifi/gate codes) and
-- ai_settings verbatim.
--
-- A plain `revoke select (knowledge_base, ai_settings) ... from anon` is not
-- sufficient here: this stack grants anon a blanket table-level ACL
-- (arwdDxtm) directly on public.properties, and Postgres table-level SELECT
-- subsumes every column — a table-level grant cannot be clawed back for a
-- subset of columns via a column-level REVOKE alone (verified against the
-- running stack: attacl stayed null and the column remained readable after
-- a column-only revoke). So we revoke table-level SELECT from anon
-- entirely, then re-grant SELECT on just the safe columns.
--
-- Side effect: `select * from properties` as anon now fails entirely with
-- permission-denied (Postgres requires privilege on every column a `*`
-- expands to) rather than silently omitting the two locked columns. Any
-- future anon-facing query against properties (e.g. M5's public catalogue)
-- MUST use an explicit column list, never `select *`.
revoke select on public.properties from anon;

grant select (
  id, organization_id, name, property_type, address,
  base_rate_cents, max_guests, published, created_at
) on public.properties to anon;
