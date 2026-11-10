-- 0006 — Anonymous visitors read nothing from public tables (NFR-SEC-01; FR-PUB-05, FR-PUB-06; M1-11).
-- Additive only: no column is dropped or renamed.
--
-- Supabase grants anon full table privileges on schema public by default, so RLS was the only thing
-- between anon and the data. follows_select doesn't name a role, so anon could read every follows row
-- (who reads whom). Anonymous visitors (the pickld.me web page) get data only through narrow
-- `security definer` RPCs that return Everyone, live, non-private content (decision C-6).

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Tables and sequences created later by migrations (role postgres) don't get anon grants either.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- The security definer visibility helpers answer questions about other users (for example whether two
-- users blocked each other). Policies call them as the signed-in user; anon has no reason to call them.
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
revoke execute on function public.can_view_jar(uuid, public.jars) from public, anon;
revoke execute on function public.can_view_moment(uuid, public.moments) from public, anon;
revoke execute on function public.can_view_target(uuid, target_type, uuid) from public, anon;
revoke execute on function public.can_appeal(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_jar(uuid, public.jars) to authenticated, service_role;
grant execute on function public.can_view_moment(uuid, public.moments) to authenticated, service_role;
grant execute on function public.can_view_target(uuid, target_type, uuid) to authenticated, service_role;
grant execute on function public.can_appeal(uuid, uuid) to authenticated, service_role;
