-- 0176 — Approve who reads you. Additive: one profiles column, one table, new functions and triggers;
-- the notification type check gains two values and push_take is re-created as in 0172 with their switch.
-- No existing row changes: everyone who reads someone today stays their reader.
--
-- * Who approves: an account set to Private (profiles.is_private, owner-editable, default off) and every
--   account under 18, whatever the switch says (needs_reader_approval). Everyone else gets readers at once,
--   as before.
-- * Asking: Be a reader still inserts into follows. For an author who approves readers, follows_request
--   turns a client's insert into a follow_requests row instead, so nothing changes for the app (older
--   versions included) and nothing an author shares reaches the person until approved. follows keeps
--   meaning "approved reader", so every visibility rule, feed and count that reads it stays as it is.
--   Privileged inserts (invite links, approve_reader) go straight to follows.
-- * The author gets reader_request ("wants to read you") and approves with approve_reader(), which makes the
--   follow and tells the reader (reader_approved). Declining is deleting the request: silent, and the person
--   can ask again. The reader cancels the same way. A handled request takes its notification with it.
-- * A block removes requests both ways. Turning Private off, or turning 18 while not Private
--   (approve_waiting_readers, from fn:account-jobs), approves every waiting request.

-- ---------------------------------------------------------------- profiles.is_private
alter table public.profiles add column if not exists is_private boolean not null default false;
comment on column public.profiles.is_private is
  'Private account: readers need the owner''s approval (0176). Owner-editable. Under 18 always approves readers.';
-- Signed-in users read profiles through a column list (0004): others see it so a Private profile shows locked.
grant select (is_private) on public.profiles to authenticated;

create or replace function public.needs_reader_approval(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_id and (p.is_private or p.birthday > (current_date - interval '18 years'))
  )
$$;
revoke execute on function public.needs_reader_approval(uuid) from public, anon;
grant execute on function public.needs_reader_approval(uuid) to authenticated, service_role;
comment on function public.needs_reader_approval(uuid) is
  'Whether a person approves their readers: Private account, or under 18 (0176).';

-- ---------------------------------------------------------------- follow_requests
create table public.follow_requests (
  reader_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reader_id, author_id),
  check (reader_id <> author_id)
);
create index follow_requests_author_idx on public.follow_requests (author_id, created_at desc);
comment on table public.follow_requests is
  'People waiting for an author''s approval to read them (0176). Made through follows; seen and removed by both ends.';

alter table public.follow_requests enable row level security;
revoke all on public.follow_requests from anon, authenticated;
grant select, delete on public.follow_requests to authenticated;
create policy follow_requests_select on public.follow_requests for select to authenticated
  using ((reader_id = auth.uid() or author_id = auth.uid()) and not public.is_blocked_between(reader_id, author_id));
create policy follow_requests_delete on public.follow_requests for delete to authenticated
  using (reader_id = auth.uid() or author_id = auth.uid());

-- ---------------------------------------------------------------- asking
-- Records that the caller asks to read p_author when p_author approves readers; false when the follow
-- should go ahead (no approval needed, already a reader) or be refused by follows' own policies (inactive).
create or replace function public.follow_request_take(p_author uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or me = p_author or not needs_reader_approval(p_author) then return false; end if;
  if exists (select 1 from follows where reader_id = me and author_id = p_author) then return false; end if;
  if not is_active_user(me) or not is_active_user(p_author) then return false; end if;
  if is_blocked_between(me, p_author) then raise exception 'blocked'; end if;
  insert into follow_requests (reader_id, author_id) values (me, p_author) on conflict do nothing;
  return true;
end $$;
revoke execute on function public.follow_request_take(uuid) from public, anon;
grant execute on function public.follow_request_take(uuid) to authenticated;
comment on function public.follow_request_take(uuid) is
  'Asks to read p_author when they approve readers (0176); false when no request is needed.';

-- Security invoker on purpose: is_client_role() tells an app insert from a privileged one.
create or replace function public.follows_request() returns trigger
language plpgsql set search_path = public as $$
begin
  if is_client_role() and new.reader_id = auth.uid() and follow_request_take(new.author_id) then
    return null;
  end if;
  return new;
end $$;
create trigger follows_request before insert on public.follows
  for each row execute function public.follows_request();

create or replace function public.follow_requests_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify(new.author_id, 'reader_request', new.reader_id);
    return new;
  end if;
  delete from notifications
  where user_id = old.author_id and actor_id = old.reader_id and type = 'reader_request';
  return old;
end $$;
create trigger follow_requests_sync after insert or delete on public.follow_requests
  for each row execute function public.follow_requests_sync();

-- ---------------------------------------------------------------- approving
-- Moves requests to follows and tells each reader. Internal.
create or replace function public.follow_requests_approve(p_author uuid, p_reader uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    delete from follow_requests
    where author_id = p_author and (p_reader is null or reader_id = p_reader)
    returning reader_id
  loop
    if is_active_user(r.reader_id) and is_active_user(p_author) and not is_blocked_between(r.reader_id, p_author) then
      insert into follows (reader_id, author_id) values (r.reader_id, p_author) on conflict do nothing;
      perform notify(r.reader_id, 'reader_approved', p_author);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.follow_requests_approve(uuid, uuid) from public, anon, authenticated;

create or replace function public.approve_reader(p_reader uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null or follow_requests_approve(me, p_reader) = 0 then return false; end if;
  -- The author approved them a moment ago; follows_sync's "started reading you" would only repeat it.
  -- push_take() (0020) only sends rows older than a minute, so this one never goes out.
  delete from notifications
  where user_id = me and actor_id = p_reader and type = 'new_reader' and pushed_at is null;
  return true;
end $$;
revoke execute on function public.approve_reader(uuid) from public, anon;
grant execute on function public.approve_reader(uuid) to authenticated;
comment on function public.approve_reader(uuid) is
  'The caller approves p_reader''s request to read them (0176): they become a reader and are told. False when there was none.';

-- Approves every waiting request to an author who no longer approves readers (Private off, or turned 18).
create or replace function public.approve_waiting_readers() returns int
language plpgsql security definer set search_path = public as $$
declare
  a uuid;
  n int := 0;
begin
  for a in select distinct author_id from follow_requests loop
    if not needs_reader_approval(a) then n := n + follow_requests_approve(a); end if;
  end loop;
  return n;
end $$;
revoke execute on function public.approve_waiting_readers() from public, anon, authenticated;
grant execute on function public.approve_waiting_readers() to service_role;
comment on function public.approve_waiting_readers() is
  'Approves waiting requests to people who no longer approve readers, such as on their 18th birthday (0176). fn:account-jobs.';

create or replace function public.profiles_private_off() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not needs_reader_approval(new.id) then perform follow_requests_approve(new.id); end if;
  return null;
end $$;
create trigger profiles_private_off after update of is_private on public.profiles
  for each row when (old.is_private and not new.is_private)
  execute function public.profiles_private_off();

-- ---------------------------------------------------------------- blocks
create or replace function public.blocks_drop_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from follow_requests
  where (reader_id = new.blocker_id and author_id = new.blocked_id)
     or (reader_id = new.blocked_id and author_id = new.blocker_id);
  return null;
end $$;
create trigger blocks_drop_requests after insert on public.blocks
  for each row execute function public.blocks_drop_requests();

-- ---------------------------------------------------------------- notifications and their push switch
alter table public.notifications drop constraint notifications_type_known;
alter table public.notifications
  add constraint notifications_type_known check (type in (
    'new_reader', 'like', 'comment', 'reply', 'full_jar', 'removed', 'appeal_decided', 'friend_joined', 'admitted',
    'invite_joined', 'tag', 'reader_request', 'reader_approved'
  ));

-- As 0172, with reader_request and reader_approved following notification_prefs.new_reader.
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

-- ---------------------------------------------------------------- Private: posts reach approved readers only
-- A Private account's Everyone posts behave as Readers: strangers and people still waiting see its profile
-- header, not its jars or moments. Under 18 without Private keeps Everyone posts visible to all signed-in
-- people, as before. Everything that checks can_view_jar or can_view_moment (RLS on jars, moments, comments
-- and reactions, Explore's full_jars_today, photo URLs) follows; Discover and the shared web pages are below.
create or replace function public.can_view_jar(viewer uuid, j public.jars) returns boolean
language sql stable security definer set search_path = public as $$
  select
    j.user_id = viewer
    or (
      j.published_at is not null
      and viewer is not null
      and not is_blocked_between(viewer, j.user_id)
      and exists (
        select 1 from profiles p
        where p.id = j.user_id and p.status = 'active'
          and ((j.visibility = 'everyone' and not p.is_private)
               or (j.visibility in ('readers', 'everyone')
                   and exists (select 1 from follows where reader_id = viewer and author_id = j.user_id))))
    )
$$;

create or replace function public.can_view_moment(viewer uuid, m public.moments) returns boolean
language sql stable security definer set search_path = public as $$
  select m.user_id = viewer
      or (m.status = 'live'
          and m.hidden_at is null
          and m.visibility <> 'only_me'
          and viewer is not null
          and not is_blocked_between(viewer, m.user_id)
          and exists (
            select 1 from profiles p
            where p.id = m.user_id and p.status = 'active'
              and ((m.visibility = 'everyone' and not p.is_private)
                   or exists (select 1 from follows where reader_id = viewer and author_id = m.user_id))))
$$;

-- As 0150, and not Private: a Private account's posts and the account itself stay out of Discover and
-- suggestions.
create or replace function public.in_discover(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_id
      and p.status = 'active'
      and p.discoverable
      and not p.is_private
      and p.birthday <= (current_date - interval '18 years')
  )
$$;

-- As 0066: a Private account's shared profile page shows the header and no jars.
create or replace function public.public_profile(p_username text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
      'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'lid_color', p.lid_color,
      'reader_count', p.reader_count, 'author_count', p.author_count,
      'created_at', p.created_at),
    'jars', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', j.id, 'local_date', j.local_date, 'published_at', j.published_at,
               'visible_count', j.n, 'moments', j.moments)
             order by j.local_date desc, j.id desc)
      from (
        select jar.id, jar.local_date, jar.published_at, e.n, e.moments
        from jars jar
        cross join lateral (
          select count(*)::int as n,
                 coalesce(jsonb_agg(jsonb_build_object(
                            'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                            'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                            'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                          order by m.slot), '[]'::jsonb) as moments
          from moments m
          where m.jar_id = jar.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
        ) e
        where jar.user_id = p.id and jar.published_at is not null and jar.visibility = 'everyone' and e.n > 0
          and not p.is_private
        order by jar.local_date desc, jar.id desc
        limit 30
      ) j
    ), '[]'::jsonb))
  from profiles p
  where p.username = p_username::citext
    and p.status = 'active'
$$;

-- As 0069: a Private account's shared jar link is a Readers teaser without moments.
create or replace function public.public_jar(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
      'id', j.id, 'local_date', j.local_date, 'visibility', j.visibility,
      'readers_only', j.visibility = 'readers' or p.is_private, 'published_at', j.published_at,
      'visible_count', case when j.visibility = 'everyone' and not p.is_private then e.n else j.visible_count end,
      'author', jsonb_build_object(
        'id', p.id, 'username', p.username, 'display_name', p.display_name, 'bio', p.bio,
        'avatar_path', p.avatar_path, 'cover_path', p.cover_path, 'lid_color', p.lid_color,
        'reader_count', p.reader_count, 'author_count', p.author_count,
        'created_at', p.created_at))
    || case when j.visibility = 'everyone' and not p.is_private
            then jsonb_build_object('moments', e.moments, 'cover_moment_id', e.cover_id)
            else '{}'::jsonb end
  from jars j
  join profiles p on p.id = j.user_id
  cross join lateral (
    select count(*)::int as n,
           coalesce(jsonb_agg(jsonb_build_object(
                      'id', m.id, 'slot', m.slot, 'caption', m.caption, 'captured_at', m.captured_at,
                      'added_at', m.added_at, 'is_backfilled', m.is_backfilled, 'edits', m.edits,
                      'photo_path', m.photo_path, 'thumb_path', m.thumb_path)
                    order by m.slot), '[]'::jsonb) as moments,
           -- The resolved cover among these Everyone moments (0069).
           coalesce(
             (array_agg(m.id) filter (where m.id = j.cover_moment_id))[1],
             (array_agg(m.id order by m.added_at desc, m.slot desc) filter (where nullif(btrim(m.caption), '') is not null))[1],
             (array_agg(m.id order by m.slot))[1]
           ) as cover_id
    from moments m
    where m.jar_id = j.id and m.status = 'live' and m.visibility = 'everyone' and m.hidden_at is null
  ) e
  where j.id = p_id
    and j.published_at is not null
    and j.visibility in ('everyone', 'readers')
    and p.status = 'active'
$$;

-- ---------------------------------------------------------------- Readers & authors rows
-- As 0017, with requested: the caller asked to read them and is waiting (shows Requested).
drop function public.search_follow_list(uuid, text, text, int);
create function public.search_follow_list(
  owner uuid,
  list text,
  query text default '',
  lim int default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  is_following boolean,   -- the viewer reads them (Reading)
  follows_viewer boolean, -- they read the viewer (Read back)
  requested boolean       -- the viewer is waiting for their approval (Requested)
)
language sql stable security invoker set search_path = public as $$
  with people as (
    select case when list = 'readers' then f.reader_id else f.author_id end as person
    from follows f
    where list in ('readers', 'authors')
      and (case when list = 'readers' then f.author_id else f.reader_id end) = owner
  ),
  q as (
    -- Search text is matched literally: % and _ in it are not wildcards.
    select '%' || replace(replace(replace(coalesce(btrim(query), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select p.id, p.username::text, p.display_name, p.avatar_path,
         exists (select 1 from follows x where x.reader_id = auth.uid() and x.author_id = p.id),
         exists (select 1 from follows x where x.reader_id = p.id and x.author_id = auth.uid()),
         exists (select 1 from follow_requests x where x.reader_id = auth.uid() and x.author_id = p.id)
  from people
  join profiles p on p.id = people.person
  cross join q
  where p.status = 'active'
    and not is_blocked_between(auth.uid(), p.id)
    and (p.username::text ilike q.pattern or p.display_name ilike q.pattern)
  order by p.username
  limit least(greatest(coalesce(lim, 50), 1), 200)
$$;
comment on function public.search_follow_list(uuid, text, text, int) is
  'A profile''s readers or authors (list = readers | authors), searchable by name or username, '
  'without anyone blocked either way with the caller; requested marks people the caller is waiting on (0176).';
revoke execute on function public.search_follow_list(uuid, text, text, int) from public, anon;
grant execute on function public.search_follow_list(uuid, text, text, int) to authenticated;

-- The owner's waiting requests, newest first, for the Requests card on their Readers list.
create or replace function public.reader_requests()
returns table (id uuid, username text, display_name text, avatar_path text, requested_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, r.created_at
  from follow_requests r
  join profiles p on p.id = r.reader_id
  where r.author_id = auth.uid()
    and p.status = 'active'
    and not is_blocked_between(auth.uid(), p.id)
  order by r.created_at desc
  limit 200
$$;
revoke execute on function public.reader_requests() from public, anon;
grant execute on function public.reader_requests() to authenticated;
comment on function public.reader_requests() is
  'People waiting for the caller''s approval to read them, newest first (0176).';
