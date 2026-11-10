-- Local development seed. Applied by `supabase db reset` after all migrations.
-- Dates are relative to "today" in Asia/Manila so the data always looks current.
--
-- People (all sign in with an email link; local mail is at http://127.0.0.1:54324):
--   dale  dale@pickld.test  Asia/Manila   main demo account
--   mika  mika@pickld.test  Asia/Manila
--   aya   aya@pickld.test   Asia/Tokyo
--   jun   jun@pickld.test   Asia/Manila
--   lola  lola@pickld.test  Europe/London  (blocked by dale)
--   mod   mod@pickld.test   Asia/Manila   moderator (app_metadata.role = moderator)
--
-- Graph: dale reads mika and aya; mika, aya and jun read dale; jun reads mika; dale blocked lola.
-- Jars: dale has a full published jar yesterday, a partial unpublished jar today (with a private
-- and a checking moment) and an older jar with a backfilled ("Added later") moment. mika has a
-- full Everyone jar today, aya a partial Readers jar with a removed moment, jun an unpublished
-- partial jar, lola an Everyone jar.

-- ---------------------------------------------------------------- auth users
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '',
       now(), u.app_meta, '{}'::jsonb, now() - interval '60 days', now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'dale@pickld.test', '{"provider":"email","providers":["email"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'mika@pickld.test', '{"provider":"email","providers":["email"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'aya@pickld.test',  '{"provider":"email","providers":["email"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'jun@pickld.test',  '{"provider":"email","providers":["email"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000005'::uuid, 'lola@pickld.test', '{"provider":"email","providers":["email"]}'::jsonb),
  ('a0000000-0000-4000-8000-000000000009'::uuid, 'mod@pickld.test',  '{"provider":"email","providers":["email"],"role":"moderator"}'::jsonb)
) as u(id, email, app_meta);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u where u.email like '%@pickld.test';

-- ---------------------------------------------------------------- profiles
insert into public.profiles (id, username, display_name, bio, avatar_path, birthday, lid_color, home_tz, default_visibility, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'dale', 'Dale Santos', 'coffee, commutes and cats', 'seed/avatars/av_dale.jpg', '1996-04-12', '#7fad33', 'Asia/Manila', 'readers', now() - interval '60 days'),
  ('a0000000-0000-4000-8000-000000000002', 'mika', 'Mika Reyes',  'film photos only (not really)', 'seed/avatars/av_mika.jpg', '1998-09-03', '#e8a33d', 'Asia/Manila', 'everyone', now() - interval '45 days'),
  ('a0000000-0000-4000-8000-000000000003', 'aya',  'Aya Tanaka',  'Tokyo ↔ Manila', 'seed/avatars/av_aya.jpg', '1995-01-27', '#5b8def', 'Asia/Tokyo', 'readers', now() - interval '30 days'),
  ('a0000000-0000-4000-8000-000000000004', 'jun',  'Jun Cruz',    null, 'seed/avatars/av_jun.jpg', '2001-11-19', '#7fad33', 'Asia/Manila', 'readers', now() - interval '20 days'),
  ('a0000000-0000-4000-8000-000000000005', 'lola', 'Lola Bautista', 'London days', 'seed/avatars/av_lola.jpg', '1993-06-30', '#d65a7a', 'Europe/London', 'everyone', now() - interval '10 days'),
  ('a0000000-0000-4000-8000-000000000009', 'pickld.mod', 'Pickld Moderator', null, null, '1990-01-01', '#7fad33', 'Asia/Manila', 'only_me', now() - interval '90 days');

-- ---------------------------------------------------------------- graph
insert into public.follows (reader_id, author_id) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003'),
  ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001');
-- Blocking drops lola -> dale through blocks_sync.
insert into public.blocks (blocker_id, blocked_id) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005');

-- ---------------------------------------------------------------- jars
-- local_date is relative to today in each jar's zone.
insert into public.jars (id, user_id, local_date, tz, visibility, published_at) values
  -- dale: older Everyone jar (has a backfilled moment), full Readers jar yesterday, unpublished today
  ('b0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Manila')::date - 3, 'Asia/Manila', 'everyone', now() - interval '3 days'),
  ('b0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Manila')::date - 1, 'Asia/Manila', 'readers',  now() - interval '1 day'),
  ('b0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', (now() at time zone 'Asia/Manila')::date,     'Asia/Manila', 'readers',  null),
  -- mika: full Everyone jar today
  ('b0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000002', (now() at time zone 'Asia/Manila')::date,     'Asia/Manila', 'everyone', now() - interval '1 hour'),
  -- aya: partial Readers jar yesterday (Tokyo)
  ('b0000000-0000-4000-8000-000000000301', 'a0000000-0000-4000-8000-000000000003', (now() at time zone 'Asia/Tokyo')::date - 1,  'Asia/Tokyo',  'readers',  now() - interval '20 hours'),
  -- jun: unpublished partial jar today
  ('b0000000-0000-4000-8000-000000000401', 'a0000000-0000-4000-8000-000000000004', (now() at time zone 'Asia/Manila')::date,     'Asia/Manila', 'readers',  null),
  -- lola: Everyone jar yesterday (London)
  ('b0000000-0000-4000-8000-000000000501', 'a0000000-0000-4000-8000-000000000005', (now() at time zone 'Europe/London')::date - 1, 'Europe/London', 'everyone', now() - interval '12 hours');

-- ---------------------------------------------------------------- moments
-- The insert trigger stamps added_at with server time and forces status to uploading/checking.
-- Seed rows need historical added_at values and live/removed statuses, so the before-insert
-- triggers are switched off for this block only (the counter triggers still run).
alter table public.moments disable trigger moments_bi;

with j as (
  select id, user_id, tz, local_date, ((local_date)::timestamp at time zone tz) as day_start from public.jars
)
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, caption, captured_at, added_at, is_backfilled, is_private, status)
select j.id, j.user_id, m.slot::slot,
       'seed/photos/' || m.img || '.jpg', 'seed/thumbs/' || m.img || '.jpg',
       m.caption, least(j.day_start + m.at, now() - interval '2 minutes'), least(j.day_start + m.added, now() - interval '1 minute'), m.backfilled, m.private, m.status::moment_status
from j join (values
  -- dale, 3 days ago: 4 moments, the evening one added two days later ("Added later")
  ('b0000000-0000-4000-8000-000000000101'::uuid, 'whereami',   'whereami',   'new café on Maginhawa', interval '8 hours',  interval '8 hours 5 minutes',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000101'::uuid, 'morning',    'morning',    null,                    interval '7 hours',  interval '7 hours 2 minutes',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000101'::uuid, 'ootd',       'ootd',       'thrifted jacket',       interval '9 hours',  interval '9 hours 1 minute',   false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000101'::uuid, 'evening',    'evening',    'forgot to post this one', interval '20 hours', interval '2 days 10 hours', true, false, 'live'),
  -- dale, yesterday: full jar
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'whereami',   'whereami',   'office day',            interval '9 hours',  interval '9 hours 1 minute',   false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'mebusywith', 'busy',       'deadline mode',         interval '10 hours', interval '10 hours 3 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'whoamiwith', 'whoamiwith', 'lunch crew',            interval '12 hours', interval '12 hours 5 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'ootd',       'ootd',       null,                    interval '8 hours',  interval '8 hours 2 minutes',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'selfie',     'selfie',     'hair day',              interval '13 hours', interval '13 hours 1 minute', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'morning',    'morning',    'sunrise run',           interval '6 hours',  interval '6 hours 10 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'afternoon',  'afternoon',  'merienda',              interval '15 hours', interval '15 hours 2 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000102'::uuid, 'evening',    'food',       'sinigang night',        interval '19 hours', interval '19 hours 4 minutes', false, false, 'live'),
  -- dale, today (unpublished): a private moment and one still being checked
  ('b0000000-0000-4000-8000-000000000103'::uuid, 'morning',    'morning',    'slow start',            interval '6 hours',  interval '6 hours 3 minutes',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000103'::uuid, 'whereami',   'whereami',   null,                    interval '7 hours',  interval '7 hours 1 minute',   false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000103'::uuid, 'selfie',     'selfie',     'just for me',           interval '7 hours 30 minutes', interval '7 hours 31 minutes', false, true, 'live'),
  ('b0000000-0000-4000-8000-000000000103'::uuid, 'mebusywith', 'busy',       'inbox zero attempt',    interval '8 hours',  interval '8 hours 2 minutes',  false, false, 'checking'),
  -- mika, today: full Everyone jar
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'whereami',   'whereami',   'Intramuros walk',       interval '9 hours',  interval '9 hours 2 minutes',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'mebusywith', 'busy',       'film scanning',         interval '10 hours', interval '10 hours 1 minute', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'whoamiwith', 'whoamiwith', 'with the barkada',      interval '11 hours', interval '11 hours 4 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'ootd',       'ootd',       'all linen',             interval '8 hours',  interval '8 hours 1 minute',   false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'selfie',     'selfie',     null,                    interval '8 hours 30 minutes', interval '8 hours 31 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'morning',    'morning',    'pandesal',              interval '6 hours',  interval '6 hours 5 minutes',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'afternoon',  'afternoon',  'halo-halo break',       interval '14 hours', interval '14 hours 2 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000201'::uuid, 'evening',    'evening',    'golden hour',           interval '17 hours 30 minutes', interval '17 hours 33 minutes', false, false, 'live'),
  -- aya, yesterday: partial Readers jar with one removed moment
  ('b0000000-0000-4000-8000-000000000301'::uuid, 'whereami',   'whereami',   'Shibuya',               interval '10 hours', interval '10 hours 1 minute', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000301'::uuid, 'afternoon',  'afternoon',  'kissaten',              interval '15 hours', interval '15 hours 3 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000301'::uuid, 'evening',    'evening',    null,                    interval '21 hours', interval '21 hours 2 minutes', false, false, 'removed'),
  -- jun, today (unpublished)
  ('b0000000-0000-4000-8000-000000000401'::uuid, 'morning',    'morning',    'first day using pickld', interval '7 hours', interval '7 hours 1 minute',  false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000401'::uuid, 'ootd',       'ootd',       null,                    interval '8 hours',  interval '8 hours 1 minute',   false, false, 'checking'),
  -- lola, yesterday (London)
  ('b0000000-0000-4000-8000-000000000501'::uuid, 'whereami',   'whereami',   'Borough Market',        interval '11 hours', interval '11 hours 2 minutes', false, false, 'live'),
  ('b0000000-0000-4000-8000-000000000501'::uuid, 'selfie',     'selfie',     null,                    interval '12 hours', interval '12 hours 1 minute', false, false, 'live')
) as m(jar_id, slot, img, caption, at, added, backfilled, private, status) on m.jar_id = j.id;

alter table public.moments enable trigger moments_bi;

-- ---------------------------------------------------------------- social
insert into public.reactions (user_id, target, target_id) values
  ('a0000000-0000-4000-8000-000000000002', 'jar', 'b0000000-0000-4000-8000-000000000102'),
  ('a0000000-0000-4000-8000-000000000003', 'jar', 'b0000000-0000-4000-8000-000000000102'),
  ('a0000000-0000-4000-8000-000000000001', 'jar', 'b0000000-0000-4000-8000-000000000201'),
  ('a0000000-0000-4000-8000-000000000004', 'jar', 'b0000000-0000-4000-8000-000000000201');

-- Seeded comments are shown as already checked (is_hidden = false).
insert into public.comments (id, jar_id, user_id, parent_id, body, is_hidden, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000002', null, 'that sinigang 😭', false, now() - interval '20 hours'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'come over next time!', false, now() - interval '19 hours'),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000001', null, 'Intramuros looks so good today', false, now() - interval '30 minutes');
