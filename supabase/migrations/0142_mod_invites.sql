-- 0142 (INV-10, #381): the console's Invite codes page and the invite part of a user's page. Additive: one
-- column (invite_codes.note) and five moderator functions; nothing is dropped or renamed.
--
--   mod_invite_codes()                         admin codes, newest first: note, uses, end date, state, maker
--   mod_invite_code_create(note, uses, ends)   makes an admin code (audit row)
--   mod_invite_code_set(code, enabled)         switches an admin code off, or back on (audit row)
--   mod_invite_summary()                       accounts waiting, people who joined with admin codes, and when
--                                              early access ends
--   mod_user_invites(user)                     who invited them, who they invited, their codes and whether their
--                                              invites are paused
--
-- All of them refuse anyone who isn't a moderator. The writes also need the moderator to have a profile, for the
-- audit row (invite_moderator(), 0132); the reads don't, so a moderator without one still sees a person's page.
-- Giving another set
-- and pausing invites stay invite_grant_set() / invite_freeze() / invite_unfreeze() (0132); letting people in
-- stays admit_waiting() (0131, founders only).

alter table public.invite_codes add column note text check (char_length(note) <= 200);
comment on column public.invite_codes.note is
  'What an admin code is for, e.g. "Coffee meetup" (INV-10). Only moderators see it.';

-- Admin codes, newest first. state is on, off (switched off), used_up or ended (past its end date); off wins.
-- made_by is null when the maker's profile is gone.
create or replace function public.mod_invite_codes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', c.code, 'note', c.note, 'uses', c.uses, 'max_uses', c.max_uses,
      'expires_at', c.expires_at, 'created_at', c.created_at,
      'state', case when c.disabled_at is not null then 'off'
                    when c.uses >= c.max_uses then 'used_up'
                    when c.expires_at <= now() then 'ended'
                    else 'on' end,
      'made_by', case when p.id is not null then jsonb_build_object(
        'username', p.username, 'display_name', p.display_name,
        'founder', coalesce(u.raw_app_meta_data ->> 'founder', '') = 'true') end)
      order by c.created_at desc, c.code)
    from (select * from invite_codes where kind = 'admin' order by created_at desc, code limit 500) c
    left join profiles p on p.id = c.created_by
    left join auth.users u on u.id = c.created_by
  ), '[]'::jsonb);
end $$;
comment on function public.mod_invite_codes() is 'Moderators: the admin invite codes, newest first (INV-10).';

-- Makes an admin code: a note (1 to 200 characters), 1 to 10000 uses and an optional end date in the future.
-- Returns { result: made, code }.
create or replace function public.mod_invite_code_create(p_note text, p_uses int, p_ends_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := invite_moderator();
  v_note text := btrim(coalesce(p_note, ''));
  c text;
begin
  if char_length(v_note) = 0 or char_length(v_note) > 200 then
    raise exception 'a note of 1 to 200 characters is required' using errcode = '22023';
  end if;
  if p_uses is null or p_uses < 1 or p_uses > 10000 then
    raise exception 'a code has 1 to 10000 uses' using errcode = '22023';
  end if;
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'the end date must be in the future' using errcode = '22023';
  end if;
  loop
    c := invite_token(6);
    begin
      insert into invite_codes (code, kind, max_uses, expires_at, created_by, note)
      values (c, 'admin', p_uses, p_ends_at, actor, v_note);
      exit;
    exception when unique_violation then
      null; -- the code is taken: draw again
    end;
  end loop;
  insert into audit_log (actor_id, action, data)
  values (actor, 'invite_code_create',
          jsonb_strip_nulls(jsonb_build_object('code', c, 'note', v_note, 'uses', p_uses, 'until', p_ends_at)));
  return jsonb_build_object('result', 'made', 'code', c);
end $$;
comment on function public.mod_invite_code_create(text, int, timestamptz) is
  'Moderators: makes an admin invite code with a note, a number of uses and an optional end date (INV-10).';

-- Switches an admin code off (p_enabled false) or back on. Returns off, on, unchanged or not_found. Personal
-- and waitlist codes aren't switched here: pause a person's invites instead.
create or replace function public.mod_invite_code_set(p_code text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := invite_moderator();
  t text := upper(btrim(coalesce(p_code, '')));
begin
  if p_enabled is null then
    raise exception 'say whether the code is on or off' using errcode = '22023';
  end if;
  if not exists (select 1 from invite_codes where code = t and kind = 'admin') then
    return jsonb_build_object('result', 'not_found');
  end if;
  update invite_codes set disabled_at = case when p_enabled then null else now() end
  where code = t and kind = 'admin' and (disabled_at is not null) = p_enabled;
  if not found then
    return jsonb_build_object('result', 'unchanged');
  end if;
  insert into audit_log (actor_id, action, data)
  values (actor, case when p_enabled then 'invite_code_on' else 'invite_code_off' end, jsonb_build_object('code', t));
  return jsonb_build_object('result', case when p_enabled then 'on' else 'off' end);
end $$;
comment on function public.mod_invite_code_set(text, boolean) is
  'Moderators: switches an admin invite code off or back on (INV-10).';

-- The numbers above the codes table.
create or replace function public.mod_invite_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'waiting', (select count(*) from profiles where status = 'waiting'),
    'joined_with_codes', (select count(*) from invite_redemptions r join invite_codes c on c.code = r.code
                          where c.kind = 'admin'),
    'ends_at', invite_period_ends_at());
end $$;
comment on function public.mod_invite_summary() is
  'Moderators: accounts waiting, people who joined with admin codes and when early access ends (INV-10).';

-- One person's invites, for their page in the console. Null when there is no such profile. Moderators see every
-- invitee, whatever their status or blocks.
create or replace function public.mod_user_invites(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  h invite_holders;
begin
  if not is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    return null;
  end if;
  select * into h from invite_holders where user_id = p_user;
  return jsonb_build_object(
    'has_codes', h.user_id is not null,
    'unlocked', h.unlocked_at is not null,
    'frozen', case when h.frozen_at is not null then jsonb_build_object(
      'at', h.frozen_at, 'note', h.frozen_reason,
      'by', (select username from profiles where id = h.frozen_by)) end,
    'link_enabled', (select enabled from invite_links where owner_id = p_user),
    'sets', (select count(distinct set_no) from invite_codes where owner_id = p_user and kind = 'personal'),
    'codes', (select count(*) from invite_codes where owner_id = p_user and kind = 'personal'),
    'used', (select count(*) from invite_codes where owner_id = p_user and kind = 'personal' and uses >= max_uses),
    'invited_by', (
      select jsonb_build_object(
        'kind', c.kind, 'code', c.code, 'note', c.note, 'via_link', r.via_link, 'joined_at', r.redeemed_at,
        'inviter', case when o.id is not null then jsonb_build_object('id', o.id, 'username', o.username) end)
      from invite_redemptions r
      join invite_codes c on c.code = r.code
      left join profiles o on o.id = c.owner_id
      where r.invitee_id = p_user),
    'invitees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'username', f.username, 'status', f.status, 'via_link', r.via_link, 'joined_at', r.redeemed_at)
        order by r.redeemed_at desc)
      from invite_codes c
      join invite_redemptions r on r.code = c.code
      left join profiles f on f.id = r.invitee_id
      where c.owner_id = p_user and c.kind = 'personal'), '[]'::jsonb));
end $$;
comment on function public.mod_user_invites(uuid) is
  'Moderators: who invited a person, who they invited, their codes and whether their invites are paused (INV-10).';

revoke execute on function public.mod_invite_codes() from public, anon;
revoke execute on function public.mod_invite_code_create(text, int, timestamptz) from public, anon;
revoke execute on function public.mod_invite_code_set(text, boolean) from public, anon;
revoke execute on function public.mod_invite_summary() from public, anon;
revoke execute on function public.mod_user_invites(uuid) from public, anon;
grant execute on function public.mod_invite_codes() to authenticated;
grant execute on function public.mod_invite_code_create(text, int, timestamptz) to authenticated;
grant execute on function public.mod_invite_code_set(text, boolean) to authenticated;
grant execute on function public.mod_invite_summary() to authenticated;
grant execute on function public.mod_user_invites(uuid) to authenticated;
