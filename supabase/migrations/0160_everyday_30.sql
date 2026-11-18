-- 0160 — Everyday grows to 30 drawings (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/everyday/kape-muna.png',
  'stickers/everyday/real-ako.png',
  'stickers/everyday/busy-bee.png',
  'stickers/everyday/sana-all.png',
  'stickers/everyday/laban.png',
  'stickers/everyday/okay-lang.png',
  'stickers/everyday/salamat.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('everyday', 11, 'Panda', 'stickers/everyday/panda.png', '{animal,cute}'::text[], null, 850, 1024),
  ('everyday', 12, 'Penguin', 'stickers/everyday/penguin.png', '{animal,cute,greeting}'::text[], null, 998, 1024),
  ('everyday', 13, 'Fox', 'stickers/everyday/fox.png', '{animal,cute}'::text[], null, 807, 1024),
  ('everyday', 14, 'Koala', 'stickers/everyday/koala.png', '{animal,cute,sleepy}'::text[], null, 932, 1024),
  ('everyday', 15, 'Hamster', 'stickers/everyday/hamster.png', '{animal,cute,food}'::text[], null, 954, 1024),
  ('everyday', 16, 'Pawikan', 'stickers/everyday/turtle.png', '{animal,cute,beach}'::text[], null, 1024, 810),
  ('everyday', 17, 'Duckling', 'stickers/everyday/duckling.png', '{animal,cute,rain}'::text[], null, 824, 1024),
  ('everyday', 18, 'Pinya', 'stickers/everyday/pineapple.png', '{fruit,food,summer}'::text[], null, 648, 1024),
  ('everyday', 19, 'Cherries', 'stickers/everyday/cherries.png', '{fruit,food,love}'::text[], null, 1024, 960),
  ('everyday', 20, 'Lemon', 'stickers/everyday/lemon.png', '{fruit,food}'::text[], null, 826, 1024),
  ('everyday', 21, 'Peach', 'stickers/everyday/peach.png', '{fruit,food}'::text[], null, 975, 1024),
  ('everyday', 22, 'Donut', 'stickers/everyday/donut.png', '{food,dessert,snacks}'::text[], 'afternoon', 997, 1024),
  ('everyday', 23, 'Cupcake', 'stickers/everyday/cupcake.png', '{food,dessert}'::text[], null, 735, 1024),
  ('everyday', 24, 'Popsicle', 'stickers/everyday/popsicle.png', '{food,dessert,summer}'::text[], 'afternoon', 547, 1024),
  ('everyday', 25, 'Sunny', 'stickers/everyday/sunny.png', '{weather,sun,happy}'::text[], 'morning', 986, 1024),
  ('everyday', 26, 'Cloudy', 'stickers/everyday/cloudy.png', '{weather,rain}'::text[], null, 1024, 922),
  ('everyday', 27, 'Rainbow', 'stickers/everyday/rainbow.png', '{weather,happy}'::text[], null, 1024, 540),
  ('everyday', 28, 'Star', 'stickers/everyday/star.png', '{win,happy}'::text[], null, 1024, 958),
  ('everyday', 29, 'Flower', 'stickers/everyday/flower.png', '{flower,happy}'::text[], null, 812, 1024),
  ('everyday', 30, 'Teddy', 'stickers/everyday/teddy.png', '{animal,cute,party}'::text[], null, 865, 1024)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
