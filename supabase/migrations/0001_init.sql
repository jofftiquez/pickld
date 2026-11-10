-- Pickld 2.0 — initial schema
-- Postgres 15+ on Supabase. Run with `supabase db push`.
-- Every visibility rule lives here. Pair RLS changes with pgTAP tests in supabase/tests.

create extension if not exists citext;

-- ---------------------------------------------------------------- enums
create type slot as enum ('whereami','mebusywith','whoamiwith','ootd','selfie','morning','afternoon','evening');
create type jar_visibility as enum ('readers','everyone','only_me');
create type moment_status as enum ('uploading','checking','live','removed');
create type profile_status as enum ('active','suspended','deleted');
create type day_slot as enum ('morning','afternoon','evening');
create type day_type as enum ('early_bird','coffee_first','night_owl');
create type pack_tier as enum ('free','premium','earned','seasonal');
create type pack_source as enum ('free','purchase','earned','subscription');
create type report_reason as enum ('sexual','harassment','violence','hate','spam','under_13','other');
create type mod_source as enum ('auto_check','report','appeal');
create type mod_status as enum ('pending','kept','removed','escalated');
create type target_type as enum ('jar','moment','comment','profile');

-- ---------------------------------------------------------------- helpers
create or replace function public.is_moderator() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'moderator', false)
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9._]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  bio text check (char_length(bio) <= 120),
  avatar_path text,
  cover_path text,
  birthday date not null,
  lid_color text not null default '#7fad33',
  home_tz text not null default 'Asia/Manila',
  default_visibility jar_visibility not null default 'readers',
  reader_count int not null default 0,
  author_count int not null default 0,
  jar_count int not null default 0,
  status profile_status not null default 'active',
  created_at timestamptz not null default now(),
  check (birthday <= (current_date - interval '13 years'))
);

-- Birthday is private: expose a public view without it.
create view public.public_profiles with (security_invoker = true) as
  select id, username, display_name, bio, avatar_path, cover_path, lid_color,
         reader_count, author_count, jar_count, created_at
  from public.profiles where status = 'active';

-- ---------------------------------------------------------------- graph
create table public.follows (
  reader_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reader_id, author_id),
  check (reader_id <> author_id)
);
create index follows_author_idx on public.follows (author_id, reader_id);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- ---------------------------------------------------------------- jars & moments
create table public.jars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  tz text not null,
  visibility jar_visibility not null default 'readers',
  published_at timestamptz,
  moment_count smallint not null default 0,
  is_full boolean generated always as (moment_count >= 8) stored,
  like_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);
create index jars_feed_idx on public.jars (user_id, updated_at desc) where published_at is not null;

-- End of a jar's day: next local midnight in the jar's own zone.
create or replace function public.jar_ends_at(j public.jars) returns timestamptz
language sql stable as $$
  select ((j.local_date + 1)::timestamp at time zone j.tz)
$$;

create table public.moments (
  id uuid primary key default gen_random_uuid(),
  jar_id uuid not null references public.jars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot slot not null,
  photo_path text,
  thumb_path text,
  caption text check (char_length(caption) <= 150),
  captured_at timestamptz,
  added_at timestamptz not null default now(),   -- server clock only
  is_backfilled boolean not null default false,  -- set by trigger
  is_private boolean not null default false,
  edits jsonb not null default '{}'::jsonb,       -- filter, stickers[], bubbles[], text[]
  status moment_status not null default 'uploading',
  like_count int not null default 0,
  unique (jar_id, slot)
);
create index moments_jar_idx on public.moments (jar_id);

-- Ensure owner matches jar, set server time and backfill flag, reject future jars.
create or replace function public.moments_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare j jars;
begin
  select * into j from jars where id = new.jar_id;
  if j.user_id <> new.user_id then raise exception 'moment owner must match jar owner'; end if;
  if (now() at time zone j.tz)::date < j.local_date then raise exception 'jar date is in the future for its time zone'; end if;
  new.added_at := now();
  new.is_backfilled := now() >= jar_ends_at(j);
  if new.status not in ('uploading','checking') then new.status := 'uploading'; end if; -- only server may set live/removed
  return new;
end $$;
create trigger moments_bi before insert on public.moments for each row execute function public.moments_before_insert();

-- Users may not promote their own moments to live/removed.
create or replace function public.moments_guard_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status in ('live','removed')
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'status can only be set by the server';
  end if;
  new.added_at := old.added_at; new.is_backfilled := old.is_backfilled;
  return new;
end $$;
create trigger moments_bu before update on public.moments for each row execute function public.moments_guard_status();

-- Keep jar counters fresh.
create or replace function public.moments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare jid uuid := coalesce(new.jar_id, old.jar_id);
begin
  update jars set moment_count = (select count(*) from moments where jar_id = jid and status <> 'removed'),
                  updated_at = now()
  where id = jid;
  update profiles p set jar_count = (select count(*) from jars where user_id = p.id and moment_count > 0)
  where p.id = (select user_id from jars where id = jid);
  return null;
end $$;
create trigger moments_count after insert or delete or update of status on public.moments
  for each row execute function public.moments_count_sync();

-- ---------------------------------------------------------------- visibility
create or replace function public.can_view_jar(viewer uuid, j public.jars) returns boolean
language sql stable security definer set search_path = public as $$
  select
    j.user_id = viewer
    or (
      j.published_at is not null
      and viewer is not null
      and not is_blocked_between(viewer, j.user_id)
      and exists (select 1 from profiles where id = j.user_id and status = 'active')
      and (
        j.visibility = 'everyone'
        or (j.visibility = 'readers' and exists (select 1 from follows where reader_id = viewer and author_id = j.user_id))
      )
    )
$$;

-- ---------------------------------------------------------------- social
create table public.reactions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target target_type not null check (target in ('jar','moment')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target, target_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  jar_id uuid not null references public.jars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  is_hidden boolean not null default true, -- set false by moderation function
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_jar_idx on public.comments (jar_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- new_reader, like, comment, reply, full_jar, removed, appeal_decided, friend_joined
  actor_id uuid references public.profiles(id) on delete set null,
  jar_id uuid references public.jars(id) on delete cascade,
  moment_id uuid references public.moments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text primary key,
  platform text not null check (platform in ('ios','android')),
  updated_at timestamptz not null default now()
);

-- Follow counters + new-reader notification; blocks drop follows both ways.
create or replace function public.follows_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if is_blocked_between(new.reader_id, new.author_id) then raise exception 'blocked'; end if;
    update profiles set author_count = author_count + 1 where id = new.reader_id;
    update profiles set reader_count = reader_count + 1 where id = new.author_id;
    insert into notifications (user_id, type, actor_id) values (new.author_id, 'new_reader', new.reader_id);
    return new;
  else
    update profiles set author_count = greatest(author_count - 1, 0) where id = old.reader_id;
    update profiles set reader_count = greatest(reader_count - 1, 0) where id = old.author_id;
    return old;
  end if;
end $$;
create trigger follows_ai after insert or delete on public.follows for each row execute function public.follows_sync();

create or replace function public.blocks_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from follows where (reader_id = new.blocker_id and author_id = new.blocked_id)
                         or (reader_id = new.blocked_id and author_id = new.blocker_id);
  return new;
end $$;
create trigger blocks_ai after insert on public.blocks for each row execute function public.blocks_sync();

-- ---------------------------------------------------------------- personal settings
create table public.reminder_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot day_slot not null,
  local_time time not null,
  enabled boolean not null default true,
  primary key (user_id, slot)
);

create table public.onboarding_answers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  day_type day_type,
  whoamiwith text[] not null default '{}',
  mebusywith text[] not null default '{}',
  ootd text,
  promise_accepted_at timestamptz
);

create table public.milestones (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  achieved_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------- stickers
create table public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tier pack_tier not null,
  store_product_id text,
  available_from timestamptz,
  available_to timestamptz,
  locale text,
  artist_id uuid,
  sort int not null default 0
);

create table public.stickers (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  label text not null,
  asset_path text not null,
  tags text[] not null default '{}',
  slot_hint slot,
  sort int not null default 0
);

create table public.owned_packs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  source pack_source not null,
  store_transaction_id text,
  acquired_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

create table public.user_pack_prefs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  sort int not null default 0,
  hidden boolean not null default false,
  primary key (user_id, pack_id)
);

-- ---------------------------------------------------------------- safety
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target target_type not null,
  target_id uuid not null,
  reason report_reason not null,
  note text check (char_length(note) <= 500),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.moderation_items (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid references public.moments(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  source mod_source not null,
  scores jsonb not null default '{}'::jsonb,
  second_opinion jsonb,
  status mod_status not null default 'pending',
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now()
);
create index moderation_queue_idx on public.moderation_items (status, created_at);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  moderation_item_id uuid not null unique references public.moderation_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text check (char_length(message) <= 500),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  target target_type,
  target_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Append only.
create or replace function public.audit_log_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.jars enable row level security;
alter table public.moments enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.onboarding_answers enable row level security;
alter table public.milestones enable row level security;
alter table public.sticker_packs enable row level security;
alter table public.stickers enable row level security;
alter table public.owned_packs enable row level security;
alter table public.user_pack_prefs enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_items enable row level security;
alter table public.appeals enable row level security;
alter table public.audit_log enable row level security;

-- profiles: full row (incl. birthday) to owner; others use public_profiles view.
create policy profiles_owner_select on public.profiles for select using (id = auth.uid());
create policy profiles_others_select on public.profiles for select
  using (status = 'active' and not public.is_blocked_between(auth.uid(), id));
create policy profiles_owner_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_owner_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- NOTE: revoke column-level select on birthday from authenticated; grant via owner-only RPC.
revoke select (birthday) on public.profiles from authenticated, anon;

-- follows
create policy follows_select on public.follows for select
  using (not public.is_blocked_between(auth.uid(), reader_id) and not public.is_blocked_between(auth.uid(), author_id));
create policy follows_insert on public.follows for insert with check (reader_id = auth.uid());
create policy follows_delete on public.follows for delete using (reader_id = auth.uid() or author_id = auth.uid());

-- blocks: owner only
create policy blocks_owner on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- jars
create policy jars_select on public.jars for select using (public.can_view_jar(auth.uid(), jars));
create policy jars_insert on public.jars for insert with check (user_id = auth.uid());
create policy jars_update on public.jars for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy jars_delete on public.jars for delete using (user_id = auth.uid());

-- moments: owner sees all; others only live, non-private, in a viewable jar
create policy moments_owner on public.moments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy moments_others_select on public.moments for select using (
  status = 'live' and not is_private
  and exists (select 1 from public.jars j where j.id = jar_id and public.can_view_jar(auth.uid(), j))
);

-- reactions
create policy reactions_select on public.reactions for select using (
  (target = 'jar' and exists (select 1 from public.jars j where j.id = target_id and public.can_view_jar(auth.uid(), j)))
  or (target = 'moment' and exists (select 1 from public.moments m where m.id = target_id))
);
create policy reactions_insert on public.reactions for insert with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete using (user_id = auth.uid());

-- comments
create policy comments_select on public.comments for select using (
  deleted_at is null
  and exists (select 1 from public.jars j where j.id = jar_id and public.can_view_jar(auth.uid(), j))
  and (not is_hidden or user_id = auth.uid())
  and not public.is_blocked_between(auth.uid(), user_id)
);
create policy comments_insert on public.comments for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.jars j where j.id = jar_id and public.can_view_jar(auth.uid(), j))
);
create policy comments_soft_delete on public.comments for update using (
  user_id = auth.uid() or exists (select 1 from public.jars j where j.id = jar_id and j.user_id = auth.uid())
);

-- owner-only tables
create policy notifications_owner on public.notifications for select using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update using (user_id = auth.uid());
create policy push_tokens_owner on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminders_owner on public.reminder_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy onboarding_owner on public.onboarding_answers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy milestones_owner on public.milestones for select using (user_id = auth.uid());
create policy pack_prefs_owner on public.user_pack_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy owned_packs_owner on public.owned_packs for select using (user_id = auth.uid()); -- writes: server only

-- catalog: readable by all signed-in users
create policy packs_read on public.sticker_packs for select using (auth.role() = 'authenticated');
create policy stickers_read on public.stickers for select using (auth.role() = 'authenticated');

-- safety
create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_mod on public.reports for select using (public.is_moderator());
create policy mod_items_mod on public.moderation_items for all using (public.is_moderator()) with check (public.is_moderator());
create policy appeals_owner_insert on public.appeals for insert with check (user_id = auth.uid());
create policy appeals_owner_select on public.appeals for select using (user_id = auth.uid() or public.is_moderator());
create policy appeals_mod_update on public.appeals for update using (public.is_moderator());
create policy audit_mod_select on public.audit_log for select using (public.is_moderator());

-- ---------------------------------------------------------------- seed: free sticker packs
insert into public.sticker_packs (slug, name, tier, sort) values
  ('everyday', 'Everyday', 'free', 1),
  ('the-eight', 'The Eight', 'free', 2),
  ('stamps', 'Stamps', 'free', 3),
  ('milestones', 'Milestones', 'earned', 4);
