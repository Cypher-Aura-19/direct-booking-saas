-- ---------------------------------------------------------------------------
-- M10 booking approval. No new RLS policy: the existing bookings_all_own /
-- availability_blocks_all_own / messages_all_own / conversations policies (M2)
-- are exactly what gate these functions, because they are security invoker
-- and so run as the calling host.
-- ---------------------------------------------------------------------------

-- Defense in depth. Supabase grants anon every privilege on a new public table
-- by default, which left RLS (no anon policy) as the only wall in front of
-- guest names and phone numbers — and, from M11, CNIC records. conversations
-- and messages already revoke this (M7); bookings, guests and guest_documents
-- did not. Guest-side reads and writes go through the service-role client.
revoke all on public.bookings from anon;
revoke all on public.guests from anon;
revoke all on public.guest_documents from anon;

alter table public.bookings
  add column block_id uuid references public.availability_blocks (id) on delete set null;

-- One open (requested or approved) booking per conversation: the spam guard.
create unique index bookings_one_open_per_conversation
  on public.bookings (conversation_id)
  where status in ('requested', 'approved');

-- Approve: lock the dates, move the conversation into payment, acknowledge —
-- all or nothing. The acknowledgement is inserted BEFORE the state flip: the
-- M2 trigger forbids AI messages only while the conversation is already in
-- 'payment', so this order keeps that trigger fully intact. It is a fixed
-- template, not model output.
create function public.approve_booking(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.bookings%rowtype;
  new_block uuid;
begin
  select * into b from public.bookings where id = booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.status <> 'requested' then
    raise exception 'booking is not awaiting a decision' using errcode = '55000';
  end if;

  -- An overlap raises 23P01 (exclusion_violation) and aborts everything.
  insert into public.availability_blocks (property_id, start_date, end_date, reason)
  values (b.property_id, b.start_date, b.end_date, 'booking')
  returning id into new_block;

  update public.bookings set status = 'approved', block_id = new_block where id = b.id;

  if b.conversation_id is not null then
    insert into public.messages (conversation_id, sender, body)
    values (
      b.conversation_id,
      'ai',
      format(
        'Your request for %s to %s has been approved by the host. The payment details are on your booking card; the host will take it from here.',
        to_char(b.start_date, 'DD Mon'),
        to_char(b.end_date, 'DD Mon')
      )
    );
    update public.conversations set ai_state = 'payment' where id = b.conversation_id;
  end if;
end;
$$;

-- Reject: only flips the status. The calendar, the conversation state and the
-- messages are deliberately untouched (BOOK-10).
create function public.reject_booking(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated integer;
begin
  update public.bookings set status = 'rejected' where id = booking_id and status = 'requested';
  get diagnostics updated = row_count;
  if updated = 0 then
    -- Invisible-to-this-host (RLS) and already-decided both read as "no row
    -- updated"; tell them apart so the UI can say the right thing.
    perform 1 from public.bookings where id = booking_id;
    if not found then
      raise exception 'booking not found' using errcode = 'P0002';
    end if;
    raise exception 'booking is not awaiting a decision' using errcode = '55000';
  end if;
end;
$$;

-- Supabase grants EXECUTE to anon by name at creation time regardless of the
-- `revoke ... from public` (the gotcha 20260925010000 documents), so anon is
-- revoked explicitly.
revoke execute on function public.approve_booking(uuid) from public, anon;
revoke execute on function public.reject_booking(uuid) from public, anon;
grant execute on function public.approve_booking(uuid) to authenticated;
grant execute on function public.reject_booking(uuid) to authenticated;
