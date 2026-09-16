begin;
select plan(2);

select has_extension('pgcrypto');
select has_extension('btree_gist');

select * from finish();
rollback;
