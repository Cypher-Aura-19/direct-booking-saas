create table guest_documents (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references bookings(id),
  organization_id       uuid not null references organizations(id),
  document_type         text not null,
  storage_path          text not null,
  guest_full_name       text not null,
  guest_phone           text,
  uploaded_at           timestamptz not null default now(),
  retention_expires_at  timestamptz
);
