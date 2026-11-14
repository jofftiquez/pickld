-- 0135 (INV-08, #379): "Ana joined with your invite" and the two invite stickers. Additive: a notification type,
-- two milestones with their stickers, one new function; invite_redeem() and push_take() are redefined with one
-- addition each. The two check constraints are replaced by wider ones (as 0060 and 0131 did); nothing is
-- dropped or renamed.
--
--   invite_joined        the inviter's notification when someone joins with one of their personal codes (or
--                        their link). Pushed under the existing Friend joined switch (notification_prefs), with
--                        quiet hours, and no daily limit: each one is a person they brought in. notify() skips it
--                        across a block. Waitlist and admin codes have no inviter, so no notification.
--   first_friend         milestone: the first person joins with your personal code or link.
--   full_jar_of_friends  milestone: all 8 codes of your first set are used.
--
-- Both stickers are in the Milestones pack, which is earned and never sold (tier 'earned'); a sticker with a
-- milestone key is usable only once that milestone is reached (sticker_usable, 0012). They stay out of the
-- jar celebrations (the app's milestoneKeys), which are about filling jars. Stand-in art for now (decided by
-- the Space overnight on Joff's behalf), rendered in the milestone pill style: assets/stickers/milestones/.

-- ---------------------------------------------------------------- the notification type
alter table public.notifications drop constraint notifications_type_known;
alter table public.notifications
  add constraint notifications_type_known check (type in (
    'new_reader', 'like', 'comment', 'reply', 'full_jar', 'removed', 'appeal_decided', 'friend_joined', 'admitted',
    'invite_joined'
  ));

-- ---------------------------------------------------------------- push: the Friend joined switch covers it
-- As in 0020, with invite_joined following notification_prefs.friend_joined.
create or replace function public.push_take(p_settle interval default interval '60 seconds', p_limit int default 500)
returns table (
  id uuid,
  user_id uuid,
  type text,
  actor_name text,
  jar_id uuid,
  jar_local_date date,
  moment_id uuid,
  comment_id uuid,
  comment_body text,
  tokens text[]
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  -- Too old to push.
  update notifications n set pushed_at = now(), push_result = 'stale'
  where n.pushed_at is null and n.created_at < now() - interval '1 day';

  -- Never pushed.
  update notifications n set pushed_at = now(), push_result = 'in_app_only'
  where n.pushed_at is null and n.type = 'full_jar';

  -- Turned off.
  update notifications n set pushed_at = now(), push_result = 'muted'
  from notification_prefs np
  where n.pushed_at is null and np.user_id = n.user_id
    and not case n.type
      when 'new_reader' then np.new_reader
      when 'like' then np."like"
      when 'comment' then np.comment
      when 'reply' then np.reply
      when 'removed' then np.removed
      when 'appeal_decided' then np.appeal_decided
      when 'friend_joined' then np.friend_joined
      when 'invite_joined' then np.friend_joined
      else true
    end;

  -- Friend joined: one push a day. Anything beyond the first due row, or after one sent in the last day, stops here.
  update notifications n set pushed_at = now(), push_result = 'daily_limit'
  where n.pushed_at is null and n.type = 'friend_joined'
    and (exists (select 1 from notifications s
                 where s.user_id = n.user_id and s.type = 'friend_joined' and s.push_result = 'sent'
                   and s.pushed_at > now() - interval '1 day')
         or exists (select 1 from notifications e
                    where e.user_id = n.user_id and e.type = 'friend_joined' and e.pushed_at is null
                      and (e.created_at, e.id) < (n.created_at, n.id)));

  -- Nowhere to send.
  update notifications n set pushed_at = now(), push_result = 'no_token'
  where n.pushed_at is null and n.created_at <= now() - p_settle
    and not exists (select 1 from push_tokens t where t.user_id = n.user_id);

  -- Claim what is due and outside quiet hours. SKIP LOCKED: two overlapping runs never send a row twice.
  return query
  with due as (
    select n.id from notifications n
    where n.pushed_at is null and n.created_at <= now() - p_settle and not in_quiet_hours(n.user_id, now())
    order by n.created_at
    limit greatest(coalesce(p_limit, 500), 1)
    for update skip locked
  ),
  claimed as (
    update notifications n set pushed_at = now(), push_result = 'sent'
    from due where n.id = due.id
    returning n.*
  )
  select c.id, c.user_id, c.type, a.display_name, c.jar_id, j.local_date, c.moment_id, c.comment_id,
         left(cm.body, 120),
         array(select t.token from push_tokens t where t.user_id = c.user_id order by t.updated_at desc)
  from claimed c
  left join profiles a on a.id = c.actor_id
  left join jars j on j.id = c.jar_id
  left join comments cm on cm.id = c.comment_id and not cm.is_hidden and cm.deleted_at is null
  order by c.user_id, c.created_at;
end $$;
revoke execute on function public.push_take(interval, int) from public, anon, authenticated;
grant execute on function public.push_take(interval, int) to service_role;

-- ---------------------------------------------------------------- the two invite stickers
alter table public.stickers drop constraint stickers_milestone_key_check;
alter table public.stickers add constraint stickers_milestone_key_check
  check (milestone_key in ('first_full_jar', 'full_jars_7', 'jars_30', 'jars_100', 'one_year',
                           'jars_7', 'full_jars_30', 'jars_50', 'full_jars_100', 'jars_200',
                           'first_friend', 'full_jar_of_friends'));

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, null::slot,
       null::sticker_stamp, v.milestone_key, v.sort, v.w, v.h
from (values
  (11, 'First friend',        'stickers/milestones/first-friend.png',        '{milestone,invite,friends}'::text[], 'first_friend',        744, 252),
  (12, 'Full jar of friends', 'stickers/milestones/full-jar-of-friends.png', '{milestone,invite,friends}'::text[], 'full_jar_of_friends', 966, 252)
) as v(sort, label, asset_path, tags, milestone_key, w, h)
join public.sticker_packs p on p.slug = 'milestones';

-- ---------------------------------------------------------------- someone joined with your invite
-- Called by invite_redeem() for a personal code or link, once the invitee is active. Internal only.
create or replace function public.invite_joined(p_owner uuid, p_invitee uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform notify(p_owner, 'invite_joined', p_invitee);

  insert into milestones (user_id, key)
  select p_owner, v.key
  from (values ('first_friend', true),
               ('full_jar_of_friends', (select count(*) = 8 and bool_and(c.uses > 0) from invite_codes c
                                        where c.owner_id = p_owner and c.kind = 'personal' and c.set_no = 1))
       ) as v(key, reached)
  where v.reached
  on conflict (user_id, key) do nothing;

  insert into owned_packs (user_id, pack_id, source)
  select p_owner, id, 'earned' from sticker_packs where slug = 'milestones'
  on conflict (user_id, pack_id) do nothing;
end $$;
comment on function public.invite_joined(uuid, uuid) is
  'The invite_joined notification and the first_friend and full_jar_of_friends milestones (INV-08, 0135). Internal.';
revoke execute on function public.invite_joined(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- redeeming tells the inviter
-- As in 0132, with invite_joined() called at the end.
create or replace function public.invite_redeem(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  p profiles;
  v_code text;
  v_kind invite_kind;
  v_owner uuid;
  v_via_link boolean;
  attempt_key text := 'user:' || auth.uid()::text;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into p from profiles where id = me for update;
  if p.id is null or p.status not in ('waiting', 'active') then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if p.status = 'active' and (p.created_at <= now() - interval '1 day'
                              or exists (select 1 from invite_redemptions where invitee_id = me)) then
    return jsonb_build_object('result', 'already_member');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('invite_attempt:' || attempt_key, 0));
  delete from invite_attempts where key = attempt_key and created_at <= now() - interval '1 hour';
  if (select count(*) from invite_attempts where key = attempt_key) >= 10 then
    return jsonb_build_object('result', 'limited');
  end if;
  insert into invite_attempts (key) values (attempt_key);

  select u.code, u.kind, u.owner_id, u.via_link into v_code, v_kind, v_owner, v_via_link
  from invite_usable_code(p_token, true) u;
  if v_code is null or v_owner = me then
    return jsonb_build_object('result', 'unavailable');
  end if;

  update invite_codes set uses = uses + 1 where code = v_code;
  insert into invite_redemptions (code, via_link, invitee_id) values (v_code, v_via_link, me);
  if p.status = 'waiting' then
    update profiles set status = 'active' where id = me;
    update waitlist set admitted_at = now() where user_id = me and admitted_at is null;
  end if;

  if v_kind = 'personal' and not is_blocked_between(me, v_owner) then
    insert into follows (reader_id, author_id) values (me, v_owner) on conflict do nothing;
    if p.birthday <= current_date - interval '18 years' then
      insert into follows (reader_id, author_id) values (v_owner, me) on conflict do nothing;
    end if;
    -- push_take() (0020) only sends rows older than a minute, so these never go out.
    delete from notifications
    where type = 'new_reader' and pushed_at is null
      and ((user_id = v_owner and actor_id = me) or (user_id = me and actor_id = v_owner));
  end if;
  -- The inviter hears about it and may earn an invite sticker (0135). After the status change: notify() only
  -- names an active actor.
  if v_kind = 'personal' then
    perform invite_joined(v_owner, me);
  end if;

  return jsonb_build_object('result', 'joined', 'kind', v_kind,
                            'inviter', (select username::text from profiles where id = v_owner));
end $$;
comment on function public.invite_redeem(text) is
  'Uses an invite code or link for the signed-in caller (INV-03): joined, unavailable, limited or already_member. Tells the inviter (0135).';
