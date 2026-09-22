-- Closes a flip-flop evasion of the messages.forbid_ai_message_during_payment
-- trigger (20260922060000): without this, a conversation could be moved out
-- of payment state, given an ai message, then moved back into payment state,
-- landing an ai-sender message on a payment-state conversation despite that
-- trigger. This does not fully specify the state machine (that is M10's job
-- when the approval/payment flow is built) — it only forbids the one
-- backward transition that would undermine the payment-state safety net.
create function public.enforce_forward_only_ai_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.ai_state = 'payment' and new.ai_state not in ('payment', 'stay') then
    raise exception 'a conversation cannot leave payment state except by moving to stay'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger conversations_forbid_leaving_payment
  before update on public.conversations
  for each row
  execute function public.enforce_forward_only_ai_state();
