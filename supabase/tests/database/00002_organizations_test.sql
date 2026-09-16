begin;
select plan(6);

select has_table('organizations');
select columns_are('organizations', array[
  'id', 'owner_user_id', 'name', 'slug',
  'contact_phone', 'contact_name', 'contact_photo_url', 'bio',
  'created_at'
]);
select col_is_pk('organizations', 'id');

-- auth.users fixtures: organizations.owner_user_id is a real FK, so every owner
-- referenced in these tests must exist there first.
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

select lives_ok(
  $$ insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
     values ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan') $$,
  'can insert a valid organization'
);
select throws_ok(
  $$ insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
     values ('22222222-2222-2222-2222-222222222222', 'Other Host', 'hunza-view', '03007654321', 'Sara Ahmed') $$,
  '23505'::char(5),
  null,
  'duplicate slug is rejected'
);
select throws_ok(
  $$ insert into organizations (owner_user_id, slug, contact_phone, contact_name)
     values ('22222222-2222-2222-2222-222222222222', 'no-name-org', '03001111111', 'No Name') $$,
  '23502'::char(5),
  null,
  'name is required'
);

select * from finish();
rollback;
