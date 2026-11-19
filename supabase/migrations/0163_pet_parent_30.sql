-- 0163 — Pet Parent (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/pet-parent/pet-tax.png',
  'stickers/pet-parent/fur-baby.png',
  'stickers/pet-parent/good-boy.png',
  'stickers/pet-parent/good-girl.png',
  'stickers/pet-parent/zoomies.png',
  'stickers/pet-parent/fur-mom.png',
  'stickers/pet-parent/fur-dad.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('pet-parent', 8, 'Bath time', 'stickers/pet-parent/bath-time.png', '{pets,dog,bath}'::text[], 'mebusywith', 1002, 1024),
  ('pet-parent', 9, 'If it fits', 'stickers/pet-parent/box-cat.png', '{pets,cat,funny}'::text[], null, 1024, 952),
  ('pet-parent', 10, 'Feed me', 'stickers/pet-parent/dinner-bowl.png', '{pets,dog,food}'::text[], 'evening', 952, 1024),
  ('pet-parent', 11, 'Yarn chaos', 'stickers/pet-parent/yarn-kitten.png', '{pets,cat,play}'::text[], null, 1024, 895),
  ('pet-parent', 12, 'Car ride', 'stickers/pet-parent/car-ride.png', '{pets,dog,travel}'::text[], 'whereami', 1024, 788),
  ('pet-parent', 13, 'Keyboard cat', 'stickers/pet-parent/keyboard-cat.png', '{pets,cat,work,funny}'::text[], 'mebusywith', 984, 1024),
  ('pet-parent', 14, 'Cozy corgi', 'stickers/pet-parent/sweater-corgi.png', '{pets,dog,ootd}'::text[], 'ootd', 946, 1024),
  ('pet-parent', 15, 'Snack cheeks', 'stickers/pet-parent/hamster.png', '{pets,hamster,food}'::text[], null, 1024, 931),
  ('pet-parent', 16, 'Who did this', 'stickers/pet-parent/slipper-crime.png', '{pets,dog,funny}'::text[], null, 1024, 773),
  ('pet-parent', 17, 'Window watch', 'stickers/pet-parent/window-cat.png', '{pets,cat,home}'::text[], 'morning', 924, 1024),
  ('pet-parent', 18, 'Fetch', 'stickers/pet-parent/fetch.png', '{pets,dog,play}'::text[], 'afternoon', 1024, 692),
  ('pet-parent', 19, 'Goldfish', 'stickers/pet-parent/goldfish.png', '{pets,fish}'::text[], null, 1024, 955),
  ('pet-parent', 20, 'Bunny snack', 'stickers/pet-parent/bunny.png', '{pets,rabbit,food}'::text[], null, 1024, 1007),
  ('pet-parent', 21, 'Cuddle pile', 'stickers/pet-parent/cuddle-pile.png', '{pets,dog,cat,sleep}'::text[], 'whoamiwith', 1024, 906),
  ('pet-parent', 22, 'Oops', 'stickers/pet-parent/glass-push.png', '{pets,cat,funny}'::text[], null, 1024, 855),
  ('pet-parent', 23, 'Little singer', 'stickers/pet-parent/budgie.png', '{pets,bird}'::text[], null, 874, 1024),
  ('pet-parent', 24, 'Muddy paws', 'stickers/pet-parent/muddy-pup.png', '{pets,dog,funny}'::text[], 'afternoon', 1024, 837),
  ('pet-parent', 25, 'Scratch time', 'stickers/pet-parent/scratch-post.png', '{pets,cat,play}'::text[], null, 930, 1024),
  ('pet-parent', 26, 'Leash', 'stickers/pet-parent/leash.png', '{pets,dog,walk}'::text[], null, 1024, 752),
  ('pet-parent', 27, 'Fresh cut', 'stickers/pet-parent/groomed-pup.png', '{pets,dog,ootd}'::text[], 'ootd', 869, 1024),
  ('pet-parent', 28, 'Slow day', 'stickers/pet-parent/turtle.png', '{pets,turtle}'::text[], null, 1024, 600),
  ('pet-parent', 29, 'Pet birthday', 'stickers/pet-parent/pet-birthday.png', '{pets,dog,birthday}'::text[], null, 1024, 1000),
  ('pet-parent', 30, 'Fresh laundry', 'stickers/pet-parent/laundry-cat.png', '{pets,cat,home,funny}'::text[], null, 972, 1024)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
