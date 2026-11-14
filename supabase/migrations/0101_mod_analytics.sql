-- 0101 — The console's Analytics page and a person's usage on their Users page (FR-MOD-09). Additive: new
-- functions only. Like mod_overview() (0090) they refuse anyone without app_metadata.role = 'moderator' in the
-- JWT and are owned by the migration owner.
--
-- Everything is a count or a total; no photo, caption or path of a moment leaves these functions (rule 10).
-- Only me moments are never counted (rule 9), nor removed ones or ones still uploading. A sticker use is one
-- sticker overlay (moments.edits -> 'overlays', type 'sticker') on a counted moment. Days are Manila days,
-- as on the Overview.
--
--   mod_analytics(p_days)          moments, people posting and sign-ups per day, moments per slot, and the
--                                  same numbers by age band and by home time zone. A group of fewer than five
--                                  people shows no numbers (age bands) or folds into "Other zones" (zones).
--   mod_analytics_stickers(p_days) per pack: owners, acquisitions by source, people who used it and uses; per
--                                  sticker: uses this window and the window before (the trend); uses per day.
--   mod_user_stats(p_user, p_days) one person's moments per day and per slot, the stickers they used most and
--                                  the packs they own.
-- p_days is clamped to 7–90.

create or replace function public.mod_analytics_moments()
returns table (id uuid, user_id uuid, slot slot, added_at timestamptz, day date, edits jsonb)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, m.slot, m.added_at, (m.added_at at time zone 'Asia/Manila')::date, m.edits
  from moments m
  where m.visibility <> 'only_me' and not m.is_private and m.status in ('checking', 'live')
$$;

-- One row per sticker overlay on a counted moment. A stickerId that isn't a uuid is skipped.
create or replace function public.mod_analytics_sticker_uses()
returns table (moment_id uuid, user_id uuid, day date, sticker_id uuid)
language sql stable security definer set search_path = public as $$
  select m.id, m.user_id, m.day, (o ->> 'stickerId')::uuid
  from mod_analytics_moments() m
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(m.edits -> 'overlays') = 'array' then m.edits -> 'overlays' else '[]'::jsonb end) o
  where o ->> 'type' = 'sticker'
    and o ->> 'stickerId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

create or replace function public.mod_age_band(p_birthday date) returns text
language sql stable set search_path = public as $$
  select case
    when p_birthday is null then 'Not given'
    when extract(year from age((now() at time zone 'Asia/Manila')::date, p_birthday)) < 18 then '13–17'
    when extract(year from age((now() at time zone 'Asia/Manila')::date, p_birthday)) < 25 then '18–24'
    when extract(year from age((now() at time zone 'Asia/Manila')::date, p_birthday)) < 35 then '25–34'
    when extract(year from age((now() at time zone 'Asia/Manila')::date, p_birthday)) < 45 then '35–44'
    else '45+' end
$$;

-- ---------------------------------------------------------------- site-wide
create or replace function public.mod_analytics(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 7), 90);
  first_day date;
  today date;
  out jsonb;
begin
  perform mod_require_moderator();
  today := (mod_day_start() at time zone 'Asia/Manila')::date;
  first_day := today - (days - 1);

  with m as (select * from mod_analytics_moments()),
       w as (select * from m where day >= first_day),
       people as (select id, birthday, home_tz, created_at from profiles where status <> 'deleted'),
       posters as (select user_id, count(*) as n from w group by user_id),
       ages as (
         select mod_age_band(p.birthday) as band, count(*) as people,
                count(po.user_id) as posters, coalesce(sum(po.n), 0) as moments
         from people p left join posters po on po.user_id = p.id
         group by 1),
       zones as (
         select p.home_tz as zone, count(*) as people,
                count(po.user_id) as posters, coalesce(sum(po.n), 0) as moments
         from people p left join posters po on po.user_id = p.id
         group by 1),
       zones_folded as (
         select case when people >= 5 then zone else 'Other zones' end as zone,
                sum(people) as people, sum(posters) as posters, sum(moments) as moments
         from zones group by 1)
  select jsonb_build_object(
    'days', days,
    'first_day', first_day,
    'totals', jsonb_build_object(
      'people', (select count(*) from people),
      'moments_all_time', (select count(*) from m),
      'moments', (select count(*) from w),
      'posters', (select count(*) from posters),
      'signups', (select count(*) from people where (created_at at time zone 'Asia/Manila')::date >= first_day),
      'with_stickers', (select count(*) from w where exists (
        select 1 from jsonb_array_elements(
          case when jsonb_typeof(w.edits -> 'overlays') = 'array' then w.edits -> 'overlays' else '[]'::jsonb end) o
        where o ->> 'type' = 'sticker'))),
    'per_day', (
      select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'moments', (select count(*) from w where w.day = d.day),
               'posters', (select count(distinct user_id) from w where w.day = d.day),
               'signups', (select count(*) from people
                           where (people.created_at at time zone 'Asia/Manila')::date = d.day))
             order by d.day)
      from (select g::date as day from generate_series(first_day, today, interval '1 day') g) as d),
    'per_slot', (
      select jsonb_agg(jsonb_build_object('slot', s.slot, 'moments', (select count(*) from w where w.slot = s.slot))
             order by array_position(enum_range(null::slot), s.slot))
      from unnest(enum_range(null::slot)) as s(slot)),
    'age_bands', (
      select jsonb_agg(case when coalesce(a.people, 0) >= 5
               then jsonb_build_object('band', b.band, 'people', a.people, 'posters', a.posters, 'moments', a.moments)
               else jsonb_build_object('band', b.band, 'hidden', true) end
             order by b.ord)
      from unnest(array['13–17', '18–24', '25–34', '35–44', '45+', 'Not given']) with ordinality as b(band, ord)
      left join ages a on a.band = b.band),
    'zones', coalesce((
      select jsonb_agg(case when z.people >= 5
               then jsonb_build_object('zone', z.zone, 'people', z.people, 'posters', z.posters, 'moments', z.moments)
               else jsonb_build_object('zone', z.zone, 'hidden', true) end
             order by (z.zone = 'Other zones'), z.people desc, z.zone)
      from zones_folded z), '[]'::jsonb))
  into out;
  return out;
end $$;

-- ---------------------------------------------------------------- stickers
create or replace function public.mod_analytics_stickers(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 7), 90);
  first_day date;
  prev_day date;
  today date;
  out jsonb;
begin
  perform mod_require_moderator();
  today := (mod_day_start() at time zone 'Asia/Manila')::date;
  first_day := today - (days - 1);
  prev_day := first_day - days;

  with u as (select u.*, s.pack_id from mod_analytics_sticker_uses() u join stickers s on s.id = u.sticker_id),
       per_sticker as (
         select sticker_id,
                count(*) as uses_total,
                count(*) filter (where day >= first_day) as uses,
                count(*) filter (where day >= prev_day and day < first_day) as uses_before,
                count(distinct user_id) filter (where day >= first_day) as people
         from u group by sticker_id),
       per_pack as (
         select pack_id,
                count(*) as uses_total,
                count(*) filter (where day >= first_day) as uses,
                count(*) filter (where day >= prev_day and day < first_day) as uses_before,
                count(distinct user_id) filter (where day >= first_day) as people,
                count(distinct user_id) as people_all_time
         from u group by pack_id),
       owned as (
         select pack_id, sum(n) as owners, sum(acquired) as acquired, jsonb_object_agg(source, n) as by_source
         from (select pack_id, source, count(*) as n,
                      count(*) filter (where (acquired_at at time zone 'Asia/Manila')::date >= first_day) as acquired
               from owned_packs group by pack_id, source) g
         group by pack_id)
  select jsonb_build_object(
    'days', days,
    'first_day', first_day,
    'totals', jsonb_build_object(
      'uses', (select count(*) from u where day >= first_day),
      'uses_before', (select count(*) from u where day >= prev_day and day < first_day),
      'people', (select count(distinct user_id) from u where day >= first_day),
      'acquired', (select count(*) from owned_packs
                   where (acquired_at at time zone 'Asia/Manila')::date >= first_day)),
    'per_day', (
      select jsonb_agg(jsonb_build_object(
               'day', d.day,
               'uses', (select count(*) from u where u.day = d.day),
               'acquired', (select count(*) from owned_packs
                            where (acquired_at at time zone 'Asia/Manila')::date = d.day))
             order by d.day)
      from (select g::date as day from generate_series(first_day, today, interval '1 day') g) as d),
    'packs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'slug', p.slug, 'name', p.name, 'tier', p.tier, 'status', p.status,
               'stickers', (select count(*) from stickers s where s.pack_id = p.id and s.retired_at is null),
               'owners', coalesce(o.owners, 0), 'acquired', coalesce(o.acquired, 0),
               'by_source', coalesce(o.by_source, '{}'::jsonb),
               'people', coalesce(pp.people, 0), 'people_all_time', coalesce(pp.people_all_time, 0),
               'uses', coalesce(pp.uses, 0), 'uses_before', coalesce(pp.uses_before, 0),
               'uses_total', coalesce(pp.uses_total, 0))
             order by coalesce(pp.uses, 0) desc, coalesce(o.owners, 0) desc, p.sort, p.slug)
      from sticker_packs p
      left join owned o on o.pack_id = p.id
      left join per_pack pp on pp.pack_id = p.id), '[]'::jsonb),
    'stickers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'label', s.label, 'pack', p.slug, 'asset_path', s.asset_path,
               'art_version', s.art_version, 'retired', s.retired_at is not null,
               'uses', ps.uses, 'uses_before', ps.uses_before, 'people', ps.people, 'uses_total', ps.uses_total)
             order by ps.uses desc, ps.uses_total desc, s.label)
      from (select * from per_sticker order by uses desc, uses_total desc limit 100) ps
      join stickers s on s.id = ps.sticker_id
      join sticker_packs p on p.id = s.pack_id), '[]'::jsonb))
  into out;
  return out;
end $$;

-- ---------------------------------------------------------------- one person
create or replace function public.mod_user_stats(p_user uuid, p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 7), 90);
  first_day date;
  today date;
  out jsonb;
begin
  perform mod_require_moderator();
  if not exists (select 1 from profiles where id = p_user) then
    return null;
  end if;
  today := (mod_day_start() at time zone 'Asia/Manila')::date;
  first_day := today - (days - 1);

  with m as (select * from mod_analytics_moments() where user_id = p_user),
       w as (select * from m where day >= first_day),
       u as (select * from mod_analytics_sticker_uses() where user_id = p_user)
  select jsonb_build_object(
    'days', days,
    'first_day', first_day,
    'moments_all_time', (select count(*) from m),
    'moments', (select count(*) from w),
    'active_days', (select count(distinct day) from w),
    'last_added_at', (select max(added_at) from m),
    'per_day', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'moments', (select count(*) from w where w.day = d.day))
             order by d.day)
      from (select g::date as day from generate_series(first_day, today, interval '1 day') g) as d),
    'per_slot', (
      select jsonb_agg(jsonb_build_object('slot', s.slot, 'moments', (select count(*) from w where w.slot = s.slot))
             order by array_position(enum_range(null::slot), s.slot))
      from unnest(enum_range(null::slot)) as s(slot)),
    'stickers', coalesce((
      select jsonb_agg(jsonb_build_object('label', s.label, 'pack', p.slug, 'uses', x.n) order by x.n desc, s.label)
      from (select sticker_id, count(*) as n from u group by sticker_id order by n desc limit 10) x
      join stickers s on s.id = x.sticker_id
      join sticker_packs p on p.id = s.pack_id), '[]'::jsonb),
    'packs', coalesce((
      select jsonb_agg(jsonb_build_object('slug', p.slug, 'name', p.name, 'source', o.source,
                                          'acquired_at', o.acquired_at) order by o.acquired_at desc)
      from owned_packs o join sticker_packs p on p.id = o.pack_id
      where o.user_id = p_user), '[]'::jsonb))
  into out;
  return out;
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.mod_analytics_moments() from public, anon, authenticated;
revoke all on function public.mod_analytics_sticker_uses() from public, anon, authenticated;
revoke all on function public.mod_age_band(date) from public, anon, authenticated;
revoke all on function public.mod_analytics(int) from public, anon;
revoke all on function public.mod_analytics_stickers(int) from public, anon;
revoke all on function public.mod_user_stats(uuid, int) from public, anon;
grant execute on function public.mod_analytics(int) to authenticated;
grant execute on function public.mod_analytics_stickers(int) to authenticated;
grant execute on function public.mod_user_stats(uuid, int) to authenticated;
