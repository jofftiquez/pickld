-- 0172 — Mention stickers and caption @mentions tag people on a moment. Additive: one table, functions and
-- triggers, one notification type and one push switch. Nothing is dropped or rewritten; push_take (0135) and
-- notify (0066) are replaced with one more case each.
--
-- The rules (decided by Joff):
--   * Only mutual readers can be tagged: the author reads them and they read the author. Neither may have
--     blocked the other, and the tagged account must be active.
--   * A tag comes from a mention overlay in `edits` ({ type: 'mention', userId, username, ... }) or an
--     @username in the caption. Postgres is the referee (rule 1): before every write, mention overlays the
--     author may not use are dropped from edits and pending_edits, and each kept one gets the person's
--     current username. Caption words are never changed; an @name that isn't allowed just stays text.
--   * moment_tags holds one row per tagged person, made and removed only by the triggers here. It follows
--     what is shown (edits and caption), not a pending proposal, so a tag on a live moment appears once
--     fn:moderate applies the edit.
--   * A tag that already exists stays allowed while it is shown, even if the two stop reading each other.
--   * The tagged person is told once (notification 'tag', push behind notification_prefs.tag), when the
--     moment is live, not Only me and not hidden. A tagged person who muted the author isn't told (the mute
--     stays private: the tag still happens).
--   * The tagged person can remove their tag (remove_moment_tag): the sticker leaves edits and pending_edits,
--     the caption stops linking them, the author isn't told, and they can't be tagged on that moment again.
--   * A block either way removes every tag between the two the same way, and blocks new ones.
--   * Readers see a tag (to link it) only when they can see the moment, aren't blocked either way with the
--     tagged person, and that account is active. The author and the tagged person always see it.

-- ---------------------------------------------------------------- the table
create table public.moment_tags (
  moment_id uuid not null references public.moments(id) on delete cascade,
  tagged_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  removed_at timestamptz,
  primary key (moment_id, tagged_id),
  check (tagged_id <> author_id)
);
comment on table public.moment_tags is
  'People tagged on a moment by a mention sticker or a caption @mention (0172). Written only by triggers.';
create index moment_tags_tagged_idx on public.moment_tags (tagged_id);
create index moment_tags_author_idx on public.moment_tags (author_id);

-- Whether `viewer` may see a tag (to draw it as a link): see the header.
create or replace function public.can_see_tag(viewer uuid, t public.moment_tags) returns boolean
language sql stable security definer set search_path = public as $$
  select t.removed_at is null and viewer is not null and (
    viewer = t.author_id or viewer = t.tagged_id
    or (not is_blocked_between(viewer, t.tagged_id)
        and exists (select 1 from profiles p where p.id = t.tagged_id and p.status = 'active')
        and exists (select 1 from moments m where m.id = t.moment_id and can_view_moment(viewer, m))))
$$;
revoke execute on function public.can_see_tag(uuid, public.moment_tags) from public, anon;
grant execute on function public.can_see_tag(uuid, public.moment_tags) to authenticated, service_role;

alter table public.moment_tags enable row level security;
revoke all on public.moment_tags from anon, authenticated;
grant select (moment_id, tagged_id) on public.moment_tags to authenticated;
create policy moment_tags_select on public.moment_tags for select to authenticated
  using (public.can_see_tag(auth.uid(), moment_tags));

-- ---------------------------------------------------------------- who may be tagged
-- Mutual readers, nobody blocked either way, an active account, and not someone who took their tag off this
-- moment; a tag already on the moment stays allowed.
create or replace function public.can_tag(p_author uuid, p_tagged uuid, p_moment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_author is not null and p_tagged is not null and p_author <> p_tagged
     and not is_blocked_between(p_author, p_tagged)
     and exists (select 1 from profiles where id = p_tagged and status = 'active')
     and not exists (select 1 from moment_tags t
                     where t.moment_id = p_moment and t.tagged_id = p_tagged and t.removed_at is not null)
     and (exists (select 1 from moment_tags t
                  where t.moment_id = p_moment and t.tagged_id = p_tagged and t.removed_at is null)
          or (exists (select 1 from follows where reader_id = p_author and author_id = p_tagged)
              and exists (select 1 from follows where reader_id = p_tagged and author_id = p_author)))
$$;
revoke execute on function public.can_tag(uuid, uuid, uuid) from public, anon, authenticated;

-- The people the caller may tag (the editor's Mention tool and caption suggestions): mutual readers, best match
-- on username or name first, then by username. Search relevance only, never engagement (rule 15).
create or replace function public.taggable_people(p_query text default '', p_limit int default 20)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar_path
  from follows f
  join follows back on back.reader_id = f.author_id and back.author_id = f.reader_id
  join profiles p on p.id = f.author_id and p.status = 'active'
  where f.reader_id = auth.uid()
    and not is_blocked_between(auth.uid(), p.id)
    and (coalesce(trim(p_query), '') = ''
         or p.username ilike ltrim(trim(p_query), '@') || '%'
         or p.display_name ilike '%' || trim(p_query) || '%')
  order by (p.username ilike ltrim(trim(p_query), '@') || '%') desc, p.username
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;
revoke execute on function public.taggable_people(text, int) from public, anon;
grant execute on function public.taggable_people(text, int) to authenticated;

-- `edits` with only the mention overlays the author may use, each with the person's current username.
create or replace function public.edits_allowed_mentions(p_edits jsonb, p_author uuid, p_moment uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  kept jsonb := '[]'::jsonb;
  o jsonb;
  who uuid;
  name text;
begin
  if p_edits is null or jsonb_typeof(p_edits -> 'overlays') is distinct from 'array'
     or not jsonb_path_exists(p_edits, '$.overlays[*] ? (@.type == "mention")') then
    return p_edits;
  end if;
  for o in select value from jsonb_array_elements(p_edits -> 'overlays') loop
    if o ->> 'type' = 'mention' then
      if coalesce(o ->> 'userId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        continue;
      end if;
      who := (o ->> 'userId')::uuid;
      if not can_tag(p_author, who, p_moment) then continue; end if;
      select username::text into name from profiles where id = who;
      o := jsonb_set(o, '{username}', to_jsonb(name));
    end if;
    kept := kept || jsonb_build_array(o);
  end loop;
  return jsonb_set(p_edits, '{overlays}', kept);
end $$;
revoke execute on function public.edits_allowed_mentions(jsonb, uuid, uuid) from public, anon, authenticated;

-- People an @username in a caption names (usernames are 3–20 of A–Z, 0–9, dot and underscore; a dot that
-- ends a sentence still finds the name before it).
create or replace function public.caption_mentioned(p_caption text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct p.id
  from regexp_matches(coalesce(p_caption, ''), '(?:^|[^A-Za-z0-9._@])@([A-Za-z0-9._]{3,20})', 'g') as m(g)
  join profiles p on p.username = m.g[1]::citext or p.username = rtrim(m.g[1], '.')::citext
$$;
revoke execute on function public.caption_mentioned(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- before a write: drop what isn't allowed
-- Named to run after moments_bu (0011), which may move an edit into pending_edits, so both are checked.
create or replace function public.moments_tags_sanitize() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.edits := edits_allowed_mentions(new.edits, new.user_id, new.id);
  new.pending_edits := edits_allowed_mentions(new.pending_edits, new.user_id, new.id);
  return new;
end $$;
create trigger moments_tags_sanitize before insert or update on public.moments
  for each row execute function public.moments_tags_sanitize();

-- ---------------------------------------------------------------- after a write: tags follow what is shown
create or replace function public.moments_tags_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted uuid[];
  r record;
begin
  if tg_op = 'UPDATE'
     and new.edits is not distinct from old.edits and new.caption is not distinct from old.caption
     and new.status is not distinct from old.status and new.visibility is not distinct from old.visibility
     and new.hidden_at is not distinct from old.hidden_at then
    return null;
  end if;

  select coalesce(array_agg(distinct u), '{}') into wanted from (
    select (o ->> 'userId')::uuid as u
    from jsonb_array_elements(case when jsonb_typeof(new.edits -> 'overlays') = 'array'
                                   then new.edits -> 'overlays' else '[]'::jsonb end) o
    where o ->> 'type' = 'mention' -- already checked by moments_tags_sanitize
    union
    select c from caption_mentioned(new.caption) c where can_tag(new.user_id, c, new.id)
  ) s;

  delete from moment_tags where moment_id = new.id and removed_at is null and not (tagged_id = any (wanted));
  insert into moment_tags (moment_id, tagged_id, author_id)
  select new.id, u, new.user_id from unnest(wanted) u
  on conflict (moment_id, tagged_id) do nothing;

  if new.status = 'live' and new.visibility <> 'only_me' and new.hidden_at is null then
    for r in
      update moment_tags set notified_at = now()
      where moment_id = new.id and removed_at is null and notified_at is null
      returning tagged_id
    loop
      if not exists (select 1 from mutes where muter_id = r.tagged_id and muted_id = new.user_id) then
        perform notify(r.tagged_id, 'tag', new.user_id, new.jar_id, new.id);
      end if;
    end loop;
  end if;
  return null;
end $$;
create trigger moments_tags_sync after insert or update on public.moments
  for each row execute function public.moments_tags_sync();

-- ---------------------------------------------------------------- taking a tag off
-- Marks the tag removed and takes that person's mention stickers out of the moment (shown and proposed).
create or replace function public.untag_moment(p_moment uuid, p_tagged uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  drop_them constant jsonpath := '$.overlays[*] ? (@.type != "mention" || @.userId != $who)';
begin
  insert into moment_tags (moment_id, tagged_id, author_id, removed_at)
  select p_moment, p_tagged, m.user_id, now() from moments m where m.id = p_moment and m.user_id <> p_tagged
  on conflict (moment_id, tagged_id) do update set removed_at = coalesce(moment_tags.removed_at, now());
  update moments m set
    edits = case when jsonb_typeof(m.edits -> 'overlays') = 'array'
                 then jsonb_set(m.edits, '{overlays}', coalesce(jsonb_path_query_array(m.edits, drop_them,
                        jsonb_build_object('who', p_tagged::text)), '[]'::jsonb))
                 else m.edits end,
    pending_edits = case when jsonb_typeof(m.pending_edits -> 'overlays') = 'array'
                 then jsonb_set(m.pending_edits, '{overlays}', coalesce(jsonb_path_query_array(m.pending_edits, drop_them,
                        jsonb_build_object('who', p_tagged::text)), '[]'::jsonb))
                 else m.pending_edits end
  where m.id = p_moment
    and (jsonb_path_exists(m.edits, '$.overlays[*] ? (@.type == "mention" && @.userId == $who)',
                           jsonb_build_object('who', p_tagged::text))
         or jsonb_path_exists(m.pending_edits, '$.overlays[*] ? (@.type == "mention" && @.userId == $who)',
                              jsonb_build_object('who', p_tagged::text)));
  delete from notifications where user_id = p_tagged and type = 'tag' and moment_id = p_moment;
end $$;
revoke execute on function public.untag_moment(uuid, uuid) from public, anon, authenticated;

-- The tagged person takes their own tag off a moment.
create or replace function public.remove_moment_tag(p_moment uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from moment_tags where moment_id = p_moment and tagged_id = auth.uid()) then
    return; -- nothing to remove; says nothing about the moment
  end if;
  perform untag_moment(p_moment, auth.uid());
end $$;
revoke execute on function public.remove_moment_tag(uuid) from public, anon;
grant execute on function public.remove_moment_tag(uuid) to authenticated;

-- A block either way removes every tag between the two.
create or replace function public.blocks_untag() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select moment_id, tagged_id from moment_tags
    where removed_at is null
      and ((author_id = new.blocker_id and tagged_id = new.blocked_id)
           or (author_id = new.blocked_id and tagged_id = new.blocker_id))
  loop
    perform untag_moment(r.moment_id, r.tagged_id);
  end loop;
  return null;
end $$;
create trigger blocks_untag after insert on public.blocks
  for each row execute function public.blocks_untag();

-- ---------------------------------------------------------------- the notification and its push switch
alter table public.notifications drop constraint notifications_type_known;
alter table public.notifications
  add constraint notifications_type_known check (type in (
    'new_reader', 'like', 'comment', 'reply', 'full_jar', 'removed', 'appeal_decided', 'friend_joined', 'admitted',
    'invite_joined', 'tag'
  ));

alter table public.notification_prefs add column tag boolean not null default true;
comment on column public.notification_prefs.tag is 'Push when someone tags you in a moment (0172).';
grant update (tag) on public.notification_prefs to authenticated;

-- As 0066, with tag added to what an Only me moment never notifies.
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
    if m_only_me and (p_user <> m_owner or p_type in ('like', 'comment', 'reply', 'friend_joined', 'tag')) then
      return;
    end if;
  end if;
  insert into notifications (user_id, type, actor_id, jar_id, moment_id, comment_id)
  values (p_user, p_type, p_actor, p_jar, p_moment, p_comment);
end $$;

-- As 0135, with tag following notification_prefs.tag.
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
