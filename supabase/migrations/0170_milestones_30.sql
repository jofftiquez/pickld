-- 0170 — Milestones grows to 30 (FR-STK-05). Additive only: a widened check, grant_milestones() redefined with
-- more counts, new rows. Nothing is dropped, renamed or deleted, and no milestone already granted changes.
--
-- Product owner, Nov 18–19: every pack has at least 30 stickers, Milestones too. 18 new count milestones (counts as
-- in 0010, D-9: a jar counts once it has a moment that isn't removed; it is full at 8), one badge each:
--   jars        14, 75, 150, 250, 300, 500, 2 years (730), 1000, 3 years (1095)
--   full jars    3, 14, 50, 75, 150, 200, 250, 365, 500
-- Like the others, each is granted once and never revoked; earning any grants the Milestones pack. Accounts that
-- already reached one get it now (as 0010 and 0060 did); the app records milestones it finds on first sight
-- without celebrating them (nextCelebration).
--
-- Art: gold rosette badges (0168) rendered by scripts/render-stickers.mjs at 1024 px, quantised, bundled in
-- stickerArt.ts. Upload with `cd workers/photos && deno task stickers`.

alter table public.stickers drop constraint stickers_milestone_key_check;
alter table public.stickers add constraint stickers_milestone_key_check
  check (milestone_key in ('first_full_jar', 'full_jars_7', 'jars_30', 'jars_100', 'one_year',
                           'jars_7', 'full_jars_30', 'jars_50', 'full_jars_100', 'jars_200',
                           'first_friend', 'full_jar_of_friends',
                           'jars_14', 'jars_75', 'jars_150', 'jars_250', 'jars_300', 'jars_500', 'two_years',
                           'jars_1000', 'three_years',
                           'full_jars_3', 'full_jars_14', 'full_jars_50', 'full_jars_75', 'full_jars_150',
                           'full_jars_200', 'full_jars_250', 'full_jars_365', 'full_jars_500'));

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
               ('one_year', jars_n >= 365),
               ('jars_7', jars_n >= 7),
               ('full_jars_30', full_n >= 30),
               ('jars_50', jars_n >= 50),
               ('full_jars_100', full_n >= 100),
               ('jars_200', jars_n >= 200),
               ('jars_14', jars_n >= 14),
               ('jars_75', jars_n >= 75),
               ('jars_150', jars_n >= 150),
               ('jars_250', jars_n >= 250),
               ('jars_300', jars_n >= 300),
               ('jars_500', jars_n >= 500),
               ('two_years', jars_n >= 730),
               ('jars_1000', jars_n >= 1000),
               ('three_years', jars_n >= 1095),
               ('full_jars_3', full_n >= 3),
               ('full_jars_14', full_n >= 14),
               ('full_jars_50', full_n >= 50),
               ('full_jars_75', full_n >= 75),
               ('full_jars_150', full_n >= 150),
               ('full_jars_200', full_n >= 200),
               ('full_jars_250', full_n >= 250),
               ('full_jars_365', full_n >= 365),
               ('full_jars_500', full_n >= 500)) as v(key, reached)
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

insert into public.stickers (id, pack_id, label, asset_path, tags, milestone_key, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.milestone_key, v.sort, 896, 1024
from (values
  (13, '14 jars',          'stickers/milestones/jars-14-v2.png',        '{milestone,jars}'::text[],      'jars_14'),
  (14, '75 jars',          'stickers/milestones/jars-75-v2.png',        '{milestone,jars}'::text[],      'jars_75'),
  (15, '150 jars',         'stickers/milestones/jars-150-v2.png',       '{milestone,jars}'::text[],      'jars_150'),
  (16, '250 jars',         'stickers/milestones/jars-250-v2.png',       '{milestone,jars}'::text[],      'jars_250'),
  (17, '300 jars',         'stickers/milestones/jars-300-v2.png',       '{milestone,jars}'::text[],      'jars_300'),
  (18, '500 jars',         'stickers/milestones/jars-500-v2.png',       '{milestone,jars}'::text[],      'jars_500'),
  (19, '2 years of jars',  'stickers/milestones/two-years-v2.png',      '{milestone,year}'::text[],      'two_years'),
  (20, '1000 jars',        'stickers/milestones/jars-1000-v2.png',      '{milestone,jars}'::text[],      'jars_1000'),
  (21, '3 years of jars',  'stickers/milestones/three-years-v2.png',    '{milestone,year}'::text[],      'three_years'),
  (22, '3 full jars',      'stickers/milestones/full-jars-3-v2.png',    '{milestone,full}'::text[],      'full_jars_3'),
  (23, '14 full jars',     'stickers/milestones/full-jars-14-v2.png',   '{milestone,full}'::text[],      'full_jars_14'),
  (24, '50 full jars',     'stickers/milestones/full-jars-50-v2.png',   '{milestone,full}'::text[],      'full_jars_50'),
  (25, '75 full jars',     'stickers/milestones/full-jars-75-v2.png',   '{milestone,full}'::text[],      'full_jars_75'),
  (26, '150 full jars',    'stickers/milestones/full-jars-150-v2.png',  '{milestone,full}'::text[],      'full_jars_150'),
  (27, '200 full jars',    'stickers/milestones/full-jars-200-v2.png',  '{milestone,full}'::text[],      'full_jars_200'),
  (28, '250 full jars',    'stickers/milestones/full-jars-250-v2.png',  '{milestone,full}'::text[],      'full_jars_250'),
  (29, '365 full jars',    'stickers/milestones/full-jars-365-v2.png',  '{milestone,full,year}'::text[], 'full_jars_365'),
  (30, '500 full jars',    'stickers/milestones/full-jars-500-v2.png',  '{milestone,full}'::text[],      'full_jars_500')
) as v(sort, label, asset_path, tags, milestone_key)
join public.sticker_packs p on p.slug = 'milestones';

-- Existing accounts get what they have already reached (no notifications for the past).
select public.grant_milestones(id) from public.profiles;
