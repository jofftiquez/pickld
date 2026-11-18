-- 0154 — Thirty stickers in every text pack (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on one
-- stamp. Nothing is dropped, renamed or deleted, and no tier, store product or free pack changes.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; keep the word-art packs and add more; replace
-- "100% totoo" with "100% real".
--
--   Stamps       10 → 30    100% totoo retired, 100% real and 20 more plain stamps
--   Corporate, Gen Z, Trentahin, Pride, Cyclists   12 → 30 each, in the pack's own lettering (word-art.mjs)
--   Hashtags     16 → 30    in speech bubbles
--
-- Retired stickers stay drawable in moments that already use them (0032); their art stays bundled.
-- Art: rendered by scripts/render-stickers.mjs (STICKER_CATALOG mode) and bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where asset_path = 'stickers/stamps/totoo.png' and retired_at is null;

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  -- stamps
  ('stamps', 11, '100% real', 'stickers/stamps/100-real.png', '{real,honest,stamp}'::text[], 'selfie', 1840, 632),
  ('stamps', 12, 'Good day', 'stickers/stamps/good-day.png', '{happy,stamp}'::text[], null, 1808, 632),
  ('stamps', 13, 'Big day', 'stickers/stamps/big-day.png', '{win,stamp}'::text[], null, 2041, 876),
  ('stamps', 14, 'Long day', 'stickers/stamps/long-day.png', '{work,rest,stamp}'::text[], 'evening', 1736, 632),
  ('stamps', 15, 'Lazy day', 'stickers/stamps/lazy-day.png', '{rest,stamp}'::text[], null, 1640, 632),
  ('stamps', 16, 'Sick day', 'stickers/stamps/sick-day.png', '{rest,sick,stamp}'::text[], null, 1616, 632),
  ('stamps', 17, 'Payday', 'stickers/stamps/payday.png', '{money,work,stamp}'::text[], null, 2041, 891),
  ('stamps', 18, 'Weekend', 'stickers/stamps/weekend.png', '{weekend,rest,stamp}'::text[], null, 1672, 632),
  ('stamps', 19, 'Travel day', 'stickers/stamps/travel-day.png', '{travel,stamp}'::text[], 'whereami', 1936, 632),
  ('stamps', 20, 'First time', 'stickers/stamps/first-time.png', '{memories,stamp}'::text[], null, 1784, 632),
  ('stamps', 21, 'Grateful', 'stickers/stamps/grateful.png', '{happy,stamp}'::text[], null, 1728, 632),
  ('stamps', 22, 'Done', 'stickers/stamps/done.png', '{work,win,stamp}'::text[], 'evening', 2035, 1072),
  ('stamps', 23, 'Win', 'stickers/stamps/win.png', '{win,stamp}'::text[], null, 2000, 1264),
  ('stamps', 24, 'Hello', 'stickers/stamps/hello.png', '{greeting,stamp}'::text[], 'morning', 2042, 1002),
  ('stamps', 25, 'Ordinary day', 'stickers/stamps/ordinary-day.png', '{real,stamp}'::text[], null, 2045, 561),
  ('stamps', 26, 'Behind the scenes', 'stickers/stamps/behind-the-scenes.png', '{real,work,stamp}'::text[], 'mebusywith', 2046, 448),
  ('stamps', 27, 'Unplanned', 'stickers/stamps/unplanned.png', '{real,stamp}'::text[], null, 1968, 632),
  ('stamps', 28, 'Keep this', 'stickers/stamps/keep-this.png', '{memories,stamp}'::text[], null, 1696, 632),
  ('stamps', 29, 'Homebody', 'stickers/stamps/homebody.png', '{home,rest,stamp}'::text[], 'whereami', 1920, 632),
  ('stamps', 30, 'Out and about', 'stickers/stamps/out-and-about.png', '{travel,stamp}'::text[], 'whereami', 2042, 524),
  ('stamps', 31, 'Approved', 'stickers/stamps/approved.png', '{win,stamp}'::text[], null, 1824, 632),
  -- corporate
  ('corporate', 13, 'Let''s align', 'stickers/corporate/lets-align.png', '{work,meeting,words}'::text[], 'mebusywith', 2047, 694),
  ('corporate', 14, 'Touch base', 'stickers/corporate/touch-base.png', '{work,meeting,words}'::text[], null, 2043, 650),
  ('corporate', 15, 'Deep dive', 'stickers/corporate/deep-dive.png', '{work,meeting,words}'::text[], 'mebusywith', 2043, 718),
  ('corporate', 16, 'Hard stop', 'stickers/corporate/hard-stop.png', '{work,meeting,words,funny}'::text[], null, 2045, 718),
  ('corporate', 17, 'Bandwidth?', 'stickers/corporate/bandwidth.png', '{work,words,funny}'::text[], null, 2047, 644),
  ('corporate', 18, 'Low-hanging fruit', 'stickers/corporate/low-hanging-fruit.png', '{work,words,funny}'::text[], null, 2044, 839),
  ('corporate', 19, 'Moving forward', 'stickers/corporate/moving-forward.png', '{work,words}'::text[], null, 2041, 1154),
  ('corporate', 20, 'Can you see my screen?', 'stickers/corporate/can-you-see-my-screen.png', '{work,meeting,words,funny}'::text[], 'mebusywith', 2047, 842),
  ('corporate', 21, 'For your approval', 'stickers/corporate/for-your-approval.png', '{work,words}'::text[], null, 2045, 1080),
  ('corporate', 22, 'Ready for review', 'stickers/corporate/ready-for-review.png', '{work,words}'::text[], 'mebusywith', 2045, 1004),
  ('corporate', 23, 'Ship it', 'stickers/corporate/ship-it.png', '{work,win,words}'::text[], null, 2040, 922),
  ('corporate', 24, 'Team lunch', 'stickers/corporate/team-lunch.png', '{work,food,coworkers,words}'::text[], 'afternoon', 2046, 645),
  ('corporate', 25, 'Payday', 'stickers/corporate/payday.png', '{work,money,words}'::text[], null, 2048, 881),
  ('corporate', 26, 'Kape break', 'stickers/corporate/kape-break.png', '{work,coffee,words,filipino}'::text[], 'morning', 2048, 646),
  ('corporate', 27, 'Big win', 'stickers/corporate/big-win.png', '{work,win,words}'::text[], null, 2047, 849),
  ('corporate', 28, 'Team building', 'stickers/corporate/team-building.png', '{work,coworkers,words}'::text[], 'whoamiwith', 2047, 565),
  ('corporate', 29, 'New hire', 'stickers/corporate/new-hire.png', '{work,coworkers,words}'::text[], null, 2043, 759),
  ('corporate', 30, 'Promoted!', 'stickers/corporate/promoted.png', '{work,win,words}'::text[], null, 2045, 706),
  -- gen-z
  ('gen-z', 13, 'Say less', 'stickers/gen-z/say-less.png', '{genz,words}'::text[], null, 2048, 823),
  ('gen-z', 14, 'Periodt', 'stickers/gen-z/periodt.png', '{genz,words}'::text[], null, 2045, 859),
  ('gen-z', 15, 'Highkey', 'stickers/gen-z/highkey.png', '{genz,words}'::text[], null, 2045, 841),
  ('gen-z', 16, 'Bussin', 'stickers/gen-z/bussin.png', '{genz,words,food}'::text[], null, 2045, 927),
  ('gen-z', 17, 'Touch grass', 'stickers/gen-z/touch-grass.png', '{genz,words,travel}'::text[], 'whereami', 2046, 622),
  ('gen-z', 18, 'Glow up', 'stickers/gen-z/glow-up.png', '{genz,words,selfie}'::text[], 'selfie', 2045, 809),
  ('gen-z', 19, 'Soft launch', 'stickers/gen-z/soft-launch.png', '{genz,words,love}'::text[], 'whoamiwith', 2046, 630),
  ('gen-z', 20, 'Hard launch', 'stickers/gen-z/hard-launch.png', '{genz,words,love}'::text[], 'whoamiwith', 2048, 613),
  ('gen-z', 21, 'Core memory', 'stickers/gen-z/core-memory.png', '{genz,words,barkada}'::text[], null, 2045, 604),
  ('gen-z', 22, 'Caught in 4K', 'stickers/gen-z/caught-in-4k.png', '{genz,words,funny}'::text[], null, 2048, 609),
  ('gen-z', 23, 'Mother', 'stickers/gen-z/mother.png', '{genz,words,ootd}'::text[], 'ootd', 2043, 870),
  ('gen-z', 24, 'Purr', 'stickers/gen-z/purr.png', '{genz,words,ootd}'::text[], 'ootd', 1824, 968),
  ('gen-z', 25, 'Big W', 'stickers/gen-z/big-w.png', '{genz,words,win}'::text[], null, 1936, 968),
  ('gen-z', 26, 'Girl dinner', 'stickers/gen-z/girl-dinner.png', '{genz,words,food}'::text[], 'evening', 2047, 657),
  ('gen-z', 27, 'The ick', 'stickers/gen-z/the-ick.png', '{genz,words,funny}'::text[], null, 2047, 907),
  ('gen-z', 28, 'Bestie', 'stickers/gen-z/bestie.png', '{genz,words,friends}'::text[], 'whoamiwith', 2008, 968),
  ('gen-z', 29, 'Era unlocked', 'stickers/gen-z/era-unlocked.png', '{genz,words,win}'::text[], null, 2046, 589),
  ('gen-z', 30, 'It''s a vibe', 'stickers/gen-z/its-a-vibe.png', '{genz,words}'::text[], null, 2048, 727),
  -- trentahin
  ('trentahin', 13, 'Plantita era', 'stickers/trentahin/plantita-era.png', '{thirties,words,home}'::text[], null, 2046, 785),
  ('trentahin', 14, 'Maintenance meds', 'stickers/trentahin/maintenance-meds.png', '{thirties,words,funny}'::text[], null, 2045, 592),
  ('trentahin', 15, 'Vitamins taken', 'stickers/trentahin/vitamins-taken.png', '{thirties,words}'::text[], 'morning', 2043, 688),
  ('trentahin', 16, 'Tuhod check', 'stickers/trentahin/tuhod-check.png', '{thirties,words,filipino,funny}'::text[], null, 2044, 800),
  ('trentahin', 17, 'Home by 8', 'stickers/trentahin/home-by-8.png', '{thirties,words,home,rest}'::text[], 'evening', 2047, 832),
  ('trentahin', 18, 'Plans cancelled, yay!', 'stickers/trentahin/plans-cancelled-yay.png', '{thirties,words,rest,funny}'::text[], null, 2048, 1029),
  ('trentahin', 19, 'Hydrate', 'stickers/trentahin/hydrate.png', '{thirties,words}'::text[], null, 2043, 991),
  ('trentahin', 20, 'Grocery date', 'stickers/trentahin/grocery-date.png', '{thirties,words,food}'::text[], 'whereami', 2045, 760),
  ('trentahin', 21, 'Laba day', 'stickers/trentahin/laba-day.png', '{thirties,words,home,filipino}'::text[], null, 2047, 947),
  ('trentahin', 22, 'Ninang era', 'stickers/trentahin/ninang-era.png', '{thirties,words,family,filipino}'::text[], 'whoamiwith', 2043, 841),
  ('trentahin', 23, 'Pa-check up', 'stickers/trentahin/pa-check-up.png', '{thirties,words,filipino}'::text[], null, 2045, 808),
  ('trentahin', 24, 'Sahod, bayad, ubos', 'stickers/trentahin/sahod-bayad-ubos.png', '{thirties,words,money,filipino,funny}'::text[], null, 2048, 1193),
  ('trentahin', 25, 'Walking is cardio', 'stickers/trentahin/walking-is-cardio.png', '{thirties,words,sports}'::text[], null, 2041, 1403),
  ('trentahin', 26, 'Emergency fund', 'stickers/trentahin/emergency-fund.png', '{thirties,words,money}'::text[], null, 2046, 670),
  ('trentahin', 27, 'Lumbar support', 'stickers/trentahin/lumbar-support.png', '{thirties,words,work,funny}'::text[], 'mebusywith', 2046, 652),
  ('trentahin', 28, 'Pagod pero okay', 'stickers/trentahin/pagod-pero-okay.png', '{thirties,words,filipino,rest}'::text[], 'evening', 2045, 642),
  ('trentahin', 29, 'Quiet weekend', 'stickers/trentahin/quiet-weekend.png', '{thirties,words,rest,weekend}'::text[], null, 2047, 712),
  ('trentahin', 30, 'Thirty and thriving', 'stickers/trentahin/thirty-and-thriving.png', '{thirties,words,win}'::text[], null, 2046, 1226),
  -- pride
  ('pride', 13, 'Trans joy', 'stickers/pride/trans-joy.png', '{pride,words,happy}'::text[], null, 2046, 674),
  ('pride', 14, 'Bi pride', 'stickers/pride/bi-pride.png', '{pride,words}'::text[], null, 2048, 748),
  ('pride', 15, 'Pan pride', 'stickers/pride/pan-pride.png', '{pride,words}'::text[], null, 2043, 679),
  ('pride', 16, 'Ace pride', 'stickers/pride/ace-pride.png', '{pride,words}'::text[], null, 2046, 690),
  ('pride', 17, 'Nonbinary and proud', 'stickers/pride/nonbinary-and-proud.png', '{pride,words}'::text[], null, 2046, 870),
  ('pride', 18, 'Lesbian love', 'stickers/pride/lesbian-love.png', '{pride,words,love}'::text[], null, 2045, 553),
  ('pride', 19, 'Gay and proud', 'stickers/pride/gay-and-proud.png', '{pride,words}'::text[], null, 2046, 521),
  ('pride', 20, 'You are valid', 'stickers/pride/you-are-valid.png', '{pride,words,friends}'::text[], null, 2045, 529),
  ('pride', 21, 'Proud of you', 'stickers/pride/proud-of-you.png', '{pride,words,friends,family}'::text[], 'whoamiwith', 2046, 559),
  ('pride', 22, 'You belong', 'stickers/pride/you-belong.png', '{pride,words,friends}'::text[], null, 2046, 619),
  ('pride', 23, 'Love out loud', 'stickers/pride/love-out-loud.png', '{pride,words,love}'::text[], null, 2047, 525),
  ('pride', 24, 'Free to be me', 'stickers/pride/free-to-be-me.png', '{pride,words,selfie}'::text[], 'selfie', 2045, 553),
  ('pride', 25, 'Celebrate love', 'stickers/pride/celebrate-love.png', '{pride,words,love}'::text[], null, 2047, 905),
  ('pride', 26, 'Pride all year', 'stickers/pride/pride-all-year.png', '{pride,words}'::text[], null, 2044, 994),
  ('pride', 27, 'Ally always', 'stickers/pride/ally-always.png', '{pride,words,friends}'::text[], null, 2044, 583),
  ('pride', 28, 'Rainbow family', 'stickers/pride/rainbow-family.png', '{pride,words,family}'::text[], 'whoamiwith', 2046, 1013),
  ('pride', 29, 'Equal love', 'stickers/pride/equal-love.png', '{pride,words,love}'::text[], null, 2044, 625),
  ('pride', 30, 'Different is beautiful', 'stickers/pride/different-is-beautiful.png', '{pride,words}'::text[], null, 2044, 774),
  -- cyclists
  ('cyclists', 13, 'Tailwind', 'stickers/cyclists/tailwind.png', '{cycling,words,sports}'::text[], null, 2046, 631),
  ('cyclists', 14, 'Headwind', 'stickers/cyclists/headwind.png', '{cycling,words,sports,funny}'::text[], null, 2045, 588),
  ('cyclists', 15, 'Flat tire', 'stickers/cyclists/flat-tire.png', '{cycling,words,funny}'::text[], null, 2044, 636),
  ('cyclists', 16, 'Group ride', 'stickers/cyclists/group-ride.png', '{cycling,words,barkada}'::text[], 'whoamiwith', 2043, 545),
  ('cyclists', 17, 'Night ride', 'stickers/cyclists/night-ride.png', '{cycling,words,night}'::text[], 'evening', 2045, 568),
  ('cyclists', 18, 'Gravel day', 'stickers/cyclists/gravel-day.png', '{cycling,words,travel}'::text[], 'whereami', 2047, 552),
  ('cyclists', 19, 'Rain ride', 'stickers/cyclists/rain-ride.png', '{cycling,words,rain}'::text[], null, 2047, 613),
  ('cyclists', 20, 'Saddle sore', 'stickers/cyclists/saddle-sore.png', '{cycling,words,funny}'::text[], null, 2047, 508),
  ('cyclists', 21, 'Downhill', 'stickers/cyclists/downhill.png', '{cycling,words,sports}'::text[], null, 2046, 597),
  ('cyclists', 22, 'Lusong!', 'stickers/cyclists/lusong.png', '{cycling,words,filipino}'::text[], null, 2044, 677),
  ('cyclists', 23, 'KOM', 'stickers/cyclists/kom.png', '{cycling,words,win}'::text[], null, 1816, 824),
  ('cyclists', 24, 'Drafting', 'stickers/cyclists/drafting.png', '{cycling,words,sports}'::text[], null, 2045, 621),
  ('cyclists', 25, 'N+1', 'stickers/cyclists/n-plus-1.png', '{cycling,words,funny}'::text[], null, 2038, 1055),
  ('cyclists', 26, 'Bike is life', 'stickers/cyclists/bike-is-life.png', '{cycling,words}'::text[], null, 2043, 555),
  ('cyclists', 27, '50 km done', 'stickers/cyclists/50-km-done.png', '{cycling,words,win}'::text[], null, 2043, 533),
  ('cyclists', 28, 'Fresh legs', 'stickers/cyclists/fresh-legs.png', '{cycling,words,sports}'::text[], 'morning', 2043, 558),
  ('cyclists', 29, 'Bike shop run', 'stickers/cyclists/bike-shop-run.png', '{cycling,words}'::text[], 'whereami', 2045, 463),
  ('cyclists', 30, 'Ride buddies', 'stickers/cyclists/ride-buddies.png', '{cycling,words,friends}'::text[], 'whoamiwith', 2047, 496),
  -- hashtags
  ('hashtags', 17, '#OOTD', 'stickers/hashtags/ootd.png', '{hashtag,ootd}'::text[], 'ootd', 1680, 1344),
  ('hashtags', 18, '#Foodtrip', 'stickers/hashtags/foodtrip.png', '{hashtag,food}'::text[], null, 2042, 1500),
  ('hashtags', 19, '#Ganap', 'stickers/hashtags/ganap.png', '{hashtag,filipino}'::text[], null, 1848, 1328),
  ('hashtags', 20, '#Budol', 'stickers/hashtags/budol.png', '{hashtag,money,funny,filipino}'::text[], null, 1648, 1360),
  ('hashtags', 21, '#Ipon', 'stickers/hashtags/ipon.png', '{hashtag,money,filipino}'::text[], null, 1776, 1616),
  ('hashtags', 22, '#Bonding', 'stickers/hashtags/bonding.png', '{hashtag,family,barkada}'::text[], 'whoamiwith', 1984, 1368),
  ('hashtags', 23, '#Pasyal', 'stickers/hashtags/pasyal.png', '{hashtag,travel,filipino}'::text[], 'whereami', 2045, 1697),
  ('hashtags', 24, '#KapeMuna', 'stickers/hashtags/kape-muna.png', '{hashtag,coffee,filipino}'::text[], 'morning', 2047, 1186),
  ('hashtags', 25, '#Blessed', 'stickers/hashtags/blessed.png', '{hashtag,happy}'::text[], null, 1928, 1376),
  ('hashtags', 26, '#SelfLove', 'stickers/hashtags/self-love.png', '{hashtag,selfie,rest}'::text[], 'selfie', 2046, 1432),
  ('hashtags', 27, '#Charot', 'stickers/hashtags/charot.png', '{hashtag,funny,filipino}'::text[], null, 1840, 1360),
  ('hashtags', 28, '#Mood', 'stickers/hashtags/mood.png', '{hashtag}'::text[], null, 1952, 1776),
  ('hashtags', 29, '#Grateful', 'stickers/hashtags/grateful.png', '{hashtag,happy}'::text[], null, 2043, 1279),
  ('hashtags', 30, '#GymTime', 'stickers/hashtags/gym-time.png', '{hashtag,sports,gym}'::text[], 'mebusywith', 2046, 1319)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
