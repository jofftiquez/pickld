-- 0020 — Server push bookkeeping for fn:send-push (M3-17; FR-NOT-02, FR-NOT-04; T-206). Additive: two
-- columns, one table, functions. Nothing is dropped or renamed.
--
-- fn:send-push runs every minute (a Supabase Cron job per environment calls it with PUSH_CRON_SECRET). It
-- asks push_take() for the notifications that are due and sends them through Expo. push_take() is where
-- the rules live, so they hold whichever instance calls:
--   * a row waits PUSH_SETTLE (the caller passes 60 s) before it is due, so likes arriving together on one
--     jar go out as one push ("Aya and 12 others liked it");
--   * quiet hours (notification_prefs, default 22:00–07:00 in profiles.home_tz) hold a row until they end;
--   * rows are settled once, with push_result saying why:
--       sent         claimed for sending now (push_retry() puts it back if Expo can't be reached)
--       muted        the person turned that type off
--       in_app_only  full_jar: the celebration happens in the app (architecture, Social notifications)
--       daily_limit  friend_joined: at most one push a day
--       no_token     no device to send to
--       stale        not sendable within a day (e.g. long quiet hours plus an outage); pushing it now would
--                    only confuse
-- Expo answers each message with a ticket; push_tickets keeps them for 15 minutes or more until
-- push_receipts_settle() is told which tokens Expo reported as DeviceNotRegistered, and deletes those
-- tokens. None of this is reachable by clients: only the service role executes the functions.

alter table public.notifications
  add column pushed_at timestamptz,
  add column push_result text check (push_result in ('sent', 'muted', 'in_app_only', 'daily_limit', 'no_token', 'stale'));
create index notifications_push_due_idx on public.notifications (created_at) where pushed_at is null;

create table public.push_tickets (
  ticket_id text primary key,
  token text not null,
  created_at timestamptz not null default now()
);
comment on table public.push_tickets is
  'Expo push tickets waiting for their receipt (fn:send-push, 0020). Service role only.';
alter table public.push_tickets enable row level security;
revoke all on public.push_tickets from anon, authenticated;

-- Whether `at` falls in the person's quiet hours, in their home zone.
create or replace function public.in_quiet_hours(p_user uuid, at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when not np.quiet_hours then false
      when np.quiet_start <= np.quiet_end then t >= np.quiet_start and t < np.quiet_end
      else t >= np.quiet_start or t < np.quiet_end
    end
    from profiles p
    left join notification_prefs np on np.user_id = p.id
    cross join lateral (select (at at time zone p.home_tz)::time as t) lt
    where p.id = p_user
  ), false)
$$;
revoke execute on function public.in_quiet_hours(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.in_quiet_hours(uuid, timestamptz) to service_role;

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

-- Expo couldn't be reached: the rows go back to waiting.
create or replace function public.push_retry(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update notifications set pushed_at = null, push_result = null
  where id = any(p_ids) and push_result = 'sent'
$$;
revoke execute on function public.push_retry(uuid[]) from public, anon, authenticated;
grant execute on function public.push_retry(uuid[]) to service_role;

create or replace function public.push_tickets_save(p_ticket_ids text[], p_tokens text[]) returns void
language sql security definer set search_path = public as $$
  insert into push_tickets (ticket_id, token)
  select * from unnest(p_ticket_ids, p_tokens)
  on conflict (ticket_id) do nothing
$$;
revoke execute on function public.push_tickets_save(text[], text[]) from public, anon, authenticated;
grant execute on function public.push_tickets_save(text[], text[]) to service_role;

-- Tickets old enough to have a receipt (Expo suggests waiting 15 minutes).
create or replace function public.push_tickets_due(p_limit int default 1000)
returns table (ticket_id text, token text)
language sql stable security definer set search_path = public as $$
  select ticket_id, token from push_tickets
  where created_at <= now() - interval '15 minutes'
  order by created_at
  limit greatest(coalesce(p_limit, 1000), 1)
$$;
revoke execute on function public.push_tickets_due(int) from public, anon, authenticated;
grant execute on function public.push_tickets_due(int) to service_role;

-- Receipts read: the tickets go, and the tokens Expo called DeviceNotRegistered are deleted.
create or replace function public.push_receipts_settle(p_ticket_ids text[], p_dead_tokens text[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  removed int;
begin
  delete from push_tickets where ticket_id = any(p_ticket_ids);
  delete from push_tokens where token = any(p_dead_tokens);
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke execute on function public.push_receipts_settle(text[], text[]) from public, anon, authenticated;
grant execute on function public.push_receipts_settle(text[], text[]) to service_role;
