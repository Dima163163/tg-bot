-- Run against the migrated project. All synthetic rows are rolled back.
begin;
do $$
declare
  update_id bigint := -floor(random() * 9000000000000000 + 1)::bigint;
  user_id text := 'rag-lease-test-' || gen_random_uuid()::text;
  attempt_a uuid := gen_random_uuid();
  attempt_b uuid := gen_random_uuid();
  row_count_before bigint;
  client_id_value bigint;
begin
  perform public.save_telegram_message(update_id, user_id, 'RAG test', null, 'test', 'test', now());
  select id into client_id_value from public.clients where user_telegram_id = user_id;
  if public.claim_telegram_reply(update_id, attempt_a) <> 'claimed' then raise exception 'First claim failed'; end if;
  if public.claim_telegram_reply(update_id, attempt_b) <> 'busy' then raise exception 'Concurrent claim was allowed'; end if;
  perform public.fail_telegram_reply(update_id, attempt_b);
  if public.claim_telegram_reply(update_id, attempt_b) <> 'busy' then raise exception 'Foreign attempt released lease'; end if;
  perform public.fail_telegram_reply(update_id, attempt_a);
  if public.claim_telegram_reply(update_id, attempt_b) <> 'claimed' then raise exception 'Retry claim failed'; end if;
  begin
    perform public.complete_telegram_reply(update_id, attempt_a, user_id, 'stale reply', now());
    raise exception 'Stale completion succeeded';
  exception when others then
    if sqlerrm <> 'Reply lease was lost' then raise; end if;
  end;
  select count(*) into row_count_before from public.messages where client_id = client_id_value;
  perform public.complete_telegram_reply(update_id, attempt_b, user_id, 'reply', now());
  perform public.complete_telegram_reply(update_id, attempt_b, user_id, 'reply', now());
  if (select count(*) from public.messages where client_id = client_id_value) <> row_count_before + 1 then
    raise exception 'Reply was not saved exactly once';
  end if;
  if public.claim_telegram_reply(update_id, attempt_a) <> 'sent' then raise exception 'Completed duplicate was not skipped'; end if;
  if has_function_privilege('anon', 'public.claim_telegram_reply(bigint,uuid)', 'execute')
    or has_function_privilege('authenticated', 'public.complete_telegram_reply(bigint,uuid,text,text,timestamptz)', 'execute') then
    raise exception 'Reply RPC is exposed to browser roles';
  end if;
end;
$$;
rollback;
