-- 0012 — Sticker catalog and the free packs (FR-STK-01, FR-STK-02, FR-STK-04, FR-STK-05; C-6, D-8; M2-14).
-- Additive only: no column is dropped or renamed.
--
-- The catalog is reference data that every environment needs, so its rows live in this migration (not in
-- supabase/seed.sql, which only runs locally): staging and production get the same 50 stickers when the
-- migration is applied, and later packs ship the same way, as new rows (FR-STK-02: the app reads the
-- catalog from the server, so new rows appear without an app update). Sticker ids are derived from the
-- asset path (md5 → uuid), so a sticker has the same id everywhere and moments' `edits` stay portable.
--
-- Launch packs (0001 created the pack rows), 50 stickers:
--   Everyday    free    15 word stickers, some with a slot hint
--   The Eight   free    24: three per slot, each with that slot as its hint (the "For #slot" row, FR-STK-03)
--   Stamps      free     6: auto time, date, weekday and jar number (`stamp`), plus two plain stamps
--   Milestones  earned   5: one per D-8 milestone (`milestone_key`)
--
-- Who may use a pack (FR-STK-01): a free pack is usable by every signed-in user without an owned_packs row.
-- owned_packs stays the record of entitlements that were acquired (earned now, purchases in M6), so new
-- accounts need no sign-up trigger, nothing is backfilled for existing accounts, and a free pack added
-- later is usable by everyone the moment its row exists. pack_usable() and sticker_usable() answer the
-- question in one place; a Milestones sticker also needs its own milestone (FR-STK-05), not just the pack
-- (0010 grants the pack with the first milestone). Viewing is never gated (FR-STK-04): anyone who can see a
-- moment sees all its stickers, and the web page resolves them through public_sticker_catalog() (C-6).
--
-- Art: one PNG per sticker in the photo bucket under `stickers/<pack slug>/<name>.png` (asset_path, see
-- supabase/functions/_shared/object_keys.ts). The photo Worker serves sticker keys without a token and
-- with an immutable cache, so changed art gets a new file name, never a new object under an old key.

-- ---------------------------------------------------------------- columns
create type sticker_stamp as enum ('time', 'date', 'weekday', 'jar_number');

alter table public.stickers
  add column stamp sticker_stamp,      -- an auto stamp: the editor draws this live value in the stamp's style
  add column milestone_key text;       -- earned sticker: usable once the owner has this milestone (0010 keys)

alter table public.stickers
  add constraint stickers_asset_path_key unique (asset_path),
  add constraint stickers_asset_path_format check (asset_path ~ '^stickers/[a-z0-9-]{1,40}/[a-z0-9-]{1,60}\.png$'),
  add constraint stickers_milestone_key_check
    check (milestone_key in ('first_full_jar', 'full_jars_7', 'jars_30', 'jars_100', 'one_year'));

create index stickers_pack_idx on public.stickers (pack_id, sort);

-- ---------------------------------------------------------------- catalog writes: server only
-- 0001 has select-only policies; take the unused write grants away from clients too (admins write the
-- catalog with the service role or migrations).
revoke insert, update, delete, truncate on public.sticker_packs from authenticated, anon;
revoke insert, update, delete, truncate on public.stickers from authenticated, anon;

-- ---------------------------------------------------------------- launch stickers
insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot,
       v.stamp::sticker_stamp, v.milestone_key, v.sort
from (values
  -- Everyday
  ('everyday', 1,  'Kape muna',        'stickers/everyday/kape-muna.png',        '{coffee,kape,morning,popular}'::text[], 'morning',    null, null),
  ('everyday', 2,  'Real ako',         'stickers/everyday/real-ako.png',         '{real,honest,popular,words}',           null,         null, null),
  ('everyday', 3,  'Busy bee',         'stickers/everyday/busy-bee.png',         '{busy,work,school,popular}',            'mebusywith', null, null),
  ('everyday', 4,  'Sana all',         'stickers/everyday/sana-all.png',         '{sana,envy,popular,filipino}',          null,         null, null),
  ('everyday', 5,  'Kain tayo',        'stickers/everyday/kain-tayo.png',        '{food,eat,kain,barkada,family}',        'whoamiwith', null, null),
  ('everyday', 6,  'Ulam check',       'stickers/everyday/ulam-check.png',       '{food,ulam,dinner,filipino}',           'evening',    null, null),
  ('everyday', 7,  'Lunch break',      'stickers/everyday/lunch-break.png',      '{food,lunch,work,break}',               'afternoon',  null, null),
  ('everyday', 8,  'Merienda time',    'stickers/everyday/merienda-time.png',    '{food,snack,merienda,filipino}',        'afternoon',  null, null),
  ('everyday', 9,  'Tulog muna',       'stickers/everyday/tulog-muna.png',       '{sleep,tulog,night,rest}',              'evening',    null, null),
  ('everyday', 10, 'Rest day',         'stickers/everyday/rest-day.png',         '{rest,weekend,chill}',                  null,         null, null),
  ('everyday', 11, 'Laban!',           'stickers/everyday/laban.png',            '{fight,laban,motivation,filipino}',     null,         null, null),
  ('everyday', 12, 'Petsa de peligro', 'stickers/everyday/petsa-de-peligro.png', '{money,broke,payday,filipino}',         null,         null, null),
  ('everyday', 13, 'Same old',         'stickers/everyday/same-old.png',         '{same,routine,words}',                  null,         null, null),
  ('everyday', 14, 'Okay lang',        'stickers/everyday/okay-lang.png',        '{okay,mood,fine,filipino}',             null,         null, null),
  ('everyday', 15, 'Salamat',          'stickers/everyday/salamat.png',          '{thanks,salamat,grateful,filipino}',    null,         null, null),
  -- The Eight: three per slot
  ('the-eight', 1,  'Traffic again',      'stickers/the-eight/traffic-again.png',      '{traffic,commute,road}',              'whereami',   null, null),
  ('the-eight', 2,  'Nasa bahay lang',    'stickers/the-eight/nasa-bahay-lang.png',    '{home,bahay,filipino}',               'whereami',   null, null),
  ('the-eight', 3,  'New place!',         'stickers/the-eight/new-place.png',          '{travel,explore,place}',              'whereami',   null, null),
  ('the-eight', 4,  'Deadline mode',      'stickers/the-eight/deadline-mode.png',      '{work,deadline,busy}',                'mebusywith', null, null),
  ('the-eight', 5,  'Side hustle',        'stickers/the-eight/side-hustle.png',        '{side_hustle,work,hustle}',           'mebusywith', null, null),
  ('the-eight', 6,  'Aral muna',          'stickers/the-eight/aral-muna.png',          '{school,study,aral,filipino}',        'mebusywith', null, null),
  ('the-eight', 7,  'Barkada',            'stickers/the-eight/barkada.png',            '{barkada,friends,squad}',             'whoamiwith', null, null),
  ('the-eight', 8,  'Family time',        'stickers/the-eight/family-time.png',        '{family,pamilya,home}',               'whoamiwith', null, null),
  ('the-eight', 9,  'Just me',            'stickers/the-eight/just-me.png',            '{me,solo,alone}',                     'whoamiwith', null, null),
  ('the-eight', 10, 'Pambahay',           'stickers/the-eight/pambahay.png',           '{pambahay,home,outfit,filipino}',     'ootd',       null, null),
  ('the-eight', 11, 'Office fit',         'stickers/the-eight/office-fit.png',         '{office,work,outfit}',                'ootd',       null, null),
  ('the-eight', 12, 'Gym fit',            'stickers/the-eight/gym-fit.png',            '{gym,workout,outfit}',                'ootd',       null, null),
  ('the-eight', 13, 'Hi, it''s me',       'stickers/the-eight/hi-its-me.png',          '{selfie,me,hello}',                   'selfie',     null, null),
  ('the-eight', 14, 'Walang filter',      'stickers/the-eight/walang-filter.png',      '{selfie,real,nofilter,filipino}',     'selfie',     null, null),
  ('the-eight', 15, 'Haggard pero happy', 'stickers/the-eight/haggard-pero-happy.png', '{selfie,tired,happy,filipino}',       'selfie',     null, null),
  ('the-eight', 16, 'Good morning',       'stickers/the-eight/good-morning.png',       '{morning,hello,sun}',                 'morning',    null, null),
  ('the-eight', 17, 'Bangon na',          'stickers/the-eight/bangon-na.png',          '{morning,wake,bangon,filipino}',      'morning',    null, null),
  ('the-eight', 18, 'Early bird',         'stickers/the-eight/early-bird.png',         '{morning,early,early_bird}',          'morning',    null, null),
  ('the-eight', 19, 'Afternoon slump',    'stickers/the-eight/afternoon-slump.png',    '{afternoon,tired,sleepy}',            'afternoon',  null, null),
  ('the-eight', 20, 'Siesta?',            'stickers/the-eight/siesta.png',             '{afternoon,nap,siesta}',              'afternoon',  null, null),
  ('the-eight', 21, 'Halfway there',      'stickers/the-eight/halfway-there.png',      '{afternoon,halfway,work}',            'afternoon',  null, null),
  ('the-eight', 22, 'Uwian na',           'stickers/the-eight/uwian-na.png',           '{evening,home,commute,filipino}',     'evening',    null, null),
  ('the-eight', 23, 'Night owl',          'stickers/the-eight/night-owl.png',          '{evening,night,night_owl}',           'evening',    null, null),
  ('the-eight', 24, 'Pahinga',            'stickers/the-eight/pahinga.png',            '{evening,rest,pahinga,filipino}',     'evening',    null, null),
  -- Stamps: four auto stamps (the editor fills in the value) and two plain ones
  ('stamps', 1, 'Time',       'stickers/stamps/time.png',       '{time,clock,auto}',        null, 'time',       null),
  ('stamps', 2, 'Date',       'stickers/stamps/date.png',       '{date,today,auto}',        null, 'date',       null),
  ('stamps', 3, 'Day',        'stickers/stamps/day.png',        '{day,weekday,auto}',       null, 'weekday',    null),
  ('stamps', 4, 'Jar number', 'stickers/stamps/jar-number.png', '{jar,number,count,auto}',  null, 'jar_number', null),
  ('stamps', 5, 'Real day',   'stickers/stamps/real-day.png',   '{real,honest,stamp}',      null, null,         null),
  ('stamps', 6, '100% totoo', 'stickers/stamps/totoo.png',      '{real,totoo,filipino}',    null, null,         null),
  -- Milestones: one per D-8 milestone
  ('milestones', 1, 'First full jar', 'stickers/milestones/first-full-jar.png', '{milestone,full,jar}',  null, null, 'first_full_jar'),
  ('milestones', 2, '7 full jars',    'stickers/milestones/full-jars-7.png',    '{milestone,full,week}', null, null, 'full_jars_7'),
  ('milestones', 3, '30 jars',        'stickers/milestones/jars-30.png',        '{milestone,month}',     null, null, 'jars_30'),
  ('milestones', 4, '100 jars',       'stickers/milestones/jars-100.png',       '{milestone,hundred}',   null, null, 'jars_100'),
  ('milestones', 5, '1 year of jars', 'stickers/milestones/one-year.png',       '{milestone,year}',      null, null, 'one_year')
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, stamp, milestone_key)
join public.sticker_packs p on p.slug = v.pack_slug;

-- ---------------------------------------------------------------- who may use a sticker
-- Security invoker: owned_packs and milestones are read through their owner-only policies, so the answer is
-- always about the signed-in user. PostgREST exposes both as computed fields:
--   from('sticker_packs').select('*, pack_usable')   from('stickers').select('*, sticker_usable')
create or replace function public.pack_usable(p public.sticker_packs) returns boolean
language sql stable set search_path = public as $$
  select p.tier = 'free'
      or exists (select 1 from owned_packs o where o.user_id = auth.uid() and o.pack_id = p.id)
$$;

create or replace function public.sticker_usable(s public.stickers) returns boolean
language sql stable set search_path = public as $$
  select coalesce((select pack_usable(p) from sticker_packs p where p.id = s.pack_id), false)
     and (s.milestone_key is null
          or exists (select 1 from milestones m where m.user_id = auth.uid() and m.key = s.milestone_key))
$$;

revoke execute on function public.pack_usable(public.sticker_packs) from public, anon;
revoke execute on function public.sticker_usable(public.stickers) from public, anon;
grant execute on function public.pack_usable(public.sticker_packs) to authenticated, service_role;
grant execute on function public.sticker_usable(public.stickers) to authenticated, service_role;

-- ---------------------------------------------------------------- anon catalog (C-6)
-- The shared-link web page renders stickers on Everyone jars without a session (FR-STK-04). Anon has no
-- table privileges (0006), so this narrow function returns the art catalog only: no ownership, prices,
-- store ids or artists. Packs that aren't out yet (available_from in the future) are left out.
create or replace function public.public_sticker_catalog()
returns table (
  pack_slug text,
  pack_name text,
  pack_tier pack_tier,
  pack_sort int,
  sticker_id uuid,
  label text,
  asset_path text,
  tags text[],
  slot_hint slot,
  stamp sticker_stamp,
  sort int
)
language sql stable security definer set search_path = public as $$
  select p.slug, p.name, p.tier, p.sort, s.id, s.label, s.asset_path, s.tags, s.slot_hint, s.stamp, s.sort
  from sticker_packs p
  join stickers s on s.pack_id = p.id
  where p.available_from is null or p.available_from <= now()
  order by p.sort, s.sort
$$;
revoke execute on function public.public_sticker_catalog() from public;
grant execute on function public.public_sticker_catalog() to anon, authenticated, service_role;
