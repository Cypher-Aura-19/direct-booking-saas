begin;
select plan(4);

select has_table('guest_documents');
select columns_are('guest_documents', array[
  'id', 'booking_id', 'organization_id', 'document_type', 'storage_path',
  'guest_full_name', 'guest_phone', 'uploaded_at', 'retention_expires_at'
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
insert into bookings (organization_id, property_id, guest_id, conversation_id, check_in, check_out, guest_count, total_price_pkr, advance_amount_pkr)
select o.id, p.id, g.id, c.id, '2026-10-05', '2026-10-07', 2, 16000, 4000
from organizations o, properties p, guests g, conversations c
where o.slug = 'hunza-view' and p.slug = 'deluxe-cabin' and g.phone = '03211234567';

select lives_ok(
  $$ insert into guest_documents (booking_id, organization_id, document_type, storage_path, guest_full_name, retention_expires_at)
     select b.id, o.id, 'cnic', 'cnic/2026/10/bilal.jpg', 'Bilal Ahmed', now() + interval '90 days'
     from bookings b, organizations o where o.slug = 'hunza-view' $$,
  'can insert a guest document with a retention expiry'
);
select is(
  (select document_type from guest_documents limit 1), 'cnic', 'document_type is stored as given'
);

select * from finish();
rollback;
