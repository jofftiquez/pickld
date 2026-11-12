-- 0030 — Memories RPCs: On this day, monthly recap and year summary (FR-DAY-03; M6-05).
-- Additive only: three new functions, no table change.
--
-- All three follow month_jars (0009): owner-only (no user parameter, they read auth.uid()'s jars), run as the
-- caller (security invoker, so RLS applies too), and count the owner's way (D-9): every moment that isn't
-- removed and isn't a pending replacement. The app passes dates in the phone's local calendar, the same
-- calendar jars are dated in. Photos come back as moment ids plus thumbnail keys; the app turns them into URLs
-- with fn:photo-urls, as it does for month_jars covers.
--
-- Hashtags in Pickld are the slot names (#selfie, #ootd…), so the recap's top tag is the slot filled most
-- often that month; a tie goes to the earlier slot in the fixed order.

-- ---------------------------------------------------------------- On this day
-- The caller's jars dated on today's month and day in earlier years, newest first, with at least one moment.
-- A Feb 29 jar only comes back on Feb 29.
create or replace function public.memories_on_this_day(today date)
returns table (
  jar_id uuid,
  local_date date,
  moment_count smallint,
  is_full boolean,
  cover_moment_id uuid,
  cover_slot slot,
  cover_thumb_path text
)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
begin
  if memories_on_this_day.today is null then
    raise exception 'today is required' using errcode = '22023';
  end if;
  return query
  select j.id, j.local_date, j.moment_count, j.is_full, c.id, c.slot, c.thumb_path
  from jars j
  left join lateral (
    select m.id, m.slot, m.thumb_path
    from moments m
    where m.jar_id = j.id and m.status <> 'removed' and m.replaces is null and m.thumb_path is not null
    order by m.slot
    limit 1
  ) c on true
  where j.user_id = auth.uid()
    and j.moment_count > 0
    and j.local_date < memories_on_this_day.today
    and extract(month from j.local_date) = extract(month from memories_on_this_day.today)
    and extract(day from j.local_date) = extract(day from memories_on_this_day.today)
  order by j.local_date desc;
end $$;

-- ---------------------------------------------------------------- monthly recap
-- One row for the month that `month` falls in: how many moments, how many full days, the top tag (null when
-- the month is empty) and a photo strip of up to five covers, one per jar, from the fullest days, in date
-- order: [{ "moment_id", "slot", "thumb_path", "local_date" }].
create or replace function public.memories_month_recap(month date)
returns table (
  moment_count int,
  full_days int,
  top_slot slot,
  strip jsonb
)
language plpgsql stable set search_path = public as $$
declare
  first_day date;
  next_first date;
begin
  if memories_month_recap.month is null then
    raise exception 'month is required' using errcode = '22023';
  end if;
  first_day := date_trunc('month', memories_month_recap.month)::date;
  next_first := (first_day + interval '1 month')::date;
  return query
  with mj as (
    select j.id, j.local_date, j.moment_count, j.is_full from jars j
    where j.user_id = auth.uid() and j.local_date >= first_day and j.local_date < next_first
  ),
  mm as (
    select m.id, m.jar_id, m.slot, m.thumb_path from moments m join mj on mj.id = m.jar_id
    where m.status <> 'removed' and m.replaces is null
  ),
  covers as (
    select mj.local_date, mj.moment_count, c.id, c.slot, c.thumb_path from mj
    join lateral (
      select mm.id, mm.slot, mm.thumb_path from mm where mm.jar_id = mj.id and mm.thumb_path is not null
      order by mm.slot limit 1
    ) c on true
    order by mj.moment_count desc, mj.local_date desc
    limit 5
  )
  select
    (select count(*)::int from mm),
    (select count(*)::int from mj where mj.is_full),
    (select mm.slot from mm group by mm.slot order by count(*) desc, mm.slot limit 1),
    coalesce((select jsonb_agg(jsonb_build_object('moment_id', cv.id, 'slot', cv.slot, 'thumb_path', cv.thumb_path,
                                                  'local_date', cv.local_date) order by cv.local_date)
              from covers cv), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- year summary
-- One row for a calendar year: jars with at least one moment, full days and moments.
create or replace function public.memories_year_summary(year int)
returns table (
  jars_filled int,
  full_days int,
  moment_count int
)
language plpgsql stable set search_path = public as $$
begin
  if memories_year_summary.year is null then
    raise exception 'year is required' using errcode = '22023';
  end if;
  return query
  select count(*) filter (where j.moment_count > 0)::int,
         count(*) filter (where j.is_full)::int,
         coalesce(sum(j.moment_count), 0)::int
  from jars j
  where j.user_id = auth.uid()
    and j.local_date >= make_date(memories_year_summary.year, 1, 1)
    and j.local_date < make_date(memories_year_summary.year + 1, 1, 1);
end $$;

revoke execute on function public.memories_on_this_day(date) from public, anon;
revoke execute on function public.memories_month_recap(date) from public, anon;
revoke execute on function public.memories_year_summary(int) from public, anon;
grant execute on function public.memories_on_this_day(date) to authenticated;
grant execute on function public.memories_month_recap(date) to authenticated;
grant execute on function public.memories_year_summary(int) to authenticated;
