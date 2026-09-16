begin;
select plan(9);

select has_table('properties');
select columns_are('properties', array[
  'id', 'organization_id', 'name', 'slug', 'description', 'address', 'city',
  'max_guests', 'nightly_rate_pkr', 'minimum_nights', 'status',
  'wifi_network', 'wifi_password', 'gate_code', 'generator_instructions',
  'geyser_instructions', 'ac_instructions', 'parking_instructions',
  'checkin_time', 'checkout_time', 'directions', 'nearby_recommendations',
  'house_rules', 'additional_notes',
  'airbnb_listing_url', 'airbnb_verification_code', 'airbnb_verified', 'airbnb_verified_at',
  'created_at'
]);

select has_table('property_photos');
select columns_are('property_photos', array[
  'id', 'property_id', 'storage_path', 'sort_order', 'created_at'
]);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');

select lives_ok(
  $$ insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
     select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view' $$,
  'can insert a minimal valid property'
);

select col_has_default('properties', 'status');
select is(
  (select status from properties where slug = 'deluxe-cabin'),
  'draft',
  'status defaults to draft'
);
select is(
  (select airbnb_verified from properties where slug = 'deluxe-cabin'),
  false,
  'airbnb_verified defaults to false'
);

select throws_ok(
  $$ insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
     select id, 'Duplicate Slug Cabin', 'deluxe-cabin', 2, 5000 from organizations where slug = 'hunza-view' $$,
  '23505'::char(5),
  null,
  'duplicate slug within the same organization is rejected'
);

select * from finish();
rollback;
