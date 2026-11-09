-- Objects created by postgres in public must require explicit API grants.
-- Existing grants and RLS policies, including operator Realtime access, remain intact.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
