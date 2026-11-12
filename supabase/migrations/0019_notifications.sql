-- 0019 — Notification triggers and preferences (M3-16; FR-NOT-02, FR-NOT-03, FR-NOT-04).
-- Additive: one table, one column, one check constraint, functions and triggers. blocks_sync() (0001) is
-- replaced with a version that also clears notifications; nothing is dropped or renamed.
--
-- Rows in `notifications` are the Notifications screen (FR-NOT-03) and the input of fn:send-push (M3-17).
-- They are written only by server triggers and functions (0002 revoked client writes):
--   new_reader      follows insert (0001 follows_sync, unchanged)
--   like            reactions insert, to the owner of the liked jar or moment; an unlike removes it while unread
--   comment         a comment becoming visible (moderation unhides it, 0016), to the jar's owner
--   reply           a reply becoming visible, to the parent comment's author (the jar owner gets `reply`, not
--                   both, when they wrote the parent)
--   full_jar        jar reaching 8 moments (0010, unchanged)
--   removed         a moment moving to `removed`, to its owner
--   appeal_decided  an appeal leaving `open`, to its author
--   friend_joined   notify_friend_joined(), called by fn:contacts-match as the service role: the address
--                   book is never stored (D-4), so only that call knows who is in a new user's contacts
--
-- Every row goes through notify(), which writes nothing when the actor is the recipient, when either has
-- blocked the other, when the actor isn't active, or when the row is about a private moment and goes to
-- anyone but its owner (rule 9). Social rows (like, comment, reply, friend_joined) about a private moment
-- are never written, even to the owner. Blocking someone also deletes the notifications between the two
-- of them in both directions, so a blocked person's name doesn't linger on the Notifications screen.
--
-- notification_prefs (FR-NOT-04): one row per profile, created with the profile (existing profiles are
-- backfilled), one toggle per push type and quiet hours (default on, 22:00–07:00 in profiles.home_tz).
-- The toggles decide pushes only; rows are still written so the Notifications screen stays complete.
-- The owner reads and updates their row; nobody else sees it.

-- ---------------------------------------------------------------- notifications
alter table public.notifications
  add column comment_id uuid references public.comments(id) on delete cascade;

alter table public.notifications
  add constraint notifications_type_known check (type in (
    'new_reader', 'like', 'comment', 'reply', 'full_jar', 'removed', 'appeal_decided', 'friend_joined'
  ));

create index notifications_actor_idx on public.notifications (actor_id) where actor_id is not null;

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
  m_private boolean;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null then
    if is_blocked_between(p_user, p_actor) then return; end if;
    if not exists (select 1 from profiles where id = p_actor and status = 'active') then return; end if;
  end if;
  if p_moment is not null then
    select user_id, is_private into m_owner, m_private from moments where id = p_moment;
    if m_private and (p_user <> m_owner or p_type in ('like', 'comment', 'reply', 'friend_joined')) then
      return;
    end if;
  end if;
  insert into notifications (user_id, type, actor_id, jar_id, moment_id, comment_id)
  values (p_user, p_type, p_actor, p_jar, p_moment, p_comment);
end $$;
revoke execute on function public.notify(uuid, text, uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- likes
create or replace function public.reactions_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  recipient uuid;
  jid uuid;
begin
  if tg_op = 'INSERT' then
    if new.target = 'jar' then
      select user_id, id into recipient, jid from jars where id = new.target_id;
      perform notify(recipient, 'like', new.user_id, jid);
    elsif new.target = 'moment' then
      select user_id, jar_id into recipient, jid from moments where id = new.target_id;
      perform notify(recipient, 'like', new.user_id, jid, new.target_id);
    end if;
    return new;
  end if;
  -- Unlike: the unread like goes too, so an accidental tap leaves nothing behind.
  delete from notifications
  where type = 'like' and actor_id = old.user_id and read_at is null
    and ((old.target = 'jar' and jar_id = old.target_id and moment_id is null)
      or (old.target = 'moment' and moment_id = old.target_id));
  return old;
end $$;
create trigger reactions_notify after insert or delete on public.reactions
  for each row execute function public.reactions_notify();

-- ---------------------------------------------------------------- comments and replies
create or replace function public.comments_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jar_owner uuid;
  parent_author uuid;
begin
  if not (old.is_hidden and not new.is_hidden) or new.deleted_at is not null then return new; end if;
  select user_id into jar_owner from jars where id = new.jar_id;
  if new.parent_id is not null then
    select user_id into parent_author from comments where id = new.parent_id and deleted_at is null;
    perform notify(parent_author, 'reply', new.user_id, new.jar_id, null, new.id);
  end if;
  if jar_owner is distinct from parent_author then
    perform notify(jar_owner, 'comment', new.user_id, new.jar_id, null, new.id);
  end if;
  return new;
end $$;
create trigger comments_notify after update of is_hidden on public.comments
  for each row execute function public.comments_notify();

-- ---------------------------------------------------------------- removed and appeal decided
create or replace function public.moments_removed_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'removed' and old.status is distinct from 'removed' then
    perform notify(new.user_id, 'removed', null, new.jar_id, new.id);
  end if;
  return new;
end $$;
create trigger moments_removed_notify after update of status on public.moments
  for each row execute function public.moments_removed_notify();

create or replace function public.appeals_decided_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mid uuid;
  cid uuid;
  jid uuid;
begin
  if old.status = 'open' and new.status is distinct from 'open' then
    select mi.moment_id, mi.comment_id into mid, cid from moderation_items mi where mi.id = new.moderation_item_id;
    select jar_id into jid from moments where id = mid;
    perform notify(new.user_id, 'appeal_decided', null, jid, mid, cid);
  end if;
  return new;
end $$;
create trigger appeals_decided_notify after update of status on public.appeals
  for each row execute function public.appeals_decided_notify();

-- ---------------------------------------------------------------- friend joined
-- fn:contacts-match calls this with the people it matched in the caller's contacts. Only a newly joined
-- caller (account under 7 days old) is announced, and once per pair: a later Find friends visit writes
-- nothing new.
create or replace function public.notify_friend_joined(p_new_user uuid, p_friends uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  friend uuid;
  before int;
  after int;
begin
  if not exists (select 1 from profiles where id = p_new_user and created_at > now() - interval '7 days') then
    return 0;
  end if;
  select count(*) into before from notifications where actor_id = p_new_user and type = 'friend_joined';
  foreach friend in array coalesce(p_friends, '{}') loop
    if not exists (select 1 from notifications where user_id = friend and actor_id = p_new_user and type = 'friend_joined') then
      perform notify(friend, 'friend_joined', p_new_user);
    end if;
  end loop;
  select count(*) into after from notifications where actor_id = p_new_user and type = 'friend_joined';
  return after - before;
end $$;
revoke execute on function public.notify_friend_joined(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.notify_friend_joined(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------- blocks clear notifications
create or replace function public.blocks_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from follows where (reader_id = new.blocker_id and author_id = new.blocked_id)
                         or (reader_id = new.blocked_id and author_id = new.blocker_id);
  delete from notifications where (user_id = new.blocker_id and actor_id = new.blocked_id)
                               or (user_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end $$;

-- ---------------------------------------------------------------- preferences
create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  new_reader boolean not null default true,
  "like" boolean not null default true,
  comment boolean not null default true,
  reply boolean not null default true,
  full_jar boolean not null default true,
  removed boolean not null default true,
  appeal_decided boolean not null default true,
  friend_joined boolean not null default true,
  quiet_hours boolean not null default true,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  updated_at timestamptz not null default now()
);
comment on table public.notification_prefs is
  'Push toggles per notification type and quiet hours in profiles.home_tz (FR-NOT-04). Read by fn:send-push.';

alter table public.notification_prefs enable row level security;
create policy notification_prefs_owner_select on public.notification_prefs for select to authenticated
  using (user_id = auth.uid());
create policy notification_prefs_owner_update on public.notification_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant update (new_reader, "like", comment, reply, full_jar, removed, appeal_decided, friend_joined,
              quiet_hours, quiet_start, quiet_end) on public.notification_prefs to authenticated;

create or replace function public.notification_prefs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.notification_prefs_touch();

create or replace function public.profiles_create_notification_prefs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger profiles_create_notification_prefs after insert on public.profiles
  for each row execute function public.profiles_create_notification_prefs();

insert into public.notification_prefs (user_id) select id from public.profiles on conflict do nothing;
