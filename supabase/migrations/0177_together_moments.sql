-- 0177 — Together moments: someone tagged in a moment (0172) asks to show it on the Together page of their
-- profile, and it shows there once the author agrees. Additive: one table, functions and triggers, two
-- notification types and one push switch. Nothing is dropped or rewritten; notify (0172) and push_take (0176)
-- are replaced with the new types added.
--
-- The rules (decided by Joff):
--   * Never in jars: a together moment never takes a slot or joins anyone's jar, feed, Discover or counts. It
--     stays the author's moment; the Together page only links to it, and likes and comments stay on it.
--   * Asked, then agreed: only a person tagged on the moment right now can ask (request_together), while it is
--     live, not hidden and not Only me. The author is told (notification 'together_request') and approves or
--     declines (answer_together); the tagged person is told once when it's approved ('together_added'). Both
--     pushes follow notification_prefs.together.
--   * A decline is final for that moment, and so is the author taking an approval back (remove_together as the
--     author). The tagged person can cancel a request or take the moment off their page (remove_together as
--     themselves) and ask again later.
--   * Who sees it on the Together page: people who can see the author's moment (can_view_moment) and who also
--     pass the tagged person's default visibility (everyone: anyone; readers: people who read them; Only me:
--     nobody else), aren't blocked either way with the tagged person, and while that account is active. A
--     Private tagged person's Everyone counts as Readers, as their own posts do (0176). The author and the
--     tagged person see it whenever they can see the moment.
--   * It leaves (the row goes, no copy is kept) when the moment is deleted, removed by moderation or turned
--     Only me, when the tag goes (the author takes the mention out, the tagged person removes their tag, or a
--     block either way, 0172), or when either person takes it off. A hidden moment drops off until it's live
--     again. The requests and notices about it go with it.

-- ---------------------------------------------------------------- the table
create table public.together_moments (
  moment_id uuid not null,
  user_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (moment_id, user_id),
  -- No tag, no together moment: deleting the tag (or the moment, or either account) takes the row with it.
  foreign key (moment_id, user_id) references public.moment_tags(moment_id, tagged_id) on delete cascade
);
comment on table public.together_moments is
  'Moments a tagged person shows on their profile''s Together page, with the author''s consent (0177).';
create index together_moments_user_idx on public.together_moments (user_id, status);
create index together_moments_author_idx on public.together_moments (author_id);

-- Whether `viewer` may see an approved together moment on `t.user_id`'s Together page: see the header.
create or replace function public.can_see_together(viewer uuid, t public.together_moments) returns boolean
language sql stable security definer set search_path = public as $$
  select t.status = 'approved' and viewer is not null
     and exists (select 1 from moments m
                 where m.id = t.moment_id and m.status = 'live' and m.hidden_at is null and m.visibility <> 'only_me'
                   and can_view_moment(viewer, m))
     and (viewer = t.user_id or viewer = t.author_id
          or (not is_blocked_between(viewer, t.user_id)
              and exists (select 1 from profiles p
                          where p.id = t.user_id and p.status = 'active'
                            and ((p.default_visibility = 'everyone' and not p.is_private)
                                 or (p.default_visibility in ('readers', 'everyone')
                                     and exists (select 1 from follows
                                                 where reader_id = viewer and author_id = t.user_id))))))
$$;
revoke execute on function public.can_see_together(uuid, public.together_moments) from public, anon;
grant execute on function public.can_see_together(uuid, public.together_moments) to authenticated, service_role;

alter table public.together_moments enable row level security;
revoke all on public.together_moments from anon, authenticated;
grant select (moment_id, user_id, author_id, status) on public.together_moments to authenticated;
-- The two people see a request and its answer; everyone else sees approved ones they may see.
create policy together_moments_select on public.together_moments for select to authenticated
  using ((status <> 'approved' and auth.uid() in (user_id, author_id))
         or public.can_see_together(auth.uid(), together_moments));

-- ---------------------------------------------------------------- what the app shows
-- A Together page: the approved moments `p_user` shows that the caller may see, newest first by when they
-- were added there. Thumbnails come from fn:photo-urls, which checks the moment itself.
create or replace function public.together_page(p_user uuid, p_limit int default 60)
returns table (
  moment_id uuid,
  jar_id uuid,
  author_id uuid,
  author_username text,
  author_name text,
  slot public.slot,
  local_date date,
  tz text,
  captured_at timestamptz,
  added_at timestamptz,
  edits jsonb,
  added_together_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select m.id, m.jar_id, m.user_id, a.username::text, a.display_name, m.slot, j.local_date, j.tz,
         m.captured_at, m.added_at, m.edits, t.decided_at
  from together_moments t
  join moments m on m.id = t.moment_id
  join jars j on j.id = m.jar_id
  join profiles a on a.id = m.user_id
  where t.user_id = p_user and can_see_together(auth.uid(), t)
  order by t.decided_at desc, m.id
  limit least(greatest(coalesce(p_limit, 60), 1), 200)
$$;
revoke execute on function public.together_page(uuid, int) from public, anon;
grant execute on function public.together_page(uuid, int) to authenticated;

-- ---------------------------------------------------------------- asking, answering, taking off
-- Deletes the requests and notices about one person's together moment.
create or replace function public.together_forget(p_moment uuid, p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from notifications
  where moment_id = p_moment and type in ('together_request', 'together_added')
    and (user_id = p_user or actor_id = p_user);
$$;
revoke execute on function public.together_forget(uuid, uuid) from public, anon, authenticated;

-- The tagged person asks to show the moment on their Together page.
create or replace function public.request_together(p_moment uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  m moments;
  existing text;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into m from moments where id = p_moment;
  if m.id is null
     or not exists (select 1 from moment_tags
                    where moment_id = p_moment and tagged_id = auth.uid() and removed_at is null)
     or not can_view_moment(auth.uid(), m) then
    raise exception 'not tagged on that moment' using errcode = '42501';
  end if;
  if m.status <> 'live' or m.hidden_at is not null or m.visibility = 'only_me' then
    raise exception 'that moment isn''t shared' using errcode = '22023';
  end if;
  select status into existing from together_moments where moment_id = p_moment and user_id = auth.uid();
  if existing is not null then
    return existing; -- already asked, added or declined; nothing changes
  end if;
  insert into together_moments (moment_id, user_id, author_id) values (p_moment, auth.uid(), m.user_id);
  perform notify(m.user_id, 'together_request', auth.uid(), m.jar_id, m.id);
  return 'requested';
end $$;
revoke execute on function public.request_together(uuid) from public, anon;
grant execute on function public.request_together(uuid) to authenticated;

-- The author approves or declines a request.
create or replace function public.answer_together(p_moment uuid, p_user uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  t together_moments;
  m moments;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into t from together_moments where moment_id = p_moment and user_id = p_user;
  if t.moment_id is null or t.author_id <> auth.uid() or t.status <> 'requested' then
    return; -- nothing to answer; says nothing about the moment
  end if;
  update together_moments set status = case when p_approve then 'approved' else 'declined' end, decided_at = now()
  where moment_id = p_moment and user_id = p_user;
  delete from notifications where user_id = auth.uid() and type = 'together_request'
    and moment_id = p_moment and actor_id = p_user;
  if p_approve then
    select * into m from moments where id = p_moment;
    perform notify(p_user, 'together_added', auth.uid(), m.jar_id, m.id);
  end if;
end $$;
revoke execute on function public.answer_together(uuid, uuid, boolean) from public, anon;
grant execute on function public.answer_together(uuid, uuid, boolean) to authenticated;

-- Takes a together moment off. The tagged person cancels or takes it off (and may ask again); the author takes
-- their approval back or declines, which is final for that moment.
create or replace function public.remove_together(p_moment uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if auth.uid() = p_user then
    delete from together_moments where moment_id = p_moment and user_id = p_user;
  elsif exists (select 1 from together_moments where moment_id = p_moment and user_id = p_user and author_id = auth.uid()) then
    update together_moments set status = 'declined', decided_at = now()
    where moment_id = p_moment and user_id = p_user and status <> 'declined';
  else
    return;
  end if;
  perform together_forget(p_moment, p_user);
end $$;
revoke execute on function public.remove_together(uuid, uuid) from public, anon;
grant execute on function public.remove_together(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- when it leaves by itself
-- The tag goes: a removed tag (the tagged person, or a block, 0172) keeps its moment_tags row, so the delete
-- that cascades from a deleted tag doesn't happen; this does it.
create or replace function public.moment_tags_together_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' or (new.removed_at is not null and old.removed_at is null) then
    delete from together_moments where moment_id = old.moment_id and user_id = old.tagged_id;
    perform together_forget(old.moment_id, old.tagged_id);
  end if;
  return null;
end $$;
create trigger moment_tags_together_sync after update of removed_at or delete on public.moment_tags
  for each row execute function public.moment_tags_together_sync();

-- The moment is removed or turns Only me: every together moment of it goes. Hidden: only its notices go
-- (can_see_together already keeps it off the page until it's live again).
create or replace function public.moments_together_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'removed' or new.visibility = 'only_me' then
    delete from together_moments where moment_id = new.id;
    delete from notifications where moment_id = new.id and type in ('together_request', 'together_added');
  elsif new.hidden_at is not null then
    delete from notifications where moment_id = new.id and type in ('together_request', 'together_added');
  end if;
  return null;
end $$;
create trigger moments_together_sync after update of status, visibility, hidden_at on public.moments
  for each row execute function public.moments_together_sync();

-- ---------------------------------------------------------------- the notifications and their push switch
alter table public.notifications drop constraint notifications_type_known;
alter table public.notifications
  add constraint notifications_type_known check (type in (
    'new_reader', 'like', 'comment', 'reply', 'full_jar', 'removed', 'appeal_decided', 'friend_joined', 'admitted',
    'invite_joined', 'tag', 'reader_request', 'reader_approved', 'together_request', 'together_added'
  ));

alter table public.notification_prefs add column together boolean not null default true;
comment on column public.notification_prefs.together is
  'Push for Together moments: a request to the author, an approval to the tagged person (0177).';
grant update (together) on public.notification_prefs to authenticated;

-- As 0172, with the together types added to what an Only me moment never notifies.
create or replace function public.notify(
  p_user uuid,
  p_type text,
  p_actor uuid default null,
  p_jar uuid default null,
  p_moment uuid default null,
  p_comment uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  m_owner uuid;
  m_only_me boolean;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null then
    if is_blocked_between(p_user, p_actor) then return; end if;
    if not exists (select 1 from profiles where id = p_actor and status = 'active') then return; end if;
  end if;
  if p_moment is not null then
    select user_id, visibility = 'only_me' into m_owner, m_only_me from moments where id = p_moment;
    if m_only_me and (p_user <> m_owner
                      or p_type in ('like', 'comment', 'reply', 'friend_joined', 'tag',
                                    'together_request', 'together_added')) then
      return;
    end if;
  end if;
  insert into notifications (user_id, type, actor_id, jar_id, moment_id, comment_id)
  values (p_user, p_type, p_actor, p_jar, p_moment, p_comment);
end $$;

-- As 0176, with the together types following notification_prefs.together.
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
