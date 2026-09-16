begin;
select plan(4);

select has_table('messages');
select columns_are('messages', array['id', 'conversation_id', 'sender', 'body', 'created_at']);

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
  $$ insert into messages (conversation_id, sender, body)
     select id, 'guest', 'Is Oct 5-7 available?' from conversations limit 1 $$,
  'can insert a guest message'
);
select lives_ok(
  $$ insert into messages (conversation_id, sender, body)
     select id, 'ai', 'Yes, those dates are available at PKR 8,000/night.' from conversations limit 1 $$,
  'can insert an ai message'
);

select * from finish();
rollback;
