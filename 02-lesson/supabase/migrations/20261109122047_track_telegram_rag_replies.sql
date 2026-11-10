begin;

-- Lease one reply attempt per Telegram update; retain the existing message log.
alter table public.messages
  add column telegram_reply_state text,
  add column telegram_reply_attempt uuid,
  add column telegram_reply_started_at timestamptz,
  add constraint messages_telegram_reply_state_check check (
    telegram_reply_state is null or telegram_reply_state in ('processing', 'sent', 'failed')
  );

create function public.claim_telegram_reply(p_update_id bigint, p_attempt uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare current_state text;
begin
  if p_attempt is null then raise exception 'Reply attempt is required'; end if;
  update public.messages set
    telegram_reply_state = 'processing', telegram_reply_attempt = p_attempt,
    telegram_reply_started_at = clock_timestamp()
  where telegram_update_id = p_update_id and messenger_type = 'telegram'
    and (telegram_reply_state is null or telegram_reply_state = 'failed'
      or (telegram_reply_state = 'processing'
        and telegram_reply_started_at < clock_timestamp() - interval '2 minutes'));
  if found then return 'claimed'; end if;
  select telegram_reply_state into current_state from public.messages
    where telegram_update_id = p_update_id and messenger_type = 'telegram';
  if not found then raise exception 'Incoming message is missing'; end if;
  if current_state = 'sent' then return 'sent'; end if;
  return 'busy';
end;
$$;

create function public.complete_telegram_reply(
  p_update_id bigint, p_attempt uuid, p_user_id text, p_body text, p_sent_at timestamptz
) returns void language plpgsql security invoker set search_path = '' as $$
declare incoming public.messages%rowtype;
begin
  select * into incoming from public.messages
    where telegram_update_id = p_update_id for update;
  if not found or incoming.messenger_type <> 'telegram'
    or incoming.messenger_user_id is distinct from p_user_id then
    raise exception 'Incoming message does not match reply';
  end if;
  if incoming.telegram_reply_state = 'sent' then return; end if;
  if incoming.telegram_reply_state is distinct from 'processing'
    or incoming.telegram_reply_attempt is distinct from p_attempt then
    raise exception 'Reply lease was lost';
  end if;
  perform public.save_telegram_bot_reply(p_user_id, p_body, p_sent_at);
  update public.messages set telegram_reply_state = 'sent' where id = incoming.id;
end;
$$;

create function public.fail_telegram_reply(p_update_id bigint, p_attempt uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.messages set telegram_reply_state = 'failed'
  where telegram_update_id = p_update_id and telegram_reply_attempt = p_attempt
    and telegram_reply_state = 'processing';
$$;

revoke all on function public.claim_telegram_reply(bigint, uuid) from public, anon, authenticated;
revoke all on function public.complete_telegram_reply(bigint, uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_telegram_reply(bigint, uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_reply(bigint, uuid) to service_role;
grant execute on function public.complete_telegram_reply(bigint, uuid, text, text, timestamptz) to service_role;
grant execute on function public.fail_telegram_reply(bigint, uuid) to service_role;

commit;
