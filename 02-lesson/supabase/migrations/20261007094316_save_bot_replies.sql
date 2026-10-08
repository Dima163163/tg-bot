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
