-- 0167 — Valentines (FR-STK-02, FR-STK-06). Additive only: a new premium pack and its
-- 30 drawings. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; new packs: Birthdays, New Year, Valentines.
-- Tier is premium until the owner decides otherwise.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

insert into public.sticker_packs (slug, name, tier, store_product_id, sort, description) values
  ('valentines', 'Valentines', 'premium', 'me.pickld.pack.valentines', 31, 'Roses, boba dates, lovebirds and lolo and lola on their bench. For partners, crushes, best friends and loving yourself.');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('valentines', 1, 'Hearts', 'stickers/valentines/hearts.png', '{valentines,love}'::text[], null, 1024, 791),
  ('valentines', 2, 'Roses', 'stickers/valentines/roses.png', '{valentines,flowers,gift}'::text[], null, 834, 1024),
  ('valentines', 3, 'Chocolates', 'stickers/valentines/chocolates.png', '{valentines,sweet,gift}'::text[], null, 902, 1024),
  ('valentines', 4, 'Love letter', 'stickers/valentines/love-letter.png', '{valentines,love,letter}'::text[], null, 932, 1024),
  ('valentines', 5, 'Cupid', 'stickers/valentines/cupid.png', '{valentines,love}'::text[], null, 996, 1024),
  ('valentines', 6, 'Heart bear', 'stickers/valentines/heart-bear.png', '{valentines,cute,gift}'::text[], null, 772, 1024),
  ('valentines', 7, 'Coffee date', 'stickers/valentines/coffee-date.png', '{valentines,date,coffee}'::text[], 'afternoon', 1024, 775),
  ('valentines', 8, 'Holding hands', 'stickers/valentines/holding-hands.png', '{valentines,couple,date}'::text[], 'whoamiwith', 995, 1024),
  ('valentines', 9, 'Love lock', 'stickers/valentines/love-lock.png', '{valentines,love}'::text[], null, 1024, 928),
  ('valentines', 10, 'Penguin pair', 'stickers/valentines/penguin-pair.png', '{valentines,couple,cute}'::text[], null, 1024, 1015),
  ('valentines', 11, 'Dinner for two', 'stickers/valentines/candlelit-dinner.png', '{valentines,date,food}'::text[], 'evening', 1024, 718),
  ('valentines', 12, 'The ring', 'stickers/valentines/ring-box.png', '{valentines,proposal,love}'::text[], null, 816, 1024),
  ('valentines', 13, 'Sweet treats', 'stickers/valentines/sweet-treats.png', '{valentines,sweet,food}'::text[], null, 1024, 734),
  ('valentines', 14, 'Cat couple', 'stickers/valentines/cat-couple.png', '{valentines,cat,couple}'::text[], null, 1024, 867),
  ('valentines', 15, 'Galentine''s', 'stickers/valentines/galentines.png', '{valentines,friends}'::text[], 'whoamiwith', 1024, 931),
  ('valentines', 16, 'Heart balloon', 'stickers/valentines/heart-balloon.png', '{valentines,love,balloon}'::text[], null, 783, 1024),
  ('valentines', 17, 'Finger heart', 'stickers/valentines/finger-heart.png', '{valentines,love,hands}'::text[], null, 1024, 674),
  ('valentines', 18, 'One rose', 'stickers/valentines/single-rose.png', '{valentines,flower,love}'::text[], null, 655, 1024),
  ('valentines', 19, 'Self-love day', 'stickers/valentines/self-love.png', '{valentines,selfcare,cozy}'::text[], 'mebusywith', 1024, 864),
  ('valentines', 20, 'Mended heart', 'stickers/valentines/mended-heart.png', '{valentines,heart,hope}'::text[], null, 1024, 897),
  ('valentines', 21, 'Rainy day date', 'stickers/valentines/rain-date.png', '{valentines,couple,rain}'::text[], 'whoamiwith', 1024, 1019),
  ('valentines', 22, 'Boba date', 'stickers/valentines/boba-date.png', '{valentines,date,drink}'::text[], null, 1024, 926),
  ('valentines', 23, 'Forever love', 'stickers/valentines/lolo-lola.png', '{valentines,couple,family}'::text[], 'whoamiwith', 922, 1024),
  ('valentines', 24, 'Movie night', 'stickers/valentines/movie-night.png', '{valentines,date,cozy}'::text[], 'evening', 1024, 791),
  ('valentines', 25, 'Picnic date', 'stickers/valentines/picnic-date.png', '{valentines,date,food}'::text[], 'afternoon', 1024, 834),
  ('valentines', 26, 'Miss you', 'stickers/valentines/video-call.png', '{valentines,longdistance,love}'::text[], null, 929, 1024),
  ('valentines', 27, 'Lovebirds', 'stickers/valentines/lovebirds.png', '{valentines,bird,couple}'::text[], null, 1024, 697),
  ('valentines', 28, 'Rose pup', 'stickers/valentines/rose-pup.png', '{valentines,dog,love}'::text[], null, 1024, 1015),
  ('valentines', 29, 'Heart pizza', 'stickers/valentines/heart-pizza.png', '{valentines,food,love}'::text[], null, 1024, 904),
  ('valentines', 30, 'Love song', 'stickers/valentines/love-song.png', '{valentines,music,love}'::text[], null, 1024, 1007)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
