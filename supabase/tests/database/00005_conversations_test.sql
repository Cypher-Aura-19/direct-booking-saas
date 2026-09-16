begin;
select plan(8);

select has_table('conversations');
select columns_are('conversations', array[
  'id', 'organization_id', 'property_id', 'guest_id',
  'ai_state', 'ai_enabled', 'ai_disabled_reason', 'last_message_at', 'created_at'
]);

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000 from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';

select lives_ok(
  $$ insert into conversations (organization_id, property_id, guest_id)
     select o.id, p.id, g.id
     from organizations o, properties p, guests g
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  'can insert a conversation with just organization/property/guest'
);
select is(
  (select ai_state from conversations limit 1), 'enquiry', 'ai_state defaults to enquiry'
);
select is(
  (select ai_enabled from conversations limit 1), true, 'ai_enabled defaults to true'
);

select throws_ok(
  $$ insert into conversations (organization_id, property_id, guest_id)
     select o.id, p.id, g.id
     from organizations o, properties p, guests g
     where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567' $$,
  '23505'::char(5),
  null,
  'a second conversation for the same guest+property is rejected'
);

select throws_ok(
  $$ update conversations set ai_state = 'payment', ai_enabled = true $$,
  '23514'::char(5),
  null,
  'ai_state=payment with ai_enabled=true violates the check constraint'
);
select lives_ok(
  $$ update conversations set ai_state = 'payment', ai_enabled = false $$,
  'ai_state=payment with ai_enabled=false is allowed'
);

select * from finish();
rollback;
