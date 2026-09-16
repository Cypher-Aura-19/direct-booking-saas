create schema if not exists private;

create or replace function private.owned_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from organizations where owner_user_id = auth.uid();
$$;

-- organizations: public profile info is meant to be visible (host name/photo/phone
-- are a deliberate trust feature), only the owner can modify it.
alter table organizations enable row level security;

create policy "public can view organizations"
  on organizations for select
  to anon, authenticated
  using (true);

create policy "owner can manage their organization"
  on organizations for all
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- properties: public can see only published listings; the owning host sees/manages all.
alter table properties enable row level security;

create policy "public can view published properties"
  on properties for select
  to anon, authenticated
  using (status = 'published');

create policy "host can manage their own properties"
  on properties for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

-- property_photos: visible whenever the parent property is publicly visible.
alter table property_photos enable row level security;

create policy "public can view photos of published properties"
  on property_photos for select
  to anon, authenticated
  using (exists (
    select 1 from properties p
    where p.id = property_photos.property_id and p.status = 'published'
  ));

create policy "host can manage photos of their own properties"
  on property_photos for all
  to authenticated
  using (exists (
    select 1 from properties p
    where p.id = property_photos.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from properties p
    where p.id = property_photos.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ));

-- availability_blocks: guests need to see blocked dates on a published property's
-- calendar before requesting a booking.
alter table availability_blocks enable row level security;

create policy "public can view availability of published properties"
  on availability_blocks for select
  to anon, authenticated
  using (exists (
    select 1 from properties p
    where p.id = availability_blocks.property_id and p.status = 'published'
  ));

create policy "host can manage availability of their own properties"
  on availability_blocks for all
  to authenticated
  using (exists (
    select 1 from properties p
    where p.id = availability_blocks.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from properties p
    where p.id = availability_blocks.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ));

-- seasonal_pricing_rules: guests need to see priced-in date ranges to get a correct quote.
alter table seasonal_pricing_rules enable row level security;

create policy "public can view pricing of published properties"
  on seasonal_pricing_rules for select
  to anon, authenticated
  using (exists (
    select 1 from properties p
    where p.id = seasonal_pricing_rules.property_id and p.status = 'published'
  ));

create policy "host can manage pricing of their own properties"
  on seasonal_pricing_rules for all
  to authenticated
  using (exists (
    select 1 from properties p
    where p.id = seasonal_pricing_rules.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from properties p
    where p.id = seasonal_pricing_rules.property_id
      and p.organization_id in (select private.owned_organization_ids())
  ));

-- guests, conversations, messages, bookings, guest_documents: never publicly readable
-- or writable. Guest-facing access goes through server routes using the service role
-- key (which bypasses RLS). These policies exist only for the authenticated host dashboard.

alter table guests enable row level security;

create policy "host can manage their own guests"
  on guests for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

alter table conversations enable row level security;

create policy "host can manage their own conversations"
  on conversations for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

alter table messages enable row level security;

create policy "host can manage messages in their own conversations"
  on messages for all
  to authenticated
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and c.organization_id in (select private.owned_organization_ids())
  ))
  with check (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and c.organization_id in (select private.owned_organization_ids())
  ));

alter table bookings enable row level security;

create policy "host can manage their own bookings"
  on bookings for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));

alter table guest_documents enable row level security;

create policy "host can manage their own guest documents"
  on guest_documents for all
  to authenticated
  using (organization_id in (select private.owned_organization_ids()))
  with check (organization_id in (select private.owned_organization_ids()));
