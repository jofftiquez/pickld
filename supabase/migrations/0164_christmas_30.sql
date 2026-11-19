-- 0164 — Christmas (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/christmas-2026/simbang-gabi.png',
  'stickers/christmas-2026/noche-buena.png',
  'stickers/christmas-2026/aguinaldo.png',
  'stickers/christmas-2026/christmas-party.png',
  'stickers/christmas-2026/maligayang-pasko.png',
  'stickers/christmas-2026/ninang-duties.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('christmas-2026', 7, 'Christmas tree', 'stickers/christmas-2026/christmas-tree.png', '{christmas,tree,home}'::text[], null, 702, 1024),
  ('christmas-2026', 8, 'Snowman', 'stickers/christmas-2026/snowman.png', '{christmas,winter}'::text[], null, 849, 1024),
  ('christmas-2026', 9, 'Belen', 'stickers/christmas-2026/belen.png', '{christmas,filipino,faith}'::text[], null, 1024, 958),
  ('christmas-2026', 10, 'Stocking', 'stickers/christmas-2026/stocking.png', '{christmas,gift}'::text[], null, 817, 1024),
  ('christmas-2026', 11, 'Queso de bola', 'stickers/christmas-2026/queso-de-bola.png', '{christmas,filipino,food}'::text[], 'evening', 1024, 956),
  ('christmas-2026', 12, 'Gingerbread', 'stickers/christmas-2026/gingerbread.png', '{christmas,food,sweet}'::text[], null, 893, 1024),
  ('christmas-2026', 13, 'Carolers', 'stickers/christmas-2026/carolers.png', '{christmas,filipino,music}'::text[], 'evening', 1024, 1002),
  ('christmas-2026', 14, 'Reindeer', 'stickers/christmas-2026/reindeer.png', '{christmas,animal}'::text[], null, 779, 1024),
  ('christmas-2026', 15, 'Salabat', 'stickers/christmas-2026/salabat.png', '{christmas,filipino,food}'::text[], 'morning', 1024, 730),
  ('christmas-2026', 16, 'Candy cane', 'stickers/christmas-2026/candy-cane.png', '{christmas,sweet}'::text[], null, 675, 1024),
  ('christmas-2026', 17, 'Hot cocoa', 'stickers/christmas-2026/hot-cocoa.png', '{christmas,drink,cozy}'::text[], 'evening', 829, 1024),
  ('christmas-2026', 18, 'Ornament', 'stickers/christmas-2026/ornament.png', '{christmas,decor}'::text[], null, 700, 1024),
  ('christmas-2026', 19, 'Santa', 'stickers/christmas-2026/santa.png', '{christmas,gift}'::text[], null, 922, 1024),
  ('christmas-2026', 20, 'For Santa', 'stickers/christmas-2026/milk-cookies.png', '{christmas,food,sweet}'::text[], 'evening', 1024, 860),
  ('christmas-2026', 21, 'Wreath', 'stickers/christmas-2026/wreath.png', '{christmas,decor,home}'::text[], null, 890, 1024),
  ('christmas-2026', 22, 'Family feast', 'stickers/christmas-2026/noche-buena-table.png', '{christmas,filipino,family,food}'::text[], 'whoamiwith', 1024, 818),
  ('christmas-2026', 23, 'Poinsettia', 'stickers/christmas-2026/poinsettia.png', '{christmas,flower,decor}'::text[], null, 972, 1024),
  ('christmas-2026', 24, 'Christmas lights', 'stickers/christmas-2026/string-lights.png', '{christmas,decor,lights}'::text[], 'evening', 1024, 334),
  ('christmas-2026', 25, 'Leche flan', 'stickers/christmas-2026/leche-flan.png', '{christmas,filipino,food,sweet}'::text[], null, 1024, 722),
  ('christmas-2026', 26, 'Gift morning', 'stickers/christmas-2026/gift-opening.png', '{christmas,gift,family}'::text[], 'morning', 989, 1024),
  ('christmas-2026', 27, 'Snow globe', 'stickers/christmas-2026/snow-globe.png', '{christmas,winter,decor}'::text[], null, 783, 1024),
  ('christmas-2026', 28, 'Jingle bells', 'stickers/christmas-2026/jingle-bells.png', '{christmas,music}'::text[], null, 1024, 870),
  ('christmas-2026', 29, 'Skating penguin', 'stickers/christmas-2026/skating-penguin.png', '{christmas,winter,animal}'::text[], null, 875, 1024),
  ('christmas-2026', 30, 'Balikbayan box', 'stickers/christmas-2026/balikbayan-box.png', '{christmas,filipino,family,gift}'::text[], null, 1024, 1013)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
