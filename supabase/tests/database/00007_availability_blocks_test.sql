begin;
select plan(6);

select has_table('availability_blocks');
select columns_are('availability_blocks', array[
  'id', 'property_id', 'start_date', 'end_date', 'reason', 'booking_id', 'created_at'
]);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';

select lives_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-05', '2026-10-07', 'manual_block' from properties where slug = 'deluxe-cabin' $$,
  'can insert a manual block'
);

select throws_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-06', '2026-10-09', 'manual_block' from properties where slug = 'deluxe-cabin' $$,
  '23P01'::char(5),
  null,
  'an overlapping date range on the same property is rejected'
);

select lives_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-07', '2026-10-10', 'manual_block' from properties where slug = 'deluxe-cabin' $$,
  'a non-overlapping, back-to-back date range is allowed (end_date is exclusive)'
);

insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Garden Room', 'garden-room', 2, 5000 from organizations where slug = 'hunza-view';
select lives_ok(
  $$ insert into availability_blocks (property_id, start_date, end_date, reason)
     select id, '2026-10-05', '2026-10-07', 'manual_block' from properties where slug = 'garden-room' $$,
  'the same date range on a different property is allowed'
);

select * from finish();
rollback;
