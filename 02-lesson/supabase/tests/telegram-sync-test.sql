-- Checks run in a transaction; no test clients or messages are retained.
begin;
set local role service_role;

do $$
declare
  test_user_id text := '__telegram_sync_test_' || txid_current();
  test_update_id bigint := -txid_current() * 10;
  client_row public.clients%rowtype;
begin
  perform public.save_telegram_message(test_update_id, test_user_id, 'First', null,
    'test_author', 'First message', '2026-09-17T10:00:00Z');
  perform public.save_telegram_message(test_update_id, test_user_id, 'First', null,
    'test_author', 'First message', '2026-09-17T10:00:00Z');

  if (select count(*) from public.messages where telegram_update_id = test_update_id) <> 1 then
    raise exception 'Repeated delivery created a duplicate message';
  end if;

  perform public.save_telegram_message(test_update_id - 1, test_user_id, 'Updated', 'Name',
    'test_author', 'Second message', '2026-09-17T11:00:00Z');
  perform public.save_telegram_message(test_update_id - 2, test_user_id, 'Older', null,
    'test_author', null, '2026-09-17T09:00:00Z');
  perform public.save_telegram_bot_reply(test_user_id, 'Bot reply', '2026-09-17T11:01:00Z');

  if (select count(*) from public.clients where user_telegram_id = test_user_id) <> 1 then
    raise exception 'Multiple messages created duplicate clients';
  end if;

  select * into strict client_row from public.clients where user_telegram_id = test_user_id;
  if client_row.first_name <> 'Updated' or client_row.last_name <> 'Name'
    or client_row.last_message_at <> timestamp '2026-09-17 11:01:00' then
    raise exception 'An older message replaced the latest client data';
  end if;
  if (select count(*) from public.messages where client_id = client_row.id) <> 4 then
    raise exception 'Messages were not linked to the same client';
  end if;
  if not exists (
    select 1 from public.messages where telegram_update_id = test_update_id
      and messenger_user_id = test_user_id and messenger_type = 'telegram'
      and body = 'First message' and author = 'test_author'
      and created_at = timestamptz '2026-09-17T10:00:00Z'
  ) then
    raise exception 'Message fields were not saved correctly';
  end if;
  if not exists (
    select 1 from public.messages where client_id = client_row.id
      and author = 'bot' and body = 'Bot reply'
      and messenger_user_id is null and messenger_type = 'telegram_bot'
      and created_at = timestamptz '2026-09-17T11:01:00Z'
  ) then
    raise exception 'Bot reply was not saved correctly';
  end if;
  if has_function_privilege('anon',
    'public.save_telegram_message(bigint,text,text,text,text,text,timestamptz)', 'execute') then
    raise exception 'Anonymous callers must not execute the storage RPC';
  end if;
  if has_function_privilege('anon',
    'public.save_telegram_bot_reply(text,text,timestamptz)', 'execute') then
    raise exception 'Anonymous callers must not execute the bot reply RPC';
  end if;
end;
$$;

rollback;
select 'Telegram storage checks passed; test rows rolled back' as result;
