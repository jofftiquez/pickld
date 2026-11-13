-- 0060 — Ten or more stickers in every pack, and seven new packs (T-507, #277; FR-STK-02, FR-STK-05, FR-STK-06).
-- Additive only: new rows, five new milestones, a widened check, and grant_milestones() redefined. Nothing is
-- dropped, renamed or deleted, and no existing price, tier or free pack changes.
--
-- Product owner, Nov 13: every pack has at least 10 stickers; new packs for Olivia (his white cat), a fish with
-- moods, more Pinoy Life, and word-art packs for different groups.
--
--   Stamps        6 → 10    four plain stamps (Photo dump, No filter, On this day, Day off)
--   Milestones    5 → 10    five new milestones (below), one sticker each
--   Pinoy Life   17 → 25    eight more pictures
--   Olivia        16 pictures          premium   a sassy white mixed-Persian cat: pink nose, yellow eyes
--   Fish Moods    16 pictures          premium   one chubby goldfish, sixteen moods
--   Corporate, Gen Z, Trentahin, Pride, Cyclists   12 word stickers each, premium
--
-- Store products for the new packs (me.pickld.pack.<slug, - as _>) still have to be created in App Store Connect
-- and RevenueCat; until then the shop shows the packs without a price or a Get button (prices come from the
-- store, never from here, 0029).
--
-- New milestones (counts as in 0010, D-9): jars_7 7 jars, full_jars_30 30 full jars, jars_50 50 jars,
-- full_jars_100 100 full jars, jars_200 200 jars. Accounts that already reached one get it now (as 0010 did).
--
-- Art: pictures generated in the Pickld sticker style and bundled under assets/stickers/<pack>/; word stickers,
-- stamps and milestones rendered by scripts/render-stickers.mjs. Upload with `cd workers/photos && deno task stickers`.

-- ---------------------------------------------------------------- new packs
insert into public.sticker_packs (slug, name, tier, store_product_id, sort, description, available_from, available_to) values
  ('olivia', 'Olivia', 'premium', 'me.pickld.pack.olivia', 15, 'Meet Olivia: white, fluffy and not impressed. For cat people and anyone with a little attitude.', null, null),
  ('fish-moods', 'Fish Moods', 'premium', 'me.pickld.pack.fish_moods', 16, 'One goldfish, every feeling. Happy, hangry, in love or very, very sleepy.', null, null),
  ('corporate', 'Corporate', 'premium', 'me.pickld.pack.corporate', 17, 'Noted with thanks. For quick syncs, action items and the meeting after the meeting.', null, null),
  ('gen-z', 'Gen Z', 'premium', 'me.pickld.pack.gen_z', 18, 'It''s giving. For main character days, no cap.', null, null),
  ('trentahin', 'Trentahin', 'premium', 'me.pickld.pack.trentahin', 19, 'Tulog by 9, bills paid, likod check. For the thirties and loving it.', null, null),
  ('pride', 'Pride', 'premium', 'me.pickld.pack.pride', 20, 'Love is love. For Pride, chosen family and every day you get to be you.', null, null),
  ('cyclists', 'Cyclists', 'premium', 'me.pickld.pack.cyclists', 21, 'Ride on. For coffee rides, ahon and the long way home.', null, null);

-- ---------------------------------------------------------------- five more milestones
alter table public.stickers drop constraint stickers_milestone_key_check;
alter table public.stickers add constraint stickers_milestone_key_check
  check (milestone_key in ('first_full_jar', 'full_jars_7', 'jars_30', 'jars_100', 'one_year',
                           'jars_7', 'full_jars_30', 'jars_50', 'full_jars_100', 'jars_200'));

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
               ('jars_200', jars_n >= 200)) as v(key, reached)
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

-- ---------------------------------------------------------------- new stickers
insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot,
       null::sticker_stamp, v.milestone_key, v.sort
from (values
  -- Stamps: plain stamps, no live value
  ('stamps', 7 , 'Photo dump',      'stickers/stamps/photo-dump.png',          '{photo_dump,stamp}'::text[], null, null),
  ('stamps', 8 , 'No filter',       'stickers/stamps/no-filter.png',           '{real,honest,stamp}'::text[], 'selfie', null),
  ('stamps', 9 , 'On this day',     'stickers/stamps/on-this-day.png',         '{memories,date,stamp}'::text[], null, null),
  ('stamps', 10, 'Day off',         'stickers/stamps/day-off.png',             '{rest,weekend,stamp}'::text[], null, null),
  -- Milestones
  ('milestones', 6 , '7 jars',          'stickers/milestones/jars-7.png',          '{milestone,week}'::text[], null, 'jars_7'),
  ('milestones', 7 , '30 full jars',    'stickers/milestones/full-jars-30.png',    '{milestone,full,month}'::text[], null, 'full_jars_30'),
  ('milestones', 8 , '50 jars',         'stickers/milestones/jars-50.png',         '{milestone,fifty}'::text[], null, 'jars_50'),
  ('milestones', 9 , '100 full jars',   'stickers/milestones/full-jars-100.png',   '{milestone,full,hundred}'::text[], null, 'full_jars_100'),
  ('milestones', 10, '200 jars',        'stickers/milestones/jars-200.png',        '{milestone,two_hundred}'::text[], null, 'jars_200'),
  -- Pinoy Life: more pictures, after the first eight and before the words
  ('pinoy-life', 9 , 'Sari-sari store', 'stickers/pinoy-life/sari-sari.png',       '{filipino,store,snacks}'::text[], 'whereami', null),
  ('pinoy-life', 10, 'Pandesal',        'stickers/pinoy-life/pandesal.png',        '{filipino,food,breakfast,bread}'::text[], 'morning', null),
  ('pinoy-life', 11, 'Ube taho',        'stickers/pinoy-life/ube-taho.png',        '{filipino,food,merienda,ube}'::text[], 'morning', null),
  ('pinoy-life', 12, 'Videoke',         'stickers/pinoy-life/videoke.png',         '{filipino,videoke,music,barkada}'::text[], 'evening', null),
  ('pinoy-life', 13, 'Sampaguita',      'stickers/pinoy-life/sampaguita.png',      '{filipino,flower,church}'::text[], null, null),
  ('pinoy-life', 14, 'Bangka',          'stickers/pinoy-life/bangka.png',          '{filipino,beach,travel,boat}'::text[], 'whereami', null),
  ('pinoy-life', 15, 'Lechon',          'stickers/pinoy-life/lechon.png',          '{filipino,food,party,family}'::text[], 'evening', null),
  ('pinoy-life', 16, 'Banig',           'stickers/pinoy-life/banig.png',           '{filipino,home,rest}'::text[], 'evening', null),
  -- Olivia
  ('olivia', 1 , 'Unimpressed',     'stickers/olivia/unimpressed.png',         '{cat,olivia,pets,funny}'::text[], null, null),
  ('olivia', 2 , 'Dramatic meow',   'stickers/olivia/meow-drama.png',          '{cat,olivia,pets,funny}'::text[], null, null),
  ('olivia', 3 , 'Queen',           'stickers/olivia/queen.png',               '{cat,olivia,pets,selfie}'::text[], 'selfie', null),
  ('olivia', 4 , 'Loaf nap',        'stickers/olivia/loaf-nap.png',            '{cat,olivia,pets,rest}'::text[], 'afternoon', null),
  ('olivia', 5 , 'Heart eyes',      'stickers/olivia/heart-eyes.png',          '{cat,olivia,pets,love}'::text[], 'whoamiwith', null),
  ('olivia', 6 , 'Diva',            'stickers/olivia/diva.png',                '{cat,olivia,pets,ootd}'::text[], 'ootd', null),
  ('olivia', 7 , 'Grooming',        'stickers/olivia/grooming.png',            '{cat,olivia,pets,morning}'::text[], 'morning', null),
  ('olivia', 8 , 'Grumpy floof',    'stickers/olivia/grumpy-floof.png',        '{cat,olivia,pets,funny}'::text[], null, null),
  ('olivia', 9 , 'Box boss',        'stickers/olivia/box-boss.png',            '{cat,olivia,pets,home}'::text[], 'whereami', null),
  ('olivia', 10, 'Cup push',        'stickers/olivia/cup-push.png',            '{cat,olivia,pets,coffee,funny}'::text[], 'mebusywith', null),
  ('olivia', 11, 'Zoomies',         'stickers/olivia/zoomies.png',             '{cat,olivia,pets,funny}'::text[], null, null),
  ('olivia', 12, 'Treat please',    'stickers/olivia/treat-please.png',        '{cat,olivia,pets,food}'::text[], null, null),
  ('olivia', 13, 'Blanket burrito', 'stickers/olivia/blanket-burrito.png',     '{cat,olivia,pets,rest,cold}'::text[], 'evening', null),
  ('olivia', 14, 'Big yawn',        'stickers/olivia/big-yawn.png',            '{cat,olivia,pets,morning,sleepy}'::text[], 'morning', null),
  ('olivia', 15, 'Lounge queen',    'stickers/olivia/lounge-queen.png',        '{cat,olivia,pets,rest}'::text[], 'afternoon', null),
  ('olivia', 16, 'Cold shoulder',   'stickers/olivia/cold-shoulder.png',       '{cat,olivia,pets,funny}'::text[], null, null),
  -- Fish Moods
  ('fish-moods', 1 , 'Happy',       'stickers/fish-moods/happy.png',           '{fish,mood,happy}'::text[], null, null),
  ('fish-moods', 2 , 'Sad',         'stickers/fish-moods/sad.png',             '{fish,mood,sad}'::text[], null, null),
  ('fish-moods', 3 , 'Angry',       'stickers/fish-moods/angry.png',           '{fish,mood,angry}'::text[], null, null),
  ('fish-moods', 4 , 'Sleepy',      'stickers/fish-moods/sleepy.png',          '{fish,mood,sleepy,rest}'::text[], 'evening', null),
  ('fish-moods', 5 , 'In love',     'stickers/fish-moods/in-love.png',         '{fish,mood,love}'::text[], 'whoamiwith', null),
  ('fish-moods', 6 , 'Shocked',     'stickers/fish-moods/shocked.png',         '{fish,mood,funny}'::text[], null, null),
  ('fish-moods', 7 , 'Chill',       'stickers/fish-moods/chill.png',           '{fish,mood,beach,rest}'::text[], 'whereami', null),
  ('fish-moods', 8 , 'Hungry',      'stickers/fish-moods/hungry.png',          '{fish,mood,food}'::text[], null, null),
  ('fish-moods', 9 , 'Confused',    'stickers/fish-moods/confused.png',        '{fish,mood,funny}'::text[], null, null),
  ('fish-moods', 10, 'Proud',       'stickers/fish-moods/proud.png',           '{fish,mood,win}'::text[], null, null),
  ('fish-moods', 11, 'Shy',         'stickers/fish-moods/shy.png',             '{fish,mood,love}'::text[], 'selfie', null),
  ('fish-moods', 12, 'LOL',         'stickers/fish-moods/lol.png',             '{fish,mood,funny}'::text[], null, null),
  ('fish-moods', 13, 'Nervous',     'stickers/fish-moods/nervous.png',         '{fish,mood,work,school}'::text[], 'mebusywith', null),
  ('fish-moods', 14, 'Party',       'stickers/fish-moods/party.png',           '{fish,mood,party,barkada}'::text[], 'evening', null),
  ('fish-moods', 15, 'Sick day',    'stickers/fish-moods/sick.png',            '{fish,mood,rest,sick}'::text[], null, null),
  ('fish-moods', 16, 'Kiss',        'stickers/fish-moods/kiss.png',            '{fish,mood,love}'::text[], 'whoamiwith', null),
  -- Corporate
  ('corporate', 1 , 'Let''s circle back',     'stickers/corporate/circle-back.png',       '{work,meeting,words,funny}'::text[], 'mebusywith', null),
  ('corporate', 2 , 'Noted with thanks',      'stickers/corporate/noted-with-thanks.png', '{work,words}'::text[], null, null),
  ('corporate', 3 , 'Quick sync?',            'stickers/corporate/quick-sync.png',        '{work,meeting,words}'::text[], 'mebusywith', null),
  ('corporate', 4 , 'Let''s take this offline','stickers/corporate/take-this-offline.png','{work,meeting,words,funny}'::text[], null, null),
  ('corporate', 5 , 'Action items',           'stickers/corporate/action-items.png',      '{work,meeting,words}'::text[], 'mebusywith', null),
  ('corporate', 6 , 'Ping me',                'stickers/corporate/ping-me.png',           '{work,words}'::text[], null, null),
  ('corporate', 7 , 'Blocked',                'stickers/corporate/blocked.png',           '{work,words,funny}'::text[], null, null),
  ('corporate', 8 , 'EOD na',                 'stickers/corporate/eod-na.png',            '{work,words,filipino}'::text[], 'evening', null),
  ('corporate', 9 , 'KPI hit',                'stickers/corporate/kpi-hit.png',           '{work,win,words}'::text[], null, null),
  ('corporate', 10, 'Q4 grind',               'stickers/corporate/q4-grind.png',          '{work,words}'::text[], 'mebusywith', null),
  ('corporate', 11, 'Pa-sign po',             'stickers/corporate/pa-sign-po.png',        '{work,words,filipino}'::text[], null, null),
  ('corporate', 12, 'Leave approved',         'stickers/corporate/leave-approved.png',    '{work,rest,travel,words}'::text[], null, null),
  -- Gen Z
  ('gen-z', 1 , 'It''s giving',          'stickers/gen-z/its-giving.png',             '{genz,words,ootd}'::text[], 'ootd', null),
  ('gen-z', 2 , 'No cap',                'stickers/gen-z/no-cap.png',                 '{genz,words,real}'::text[], null, null),
  ('gen-z', 3 , 'Slay',                  'stickers/gen-z/slay.png',                   '{genz,words,ootd,selfie}'::text[], 'ootd', null),
  ('gen-z', 4 , 'Main character',        'stickers/gen-z/main-character.png',         '{genz,words,selfie}'::text[], 'selfie', null),
  ('gen-z', 5 , 'Lowkey',                'stickers/gen-z/lowkey.png',                 '{genz,words}'::text[], null, null),
  ('gen-z', 6 , 'Ate that',              'stickers/gen-z/ate-that.png',               '{genz,words,food,win}'::text[], null, null),
  ('gen-z', 7 , 'Bet',                   'stickers/gen-z/bet.png',                    '{genz,words,plans}'::text[], null, null),
  ('gen-z', 8 , 'Vibe check',            'stickers/gen-z/vibe-check.png',             '{genz,words,barkada}'::text[], 'whoamiwith', null),
  ('gen-z', 9 , 'Understood the assignment', 'stickers/gen-z/understood-the-assignment.png', '{genz,words,ootd,win}'::text[], 'ootd', null),
  ('gen-z', 10, 'Delulu era',            'stickers/gen-z/delulu-era.png',             '{genz,words,funny}'::text[], null, null),
  ('gen-z', 11, 'Rent free',             'stickers/gen-z/rent-free.png',              '{genz,words,love}'::text[], null, null),
  ('gen-z', 12, 'Iconic',                'stickers/gen-z/iconic.png',                 '{genz,words,selfie}'::text[], null, null),
  -- Trentahin
  ('trentahin', 1 , 'Bawal na mapuyat',  'stickers/trentahin/bawal-na-mapuyat.png',   '{thirties,words,filipino,rest}'::text[], 'evening', null),
  ('trentahin', 2 , 'Likod check',       'stickers/trentahin/likod-check.png',        '{thirties,words,filipino,funny}'::text[], null, null),
  ('trentahin', 3 , 'Tulog by 9',        'stickers/trentahin/tulog-by-9.png',         '{thirties,words,rest}'::text[], 'evening', null),
  ('trentahin', 4 , 'Ipon mode',         'stickers/trentahin/ipon-mode.png',          '{thirties,words,money,filipino}'::text[], null, null),
  ('trentahin', 5 , 'Kape muna',         'stickers/trentahin/kape-muna.png',          '{thirties,words,coffee,filipino}'::text[], 'morning', null),
  ('trentahin', 6 , 'Healing era',       'stickers/trentahin/healing-era.png',        '{thirties,words,rest}'::text[], null, null),
  ('trentahin', 7 , 'Salonpas gang',     'stickers/trentahin/salonpas-gang.png',      '{thirties,words,funny}'::text[], null, null),
  ('trentahin', 8 , 'Adulting',          'stickers/trentahin/adulting.png',           '{thirties,words,work}'::text[], 'mebusywith', null),
  ('trentahin', 9 , 'Bills paid',        'stickers/trentahin/bills-paid.png',         '{thirties,words,money,win}'::text[], null, null),
  ('trentahin', 10, 'May pasok bukas',   'stickers/trentahin/may-pasok-bukas.png',    '{thirties,words,work,filipino}'::text[], 'evening', null),
  ('trentahin', 11, 'Early dinner club', 'stickers/trentahin/early-dinner-club.png',  '{thirties,words,food}'::text[], 'evening', null),
  ('trentahin', 12, 'Pahinga is productive', 'stickers/trentahin/pahinga-is-productive.png', '{thirties,words,rest,filipino}'::text[], null, null),
  -- Pride
  ('pride', 1 , 'Love is love',          'stickers/pride/love-is-love.png',           '{pride,words,love}'::text[], null, null),
  ('pride', 2 , 'Happy Pride',           'stickers/pride/happy-pride.png',            '{pride,words,greeting}'::text[], null, null),
  ('pride', 3 , 'Out and proud',         'stickers/pride/out-and-proud.png',          '{pride,words,selfie}'::text[], 'selfie', null),
  ('pride', 4 , 'Be yourself',           'stickers/pride/be-yourself.png',            '{pride,words,ootd}'::text[], 'ootd', null),
  ('pride', 5 , 'Chosen family',         'stickers/pride/chosen-family.png',          '{pride,words,friends,family}'::text[], 'whoamiwith', null),
  ('pride', 6 , 'Proud ally',            'stickers/pride/proud-ally.png',             '{pride,words,friends}'::text[], null, null),
  ('pride', 7 , 'Love wins',             'stickers/pride/love-wins.png',              '{pride,words,love}'::text[], null, null),
  ('pride', 8 , 'Queer joy',             'stickers/pride/queer-joy.png',              '{pride,words,happy}'::text[], null, null),
  ('pride', 9 , 'Rainbow vibes',         'stickers/pride/rainbow-vibes.png',          '{pride,words,happy}'::text[], null, null),
  ('pride', 10, 'Pride march',           'stickers/pride/pride-march.png',            '{pride,words,barkada}'::text[], 'whereami', null),
  ('pride', 11, 'Safe space',            'stickers/pride/safe-space.png',             '{pride,words,friends}'::text[], null, null),
  ('pride', 12, 'Ganda mo, mars',        'stickers/pride/ganda-mo-mars.png',          '{pride,words,filipino,ootd}'::text[], 'ootd', null),
  -- Cyclists
  ('cyclists', 1 , 'Ride on',            'stickers/cyclists/ride-on.png',             '{cycling,words,sports}'::text[], null, null),
  ('cyclists', 2 , 'Padyak',             'stickers/cyclists/padyak.png',              '{cycling,words,filipino}'::text[], 'mebusywith', null),
  ('cyclists', 3 , 'Long ride',          'stickers/cyclists/long-ride.png',           '{cycling,words,travel}'::text[], 'whereami', null),
  ('cyclists', 4 , 'Coffee ride',        'stickers/cyclists/coffee-ride.png',         '{cycling,words,coffee}'::text[], 'morning', null),
  ('cyclists', 5 , 'Sunday ride',        'stickers/cyclists/sunday-ride.png',         '{cycling,words,weekend}'::text[], 'morning', null),
  ('cyclists', 6 , 'Ahon pa',            'stickers/cyclists/ahon-pa.png',             '{cycling,words,filipino}'::text[], null, null),
  ('cyclists', 7 , 'Uphill grind',       'stickers/cyclists/uphill-grind.png',        '{cycling,words,sports}'::text[], null, null),
  ('cyclists', 8 , '100 km done',        'stickers/cyclists/100-km-done.png',         '{cycling,words,win}'::text[], null, null),
  ('cyclists', 9 , 'Clipped in',         'stickers/cyclists/clipped-in.png',          '{cycling,words,ootd}'::text[], 'ootd', null),
  ('cyclists', 10, 'Rest stop',          'stickers/cyclists/rest-stop.png',           '{cycling,words,food,rest}'::text[], 'afternoon', null),
  ('cyclists', 11, 'Bike to work',       'stickers/cyclists/bike-to-work.png',        '{cycling,words,work,commute}'::text[], 'whereami', null),
  ('cyclists', 12, 'Pedal power',        'stickers/cyclists/pedal-power.png',         '{cycling,words,sports}'::text[], null, null)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, milestone_key)
join public.sticker_packs p on p.slug = v.pack_slug;

-- Accounts that already reached a new milestone get it now; the app shows its Sticker unlocked screen once.
select public.grant_milestones(id) from public.profiles;
