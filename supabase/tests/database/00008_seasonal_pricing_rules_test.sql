begin;
select plan(4);

select has_table('seasonal_pricing_rules');
select columns_are('seasonal_pricing_rules', array[
  'id', 'property_id', 'start_date', 'end_date', 'nightly_rate_pkr', 'minimum_nights', 'created_at'
]);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';

select lives_ok(
  $$ insert into seasonal_pricing_rules (property_id, start_date, end_date, nightly_rate_pkr)
     select id, '2026-06-01', '2026-08-31', 12000 from properties where slug = 'deluxe-cabin' $$,
  'can insert a seasonal rate override without a minimum_nights override'
);
select is(
  (select minimum_nights from seasonal_pricing_rules limit 1), null,
  'minimum_nights is nullable and defaults to null (use the property default)'
);

select * from finish();
rollback;
