begin;

-- The messenger's read endpoints are already public, so anon clients need the
-- same read access to receive message INSERT events through Supabase Realtime.
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
