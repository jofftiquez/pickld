-- 0165 — Birthdays (FR-STK-02, FR-STK-06). Additive only: a new premium pack and its
-- 30 drawings. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; new packs: Birthdays, New Year, Valentines.
-- Tier is premium until the owner decides otherwise.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

insert into public.sticker_packs (slug, name, tier, store_product_id, sort, description) values
  ('birthdays', 'Birthdays', 'premium', 'me.pickld.pack.birthdays', 29, 'Cake, candles and the people who showed up. For your day and everyone else''s.');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('birthdays', 1, 'Birthday cake', 'stickers/birthdays/birthday-cake.png', '{birthday,cake,party}'::text[], null, 817, 1024),
  ('birthdays', 2, 'Balloons', 'stickers/birthdays/balloons.png', '{birthday,party}'::text[], null, 941, 1024),
  ('birthdays', 3, 'Party hat', 'stickers/birthdays/party-hat.png', '{birthday,party,ootd}'::text[], null, 869, 1024),
  ('birthdays', 4, 'Party popper', 'stickers/birthdays/party-popper.png', '{birthday,party,celebrate}'::text[], null, 951, 1024),
  ('birthdays', 5, 'Make a wish', 'stickers/birthdays/make-a-wish.png', '{birthday,wish,cake}'::text[], null, 963, 1024),
  ('birthdays', 6, 'Gifts', 'stickers/birthdays/gift-stack.png', '{birthday,gift}'::text[], null, 653, 1024),
  ('birthdays', 7, 'Cake slice', 'stickers/birthdays/cake-slice.png', '{birthday,cake,food}'::text[], null, 875, 1024),
  ('birthdays', 8, 'Bunting', 'stickers/birthdays/bunting.png', '{birthday,party,decor}'::text[], null, 1024, 363),
  ('birthdays', 9, 'Blow the candles', 'stickers/birthdays/blow-candles.png', '{birthday,cake,wish}'::text[], null, 1024, 997),
  ('birthdays', 10, 'Birthday cupcake', 'stickers/birthdays/cupcake.png', '{birthday,sweet,food}'::text[], null, 727, 1024),
  ('birthdays', 11, 'Birthday crown', 'stickers/birthdays/crown.png', '{birthday,ootd,celebrate}'::text[], 'ootd', 1024, 758),
  ('birthdays', 12, 'Piñata', 'stickers/birthdays/pinata.png', '{birthday,party,kids}'::text[], null, 967, 1024),
  ('birthdays', 13, 'Pancit', 'stickers/birthdays/pancit.png', '{birthday,filipino,food}'::text[], null, 1024, 703),
  ('birthdays', 14, 'Birthday card', 'stickers/birthdays/birthday-card.png', '{birthday,love,greeting}'::text[], null, 845, 1024),
  ('birthdays', 15, 'Gift bear', 'stickers/birthdays/gift-bear.png', '{birthday,gift,cute}'::text[], null, 741, 1024),
  ('birthdays', 16, 'Party blower', 'stickers/birthdays/party-blower.png', '{birthday,party,music}'::text[], null, 1024, 657),
  ('birthdays', 17, 'Party animals', 'stickers/birthdays/party-animals.png', '{birthday,friends,party}'::text[], 'whoamiwith', 1024, 917),
  ('birthdays', 18, 'Party spaghetti', 'stickers/birthdays/spaghetti.png', '{birthday,filipino,food}'::text[], null, 1024, 883),
  ('birthdays', 19, 'Gold balloon', 'stickers/birthdays/heart-balloon.png', '{birthday,love,party}'::text[], null, 860, 1024),
  ('birthdays', 20, 'Surprise!', 'stickers/birthdays/surprise-cat.png', '{birthday,gift,cat}'::text[], null, 907, 1024),
  ('birthdays', 21, 'Birthday scoop', 'stickers/birthdays/ice-cream.png', '{birthday,sweet,food}'::text[], 'afternoon', 620, 1024),
  ('birthdays', 22, 'Birthday snap', 'stickers/birthdays/birthday-photo.png', '{birthday,memory,photo}'::text[], null, 985, 1024),
  ('birthdays', 23, 'Lola''s cake', 'stickers/birthdays/lola-cake.png', '{birthday,family,filipino}'::text[], 'whoamiwith', 931, 1024),
  ('birthdays', 24, 'Cheers', 'stickers/birthdays/cheers.png', '{birthday,drink,celebrate}'::text[], 'evening', 1024, 875),
  ('birthdays', 25, 'Birthday star', 'stickers/birthdays/birthday-sash.png', '{birthday,ootd,celebrate}'::text[], 'ootd', 674, 1024),
  ('birthdays', 26, 'Loot bag', 'stickers/birthdays/loot-bag.png', '{birthday,kids,gift}'::text[], null, 716, 1024),
  ('birthdays', 27, 'Sparkler cake', 'stickers/birthdays/sparkler-cake.png', '{birthday,cake,celebrate}'::text[], 'evening', 597, 1024),
  ('birthdays', 28, 'The big day', 'stickers/birthdays/big-day.png', '{birthday,calendar}'::text[], null, 965, 1024),
  ('birthdays', 29, 'Birthday karaoke', 'stickers/birthdays/karaoke.png', '{birthday,filipino,music}'::text[], 'evening', 1024, 999),
  ('birthdays', 30, 'First birthday', 'stickers/birthdays/first-birthday.png', '{birthday,baby,family}'::text[], null, 848, 1024)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
