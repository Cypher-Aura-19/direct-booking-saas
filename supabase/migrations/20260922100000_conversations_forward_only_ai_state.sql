-- Closes a flip-flop evasion of the messages.forbid_ai_message_during_payment
-- trigger (20260922060000): without this, a conversation could be moved out
-- of payment state, given an ai message, then moved back into payment state,
-- landing an ai-sender message on a payment-state conversation despite that
-- trigger.
--
-- The state machine is fully forward-only and terminal at `stay` for
-- Phase 1's purposes: enquiry -> payment -> stay, and once a conversation
-- reaches `stay` its ai_state can never change again. The first version of
-- this trigger only forbade leaving `payment` for anything but `stay`,
-- which left `stay` itself non-terminal — a conversation could still be
-- driven payment -> stay -> enquiry -> (ai message) -> payment, landing an
-- ai message on a payment-state conversation via a four-step detour instead
-- of the original three-step one. Forbidding any transition out of `stay`
-- closes that path too. This matches PAY-05 (in stay state the AI escalates
-- rather than answers): stay is meant to be a terminal, restricted state,
-- not one that cycles back through enquiry/payment handling.
create or replace function public.enforce_forward_only_ai_state()
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
  if old.ai_state = 'stay' and new.ai_state <> 'stay' then
    raise exception 'a conversation cannot leave stay state once reached'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger conversations_forbid_leaving_payment
  before update on public.conversations
  for each row
  execute function public.enforce_forward_only_ai_state();
