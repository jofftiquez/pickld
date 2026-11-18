-- 0158 — The Eight grows to 30 drawings (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/the-eight/nasa-bahay-lang.png',
  'stickers/the-eight/deadline-mode.png',
  'stickers/the-eight/barkada.png',
  'stickers/the-eight/office-fit.png',
  'stickers/the-eight/walang-filter.png',
  'stickers/the-eight/good-morning.png',
  'stickers/the-eight/siesta.png',
  'stickers/the-eight/uwian-na.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('the-eight', 17, 'Beach day', 'stickers/the-eight/beach-day.png', '{beach,travel,summer}'::text[], 'whereami', 917, 1024),
  ('the-eight', 18, 'Mountain view', 'stickers/the-eight/mountain-view.png', '{mountain,travel,outdoors}'::text[], 'whereami', 1024, 730),
  ('the-eight', 19, 'Art time', 'stickers/the-eight/art-time.png', '{art,hobby}'::text[], 'mebusywith', 1024, 808),
  ('the-eight', 20, 'Cooking', 'stickers/the-eight/cooking.png', '{food,cooking,home}'::text[], 'mebusywith', 1024, 861),
  ('the-eight', 21, 'Best buds', 'stickers/the-eight/best-buds.png', '{friends,barkada,love}'::text[], 'whoamiwith', 1024, 891),
  ('the-eight', 22, 'Family', 'stickers/the-eight/duck-family.png', '{family}'::text[], 'whoamiwith', 1024, 498),
  ('the-eight', 23, 'Fresh tee', 'stickers/the-eight/fresh-tee.png', '{ootd,clothes}'::text[], 'ootd', 912, 1024),
  ('the-eight', 24, 'Bucket hat', 'stickers/the-eight/bucket-hat.png', '{ootd,clothes}'::text[], 'ootd', 1024, 722),
  ('the-eight', 25, 'Selfie time', 'stickers/the-eight/selfie-phone.png', '{selfie,phone}'::text[], 'selfie', 1024, 982),
  ('the-eight', 26, 'Mirror check', 'stickers/the-eight/mirror-check.png', '{selfie,ootd}'::text[], 'selfie', 685, 1024),
  ('the-eight', 27, 'Latte', 'stickers/the-eight/latte.png', '{coffee,breakfast}'::text[], 'morning', 990, 1024),
  ('the-eight', 28, 'Ice cream', 'stickers/the-eight/ice-cream.png', '{food,dessert,summer}'::text[], 'afternoon', 546, 1024),
  ('the-eight', 29, 'Ramen night', 'stickers/the-eight/ramen.png', '{food,dinner}'::text[], 'evening', 1024, 962),
  ('the-eight', 30, 'Sleepy stars', 'stickers/the-eight/sleepy-stars.png', '{night,sleepy}'::text[], 'evening', 1024, 1020)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
