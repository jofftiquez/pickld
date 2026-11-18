-- 0161 — Barkada grows to 30 drawings (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/barkada/libre-mo.png',
  'stickers/barkada/squad.png',
  'stickers/barkada/g-na.png',
  'stickers/barkada/inuman.png',
  'stickers/barkada/late-ka-na-naman.png',
  'stickers/barkada/walang-iwanan.png',
  'stickers/barkada/kwentuhan.png',
  'stickers/barkada/bff.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('barkada', 10, 'Bonfire', 'stickers/barkada/bonfire.png', '{barkada,camping,night}'::text[], 'evening', 1024, 847),
  ('barkada', 11, 'Camping', 'stickers/barkada/camping.png', '{barkada,camping,travel,outdoors}'::text[], 'whereami', 1024, 790),
  ('barkada', 12, 'Game night', 'stickers/barkada/game-night.png', '{barkada,games}'::text[], 'evening', 1024, 822),
  ('barkada', 13, 'Movie night', 'stickers/barkada/movie-night.png', '{barkada,movies,snacks}'::text[], 'evening', 1024, 1007),
  ('barkada', 14, 'Milk tea date', 'stickers/barkada/milk-tea-date.png', '{barkada,milk_tea,friends}'::text[], 'afternoon', 1020, 1024),
  ('barkada', 15, 'Friendship bracelets', 'stickers/barkada/friendship-bracelets.png', '{barkada,friends,bff}'::text[], 'whoamiwith', 1024, 845),
  ('barkada', 16, 'Beach ball', 'stickers/barkada/beach-ball.png', '{barkada,beach,summer}'::text[], 'whereami', 669, 1024),
  ('barkada', 17, 'Picnic', 'stickers/barkada/picnic.png', '{barkada,food,outdoors}'::text[], 'afternoon', 922, 1024),
  ('barkada', 18, 'Samgyup night', 'stickers/barkada/samgyup.png', '{barkada,food,dinner}'::text[], 'evening', 1024, 894),
  ('barkada', 19, 'Share fries', 'stickers/barkada/share-fries.png', '{barkada,food,snacks}'::text[], null, 1024, 889),
  ('barkada', 20, 'Sparklers', 'stickers/barkada/sparklers.png', '{barkada,party,night}'::text[], 'evening', 1024, 1020),
  ('barkada', 21, 'Pinky promise', 'stickers/barkada/pinky-promise.png', '{barkada,bff,love}'::text[], 'whoamiwith', 1024, 943),
  ('barkada', 22, 'Group hug', 'stickers/barkada/group-hug.png', '{barkada,friends,love}'::text[], 'whoamiwith', 970, 1024),
  ('barkada', 23, 'Bowling', 'stickers/barkada/bowling.png', '{barkada,games,sports}'::text[], null, 1024, 854),
  ('barkada', 24, 'Player two', 'stickers/barkada/player-two.png', '{barkada,games,bff}'::text[], null, 1024, 687),
  ('barkada', 25, 'Party popper', 'stickers/barkada/party-popper.png', '{barkada,party,win}'::text[], null, 926, 1024),
  ('barkada', 26, 'Video call', 'stickers/barkada/video-call.png', '{barkada,friends,long_distance}'::text[], 'whoamiwith', 728, 1024),
  ('barkada', 27, 'Balloons', 'stickers/barkada/balloons.png', '{barkada,party,birthday}'::text[], null, 845, 1024),
  ('barkada', 28, 'Lakad tayo', 'stickers/barkada/walk-together.png', '{barkada,friends,walk}'::text[], 'whereami', 1024, 670),
  ('barkada', 29, 'Food crawl', 'stickers/barkada/food-crawl.png', '{barkada,food,foodtrip}'::text[], null, 609, 1024),
  ('barkada', 30, 'Sleepover', 'stickers/barkada/sleepover.png', '{barkada,night,home}'::text[], 'evening', 1024, 829)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
