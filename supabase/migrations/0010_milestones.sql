-- 0010 — Milestones, the Milestones pack and the full-jar notification (FR-STK-05, FR-JAR-07, FR-JAR-08;
-- D-8, D-9; M2-27). Additive only: no column is dropped or renamed.
--
-- The five FR-STK-05 milestones (D-8), keyed in `milestones.key`:
--   first_full_jar  1 full jar          full_jars_7  7 full jars
--   jars_30         30 jars             jars_100     100 jars
--   one_year        365 jars ("1 year of jars")
-- Counts use the owner's count (D-9): a jar counts once it has at least one moment that isn't removed
-- (moment_count > 0, the same rule as profiles.jar_count, FR-JAR-08); it is full at moment_count >= 8.
-- Each milestone is granted once: the primary key (user_id, key) and ON CONFLICT DO NOTHING keep the
-- first achieved_at, and nothing revokes a milestone when a moment is later deleted or removed.
-- Earning any milestone also grants the Milestones pack (owned_packs, source earned).
--
-- A jar reaching 8 moments writes one `full_jar` notification for its owner (FR-JAR-07: once per jar,
-- even if it drops below 8 and fills again). Triggers run on jars.moment_count, which
-- moments_count_sync (0003) keeps up to date on every moment insert, delete and status change.

-- ---------------------------------------------------------------- server-only writes
-- 0001 has select-only policies on these tables; take the unused write grants away from clients too.
revoke insert, update, delete on public.milestones from authenticated, anon;
revoke insert, update, delete on public.owned_packs from authenticated, anon;

-- ---------------------------------------------------------------- grant_milestones
-- Grants every milestone uid has reached and doesn't have yet; returns the newly granted keys.
create or replace function public.grant_milestones(uid uuid) returns setof text
language plpgsql security definer set search_path = public as $$
declare
  jars_n int;
  full_n int;
begin
  select count(*) filter (where moment_count > 0), count(*) filter (where moment_count >= 8)
    into jars_n, full_n
  from jars where user_id = uid;

  return query
  insert into milestones (user_id, key)
  select uid, v.key
  from (values ('first_full_jar', full_n >= 1),
               ('full_jars_7', full_n >= 7),
               ('jars_30', jars_n >= 30),
               ('jars_100', jars_n >= 100),
               ('one_year', jars_n >= 365)) as v(key, reached)
  where v.reached
  on conflict (user_id, key) do nothing
  returning milestones.key;

  if exists (select 1 from milestones where user_id = uid) then
    insert into owned_packs (user_id, pack_id, source)
    select uid, id, 'earned' from sticker_packs where slug = 'milestones'
    on conflict (user_id, pack_id) do nothing;
  end if;
end $$;
revoke execute on function public.grant_milestones(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- trigger
create or replace function public.jars_milestones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.moment_count < 8 and new.moment_count >= 8
     and not exists (select 1 from notifications where jar_id = new.id and type = 'full_jar') then
    insert into notifications (user_id, type, jar_id) values (new.user_id, 'full_jar', new.id);
  end if;
  -- Counts only go up when a jar gets its first moment or its 8th.
  if (old.moment_count = 0 and new.moment_count > 0) or (old.moment_count < 8 and new.moment_count >= 8) then
    perform grant_milestones(new.user_id);
  end if;
  return null;
end $$;
create trigger jars_milestones after update of moment_count on public.jars
  for each row when (old.moment_count is distinct from new.moment_count)
  execute function public.jars_milestones();

-- Existing accounts get what they have already reached (no notifications for the past).
select public.grant_milestones(id) from public.profiles;
