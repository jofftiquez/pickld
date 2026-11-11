-- 0009 — month_jars RPC: the caller's jars for one calendar month, for My days (FR-DAY-01; D-9; M2-24).
-- Additive only: one new function, no table change.
--
-- month_jars(month) takes any date in the month and returns one row per jar of the caller's whose
-- local_date falls in it, oldest first:
--   * moment_count: the owner's count (every moment that isn't removed, D-9), for the fill bar;
--   * the cover: the first filled slot in the fixed slot order (whereami, mebusywith, whoamiwith, ootd,
--     selfie, morning, afternoon, evening; the order of the `slot` enum). Filled means the same moments
--     moment_count counts, with a thumbnail. The app turns cover_moment_id into a photo URL with
--     fn:photo-urls; cover_thumb_path is the key it will get.
--   * Empty jars (created by ensure_jar but never filled) are returned with count 0 and no cover.
-- Owner-only: there is no user parameter, it always reads auth.uid()'s jars. It runs as the caller
-- (security invoker), so RLS applies as well; a suspended owner still reads their own data (D-11).

create or replace function public.month_jars(month date)
returns table (
  jar_id uuid,
  local_date date,
  tz text,
  visibility jar_visibility,
  published_at timestamptz,
  moment_count smallint,
  is_full boolean,
  cover_moment_id uuid,
  cover_slot slot,
  cover_thumb_path text
)
language plpgsql stable set search_path = public as $$
#variable_conflict use_column
begin
  if month_jars.month is null then
    raise exception 'month is required' using errcode = '22023';
  end if;
  return query
  select j.id, j.local_date, j.tz, j.visibility, j.published_at, j.moment_count, j.is_full,
         c.id, c.slot, c.thumb_path
  from jars j
  left join lateral (
    select m.id, m.slot, m.thumb_path
    from moments m
    where m.jar_id = j.id and m.status <> 'removed' and m.thumb_path is not null
    order by m.slot
    limit 1
  ) c on true
  where j.user_id = auth.uid()
    and j.local_date >= date_trunc('month', month_jars.month)::date
    and j.local_date < (date_trunc('month', month_jars.month) + interval '1 month')::date
  order by j.local_date;
end $$;

revoke execute on function public.month_jars(date) from public, anon;
grant execute on function public.month_jars(date) to authenticated;
