-- 0133 (INV-04, #375): invite_check(), the anonymous look at an invite code or link behind fn:invite, for the
-- pickld.me/i/<id> page and the code field at Sign up. Additive only: one function.
--
-- Only fn:invite calls it, with the server credential and an HMAC of the visitor's IP (the IP itself never
-- reaches Postgres). 20 checks per IP hash an hour, counted in invite_attempts under ip:<hash> (0132).
-- A check never uses the code, and the answer never says how many codes are left: a code or link either
-- works now or is unavailable, with one answer for every reason (unknown, used, expired, switched off, frozen,
-- locked, or the owner isn't active).
--
-- Returns { result } where result is:
--   ok           kind is personal, waitlist or admin; inviter is { id, username, display_name, avatar_path }
--                for a personal code or link, else null. fn:invite signs the avatar and drops the id.
--   unavailable  the code or link can't be used now
--   limited      20 checks from this IP hash in the last hour
create or replace function public.invite_check(p_token text, p_ip_hash text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  attempt_key text;
  v_code text;
  v_kind invite_kind;
  v_owner uuid;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'an IP hash is required' using errcode = '22023';
  end if;
  attempt_key := 'ip:' || p_ip_hash;

  perform pg_advisory_xact_lock(hashtextextended('invite_attempt:' || attempt_key, 0));
  delete from invite_attempts where key = attempt_key and created_at <= now() - interval '1 hour';
  if (select count(*) from invite_attempts where key = attempt_key) >= 20 then
    return jsonb_build_object('result', 'limited');
  end if;
  insert into invite_attempts (key) values (attempt_key);

  select u.code, u.kind, u.owner_id into v_code, v_kind, v_owner from invite_usable_code(p_token, false) u;
  if v_code is null then
    return jsonb_build_object('result', 'unavailable');
  end if;

  return jsonb_build_object(
    'result', 'ok',
    'kind', v_kind,
    'inviter', case when v_kind = 'personal' then (
      select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                                'avatar_path', p.avatar_path)
      from profiles p where p.id = v_owner) end);
end $$;
comment on function public.invite_check(text, text) is
  'fn:invite only: whether an invite code or link works now, and whose it is (INV-04). 20 per IP hash an hour.';

revoke execute on function public.invite_check(text, text) from public, anon, authenticated;
grant execute on function public.invite_check(text, text) to service_role;
