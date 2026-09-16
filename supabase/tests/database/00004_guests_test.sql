begin;
select plan(5);

select has_table('guests');
select columns_are('guests', array['id', 'organization_id', 'phone', 'name', 'created_at']);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan');

select lives_ok(
  $$ insert into guests (organization_id, phone, name)
     select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view' $$,
  'can insert a guest with just a phone number and name'
);

select throws_ok(
  $$ insert into guests (organization_id, phone, name)
     select id, '03211234567', 'Bilal Again' from organizations where slug = 'hunza-view' $$,
  '23505'::char(5),
  null,
  'duplicate phone within the same organization is rejected'
);

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values ('22222222-2222-2222-2222-222222222222', 'Naran Cabins', 'naran-cabins', '03009999999', 'Sara Ahmed');

select lives_ok(
  $$ insert into guests (organization_id, phone, name)
     select id, '03211234567', 'Bilal' from organizations where slug = 'naran-cabins' $$,
  'same phone number is allowed under a different organization'
);

select * from finish();
rollback;
