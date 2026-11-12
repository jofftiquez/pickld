-- 0023 — account_purge() for fn:account-purge (M4-03; FR-ACC-04, G-20). Additive: one function, nothing
-- dropped or renamed.
--
-- Someone who enters a birthday under 13 must leave nothing behind (COPPA), including the auth record.
-- In the sign-up flow they never get a profile: the Under 13 screen purges before anything is written,
-- profiles refuses an under-13 birthday (0001 check), and without an active profile nothing else can be
-- written or uploaded (D-11). So this function purges only an auth user with no profile row, and refuses
-- (returns false, touches nothing) when one exists: it can never delete an established account (deleting
-- an account from Settings is a separate flow, FR-ACC-06). The check is atomic: the auth.users row is
-- locked FOR UPDATE, which a concurrent profiles insert (its foreign-key check takes KEY SHARE) waits on.
--
-- Besides the auth.users row (which cascades to identities, sessions, one-time tokens, MFA and so on), it
-- deletes what doesn't cascade and still names the user:
--   * auth.refresh_tokens and auth.flow_state rows (no foreign key to auth.users)
--   * auth.audit_log_entries naming the user by id or email (the sign-up, logins, magic links)
-- All in one transaction: a failure leaves everything in place for a retry. Photos are not in Postgres:
-- fn:account-purge sweeps the user's bucket prefixes first.
create or replace function public.account_purge(p_user uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_user for update;
  if exists (select 1 from profiles where id = p_user) then
    return false;
  end if;

  delete from auth.refresh_tokens where user_id = p_user::text;
  delete from auth.flow_state where user_id = p_user;
  delete from auth.users where id = p_user;
  delete from auth.audit_log_entries
  where payload->>'actor_id' = p_user::text
     or payload->'traits'->>'user_id' = p_user::text
     or (v_email is not null and (payload->>'actor_username' = v_email or payload->'traits'->>'user_email' = v_email));
  return true;
end $$;
comment on function public.account_purge(uuid) is
  'Deletes a profile-less auth user and every auth row naming them; false (nothing touched) if they have a profile (0023). fn:account-purge only.';

revoke execute on function public.account_purge(uuid) from public, anon, authenticated;
grant execute on function public.account_purge(uuid) to service_role;
