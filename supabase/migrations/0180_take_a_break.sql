-- 0180 — Take a break (calm controls). Additive: one column, a wider push_result check, and push_take() as
-- in 0177 with one more step. Nothing is dropped or rewritten.
--
--   * notification_prefs.break_until: while it is in the future the person is on a break. Owner-only like the
--     rest of the row (RLS, 0019), so nobody else can tell someone is away.
--   * Social pushes due during a break (new readers and reader requests, likes, comments, replies, friend joined,
--     tags, together moments) settle as 'on_break': they stay in the in-app list and are never pushed later, so the
--     end of a break brings no pile of pushes. Removal and appeal notices still go: they are about safety.
--   * Slot reminders are local notifications; the app leaves out every reminder before break_until.

alter table public.notification_prefs add column break_until timestamptz;
comment on column public.notification_prefs.break_until is
  'Take a break (0180): until then social pushes settle as on_break and the app schedules no reminders. Null: no break.';
grant update (break_until) on public.notification_prefs to authenticated;

alter table public.notifications drop constraint notifications_push_result_check;
alter table public.notifications add constraint notifications_push_result_check check (push_result in (
  'sent', 'muted', 'in_app_only', 'daily_limit', 'no_token', 'stale', 'on_break'
));

-- As 0177, with social types held back during a break.
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
      when 'reader_request' then np.new_reader
      when 'reader_approved' then np.new_reader
      when 'like' then np."like"
      when 'comment' then np.comment
      when 'reply' then np.reply
      when 'removed' then np.removed
      when 'appeal_decided' then np.appeal_decided
      when 'friend_joined' then np.friend_joined
      when 'invite_joined' then np.friend_joined
      when 'tag' then np.tag
      when 'together_request' then np.together
      when 'together_added' then np.together
      else true
    end;

  -- On a break: social pushes settle; safety notices (removed, appeal_decided) still go.
  update notifications n set pushed_at = now(), push_result = 'on_break'
  from notification_prefs np
  where n.pushed_at is null and np.user_id = n.user_id and np.break_until > now()
    and n.type in ('new_reader', 'reader_request', 'reader_approved', 'like', 'comment', 'reply', 'friend_joined',
                   'invite_joined', 'tag', 'together_request', 'together_added');

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
