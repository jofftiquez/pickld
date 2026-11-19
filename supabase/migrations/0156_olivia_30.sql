-- 0156 — Olivia grows from 16 to 30 stickers (FR-STK-02, FR-STK-06). Additive only: new sticker rows. The original
-- 16 stay as they are; no tier, store product or other pack changes.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; keep Olivia's original 16 and draw 14 more.
--
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('olivia', 17, 'Good morning', 'stickers/olivia/good-morning.png', '{cat,olivia,pets,morning}'::text[], 'morning', 930, 1024),
  ('olivia', 18, 'Window watch', 'stickers/olivia/window-watch.png', '{cat,olivia,pets,home}'::text[], 'whereami', 882, 1024),
  ('olivia', 19, 'Keyboard cat', 'stickers/olivia/keyboard-cat.png', '{cat,olivia,pets,work,funny}'::text[], 'mebusywith', 1024, 799),
  ('olivia', 20, 'Sun puddle', 'stickers/olivia/sun-puddle.png', '{cat,olivia,pets,rest}'::text[], 'afternoon', 1024, 931),
  ('olivia', 21, 'Night owl', 'stickers/olivia/night-owl.png', '{cat,olivia,pets,sleepy}'::text[], 'evening', 1024, 1015),
  ('olivia', 22, 'Selfie', 'stickers/olivia/selfie.png', '{cat,olivia,pets,selfie}'::text[], 'selfie', 907, 1024),
  ('olivia', 23, 'Lady queen', 'stickers/olivia/lady-queen.png', '{cat,olivia,pets,ootd}'::text[], 'ootd', 941, 1024),
  ('olivia', 24, 'Cuddle buddy', 'stickers/olivia/cuddle-buddy.png', '{cat,olivia,pets,love}'::text[], 'whoamiwith', 1024, 873),
  ('olivia', 25, 'Bath time? No', 'stickers/olivia/bath-time-no.png', '{cat,olivia,pets,funny}'::text[], null, 916, 1024),
  ('olivia', 26, 'If I fits, I sits', 'stickers/olivia/if-i-fits.png', '{cat,olivia,pets,funny,home}'::text[], null, 1024, 1013),
  ('olivia', 27, 'Laundry queen', 'stickers/olivia/laundry-queen.png', '{cat,olivia,pets,home,chores}'::text[], 'mebusywith', 898, 1024),
  ('olivia', 28, 'Hunting mode', 'stickers/olivia/hunting-mode.png', '{cat,olivia,pets,funny}'::text[], null, 1010, 1024),
  ('olivia', 29, 'Judging you', 'stickers/olivia/judging-you.png', '{cat,olivia,pets,funny}'::text[], null, 831, 1024),
  ('olivia', 30, 'TV time', 'stickers/olivia/tv-time.png', '{cat,olivia,pets,home,rest}'::text[], 'evening', 1024, 929)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
