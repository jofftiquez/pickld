-- 0159 — Pinoy Life grows to 30 drawings (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/pinoy-life/traffic-na-naman.png',
  'stickers/pinoy-life/sweldo-day.png',
  'stickers/pinoy-life/bahala-na.png',
  'stickers/pinoy-life/charot.png',
  'stickers/pinoy-life/kain-na.png',
  'stickers/pinoy-life/pa-picture.png',
  'stickers/pinoy-life/tara-na.png',
  'stickers/pinoy-life/pasalubong.png',
  'stickers/pinoy-life/mainit-grabe.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('pinoy-life', 17, 'Sinigang', 'stickers/pinoy-life/sinigang.png', '{filipino,food,dinner,family}'::text[], 'evening', 1024, 925),
  ('pinoy-life', 18, 'Turon', 'stickers/pinoy-life/turon.png', '{filipino,food,merienda}'::text[], 'afternoon', 1024, 700),
  ('pinoy-life', 19, 'Lumpia', 'stickers/pinoy-life/lumpia.png', '{filipino,food,party}'::text[], null, 1024, 703),
  ('pinoy-life', 20, 'Sapin-sapin', 'stickers/pinoy-life/sapin-sapin.png', '{filipino,food,merienda,ube}'::text[], 'afternoon', 1024, 732),
  ('pinoy-life', 21, 'Fishball', 'stickers/pinoy-life/fishball.png', '{filipino,food,street_food}'::text[], 'afternoon', 732, 1024),
  ('pinoy-life', 22, 'Sorbetes', 'stickers/pinoy-life/sorbetes.png', '{filipino,food,dessert,summer}'::text[], 'afternoon', 1024, 699),
  ('pinoy-life', 23, 'Calamansi', 'stickers/pinoy-life/calamansi.png', '{filipino,food,fruit}'::text[], null, 1005, 1024),
  ('pinoy-life', 24, 'Kalesa', 'stickers/pinoy-life/kalesa.png', '{filipino,travel,horse}'::text[], 'whereami', 1024, 686),
  ('pinoy-life', 25, 'Bahay kubo', 'stickers/pinoy-life/bahay-kubo.png', '{filipino,home,province}'::text[], 'whereami', 1024, 868),
  ('pinoy-life', 26, 'Tsinelas', 'stickers/pinoy-life/tsinelas.png', '{filipino,ootd,summer}'::text[], 'ootd', 907, 1024),
  ('pinoy-life', 27, 'Tabo', 'stickers/pinoy-life/tabo.png', '{filipino,home,funny}'::text[], 'morning', 1024, 831),
  ('pinoy-life', 28, 'Walis tingting', 'stickers/pinoy-life/walis-tingting.png', '{filipino,home,chores}'::text[], 'mebusywith', 925, 1024),
  ('pinoy-life', 29, 'Banderitas', 'stickers/pinoy-life/banderitas.png', '{filipino,fiesta,party}'::text[], null, 1024, 377),
  ('pinoy-life', 30, 'Street hoop', 'stickers/pinoy-life/street-hoop.png', '{filipino,sports,basketball}'::text[], 'mebusywith', 850, 1024)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
