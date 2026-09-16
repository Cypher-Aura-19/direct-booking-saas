begin;
select plan(6);

select ok(
  (select relrowsecurity from pg_class where relname = 'properties' and relnamespace = 'public'::regnamespace),
  'row level security is enabled on properties'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'guests' and relnamespace = 'public'::regnamespace),
  'row level security is enabled on guests'
);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into organizations (owner_user_id, name, slug, contact_phone, contact_name)
values
  ('11111111-1111-1111-1111-111111111111', 'Hunza View Guesthouse', 'hunza-view', '03001234567', 'Ali Khan'),
  ('22222222-2222-2222-2222-222222222222', 'Naran Cabins', 'naran-cabins', '03009999999', 'Sara Ahmed');

insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr, status)
select id, 'Deluxe Cabin', 'deluxe-cabin', 4, 8000, 'published' from organizations where slug = 'hunza-view';
insert into properties (organization_id, name, slug, max_guests, nightly_rate_pkr, status)
select id, 'Hidden Draft', 'hidden-draft', 4, 8000, 'draft' from organizations where slug = 'hunza-view';

insert into guests (organization_id, phone, name)
select id, '03211234567', 'Bilal' from organizations where slug = 'hunza-view';
insert into guests (organization_id, phone, name)
select id, '03221234567', 'Zara' from organizations where slug = 'naran-cabins';

set local role anon;

select results_eq(
  $$ select slug from properties order by slug $$,
  $$ values ('deluxe-cabin'::text) $$,
  'anon can see only published properties'
);

select is_empty(
  $$ select 1 from guests $$,
  'anon sees zero rows in guests regardless of RLS filtering'
);

reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111"}';

select results_eq(
  $$ select phone from guests order by phone $$,
  $$ values ('03211234567'::text) $$,
  'host A sees only their own organization''s guests'
);

select results_eq(
  $$ select slug from properties order by slug $$,
  $$ values ('deluxe-cabin'::text), ('hidden-draft'::text) $$,
  'host A sees both their own published and draft properties'
);

reset role;

select * from finish();
rollback;
