-- ---------------------------------------------------------------------------
-- M6 availability and pricing. Dates are nights: [start_date, end_date).
-- ---------------------------------------------------------------------------

-- Property-level stay settings (CAL-05, CAL-06).
alter table public.properties
  add column minimum_stay integer not null default 1,
  add column advance_percent integer not null default 30;

alter table public.properties
  add constraint properties_minimum_stay_range check (minimum_stay between 1 and 60),
  add constraint properties_advance_percent_range check (advance_percent between 0 and 100);

-- Guests need the minimum stay to pick valid dates. advance_percent is shown
-- at booking time (M10) and stays private until then.
grant select (minimum_stay) on public.properties to anon;

-- Seasonal rules (CAL-04): positive rate, sane minimum stay, and no two rules
-- for one property may cover the same night, so the price for a night is
-- never ambiguous (CAL-09, CAL-10). btree_gist exists since 20260922040000.
alter table public.seasonal_pricing_rules
  add constraint seasonal_pricing_rules_rate_positive check (rate_cents > 0),
  add constraint seasonal_pricing_rules_minimum_stay_range check (minimum_stay between 1 and 60),
  add constraint seasonal_pricing_rules_no_overlap exclude using gist (
    property_id with =,
    daterange(start_date, end_date, '[)') with &&
  );

-- ---------------------------------------------------------------------------
-- Anon reads for the public availability calendar (CAL-07, CAL-08, CAL-09).
-- Table-level revoke first: this stack grants anon a blanket table ACL that a
-- column grant alone cannot narrow (see 20260922090000).
-- ---------------------------------------------------------------------------
revoke select on public.availability_blocks from anon;
grant select (property_id, start_date, end_date) on public.availability_blocks to anon;

create policy "availability_blocks_select_published_anon" on public.availability_blocks
  for select
  to anon
  using (exists (select 1 from public.properties p where p.id = property_id and p.published));

revoke select on public.seasonal_pricing_rules from anon;
grant select (property_id, start_date, end_date, rate_cents, minimum_stay) on public.seasonal_pricing_rules to anon;

create policy "seasonal_pricing_rules_select_published_anon" on public.seasonal_pricing_rules
  for select
  to anon
  using (exists (select 1 from public.properties p where p.id = property_id and p.published));
