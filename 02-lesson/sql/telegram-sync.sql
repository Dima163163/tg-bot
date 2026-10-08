-- Run once against the same project as the webhook Edge Function.
begin;

create unique index if not exists clients_user_telegram_id_key
  on public.clients (user_telegram_id);

alter table public.messages
  add column if not exists telegram_update_id bigint;

create unique index if not exists messages_telegram_update_id_key
  on public.messages (telegram_update_id);

-- Supports the client_id + created_at/id cursor used by the messages function.
create index if not exists messages_client_created_id_idx
  on public.messages (client_id, created_at desc, id desc);

-- A single transaction saves both the client and the message.
create or replace function public.save_telegram_message(
  p_update_id bigint,
  p_user_id text,
  p_first_name text,
  p_last_name text,
  p_author text,
  p_body text,
  p_sent_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_client_id bigint;
begin
  insert into public.clients (user_telegram_id, first_name, last_name, last_message_at)
  values (p_user_id, p_first_name, p_last_name, p_sent_at at time zone 'UTC')
  on conflict (user_telegram_id) do update set
    first_name = case when excluded.last_message_at >= clients.last_message_at
      then excluded.first_name else clients.first_name end,
    last_name = case when excluded.last_message_at >= clients.last_message_at
      then excluded.last_name else clients.last_name end,
    last_message_at = greatest(clients.last_message_at, excluded.last_message_at)
  returning id into saved_client_id;

  insert into public.messages (
    telegram_update_id, created_at, author, body,
    messenger_user_id, messenger_type, client_id
  ) values (
    p_update_id, p_sent_at, p_author, p_body,
    p_user_id, 'telegram', saved_client_id
  )
  on conflict (telegram_update_id) do nothing;
end;
$$;

-- Only the server's admin client may write through this RPC.
revoke all on function public.save_telegram_message(bigint, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_telegram_message(bigint, text, text, text, text, text, timestamptz)
  to service_role;

create or replace function public.save_telegram_bot_reply(
  p_user_id text,
  p_body text,
  p_sent_at timestamptz
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_client_id bigint;
begin
  select id into saved_client_id
  from public.clients
  where user_telegram_id = p_user_id;

  if saved_client_id is null then
    raise exception 'Telegram client % was not found', p_user_id;
  end if;

  update public.clients
  set last_message_at = greatest(last_message_at, p_sent_at at time zone 'UTC')
  where id = saved_client_id;

  insert into public.messages (
    created_at, author, body, messenger_user_id, messenger_type, client_id
  ) values (
    p_sent_at, 'bot', p_body, null, 'telegram_bot', saved_client_id
  );
end;
$$;

revoke all on function public.save_telegram_bot_reply(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.save_telegram_bot_reply(text, text, timestamptz)
  to service_role;

-- Keep the manual setup path in sync with the Supabase migration.
alter table public.messages enable row level security;
grant select on table public.messages to anon;

drop policy if exists "anon can read messages for realtime" on public.messages;
create policy "anon can read messages for realtime"
  on public.messages
  for select
  to anon
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;

commit;
