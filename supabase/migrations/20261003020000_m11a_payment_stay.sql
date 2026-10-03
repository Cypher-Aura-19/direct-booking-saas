-- ---------------------------------------------------------------------------
-- M11a payment, stay and check-in/out. No table, column, RLS or grant change:
-- these are security invoker functions, so the existing bookings_all_own /
-- conversations_all_own / messages_all_own policies (M2) gate them exactly as
-- they gate a direct update by the host.
-- ---------------------------------------------------------------------------

-- Mark paid: booking -> paid, conversation payment -> stay (the AI resumes),
-- then ONE fixed-template acknowledgement. The acknowledgement is inserted
-- AFTER the flip: messages_forbid_ai_during_payment only blocks AI messages
-- while the conversation is in 'payment', so this is permitted and that
-- trigger is left exactly as it was. Not model output.
create function public.mark_booking_paid(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = booking_id for update;
  if not found then
    raise exception 'booking not found' using errcode = 'P0002';
  end if;
  if b.status <> 'approved' then
    raise exception 'booking is not awaiting payment' using errcode = '55000';
  end if;

  update public.bookings set status = 'paid' where id = b.id;

  if b.conversation_id is not null then
    update public.conversations set ai_state = 'stay' where id = b.conversation_id;
    insert into public.messages (conversation_id, sender, body)
    values (
      b.conversation_id,
      'ai',
      'Payment received - you''re confirmed. Ask me anything about check-in or the house.'
    );
  end if;
end;
$$;

-- Check in / check out only move the booking along the pipeline. The
-- conversation stays in 'stay' (terminal), and there is deliberately no date
-- gating: early arrivals and late departures are the host's call.
create function public.check_in_booking(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated integer;
begin
  update public.bookings set status = 'staying' where id = booking_id and status = 'paid';
  get diagnostics updated = row_count;
  if updated = 0 then
    perform 1 from public.bookings where id = booking_id;
    if not found then
      raise exception 'booking not found' using errcode = 'P0002';
    end if;
    raise exception 'booking is not ready to check in' using errcode = '55000';
  end if;
end;
$$;

create function public.check_out_booking(booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated integer;
begin
  update public.bookings set status = 'checked_out' where id = booking_id and status = 'staying';
  get diagnostics updated = row_count;
  if updated = 0 then
    perform 1 from public.bookings where id = booking_id;
    if not found then
      raise exception 'booking not found' using errcode = 'P0002';
    end if;
    raise exception 'booking is not ready to check out' using errcode = '55000';
  end if;
end;
$$;

-- Supabase grants EXECUTE to anon by name at creation time regardless of
-- `revoke ... from public` (the gotcha 20260925010000 documents).
revoke execute on function public.mark_booking_paid(uuid) from public, anon;
revoke execute on function public.check_in_booking(uuid) from public, anon;
revoke execute on function public.check_out_booking(uuid) from public, anon;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.check_in_booking(uuid) to authenticated;
grant execute on function public.check_out_booking(uuid) to authenticated;
