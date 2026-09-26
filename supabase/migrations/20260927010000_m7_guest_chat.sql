-- M7 guest chat. Guests never touch these tables directly: every guest read
-- and write goes through a Server Action using the service role, authorised by
-- the conversation token (spec §4, AI-17). Anon therefore gets nothing.
revoke all on public.conversations from anon;
revoke all on public.messages from anon;

alter table public.messages
  add constraint messages_body_length check (char_length(body) between 1 and 4000);
