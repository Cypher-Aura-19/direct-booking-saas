begin;
select plan(6);

select has_table('bookings');
select columns_are('bookings', array[
  'id', 'organization_id', 'property_id', 'guest_id', 'conversation_id',
  'check_in', 'check_out', 'guest_count', 'total_price_pkr', 'advance_amount_pkr',
  'status', 'payment_confirmed_at', 'payment_confirmed_by', 'created_at'
]);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';
insert into conversations (organization_id, property_id, guest_id)
select o.id, p.id, g.id from organizations o, properties p, guests g
where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567';

select lives_ok(
  $$ insert into bookings (organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr)
     select o.id, p.id, g.id, c.id, '2026-10-05', '2026-10-07', 2, 16000, 4000
     from organizations o, properties p, guests g, conversations c
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  'can insert a valid booking'
);

select col_has_default('bookings', 'status');
select is(
  (select status from bookings limit 1), 'requested', 'status defaults to requested'
);

select throws_ok(
  $$ insert into bookings (organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr)
     select o.id, p.id, g.id, c.id, '2026-10-07', '2026-10-05', 2, 16000, 4000
     from organizations o, properties p, guests g, conversations c
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  '23514'::char(5),
  null,
  'check_out before check_in is rejected'
);

select * from finish();
rollback;
