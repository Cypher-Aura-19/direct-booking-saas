create table organizations (
  id                 uuid primary key default gen_random_uuid(),
  owner_user_id      uuid not null references auth.users(id),
  name               text not null,
  slug               text not null unique,
  contact_phone      text not null,
  contact_name       text not null,
  contact_photo_url  text,
  bio                text,
  created_at         timestamptz not null default now()
);
