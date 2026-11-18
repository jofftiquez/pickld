-- 0166 — New Year (FR-STK-02, FR-STK-06). Additive only: a new premium pack and its
-- 30 drawings. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; new packs: Birthdays, New Year, Valentines.
-- Tier is premium until the owner decides otherwise.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

insert into public.sticker_packs (slug, name, tier, store_product_id, sort, description) values
  ('new-year', 'New Year', 'premium', 'me.pickld.pack.new_year', 30, 'Countdowns, round fruits and the first sunrise. For the night the year turns over and the people beside you.');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('new-year', 1, 'Fireworks', 'stickers/new-year/fireworks.png', '{newyear,fireworks,celebrate}'::text[], 'evening', 1024, 1019),
  ('new-year', 2, 'Midnight', 'stickers/new-year/midnight-clock.png', '{newyear,countdown}'::text[], 'evening', 1024, 954),
  ('new-year', 3, 'Round fruits', 'stickers/new-year/round-fruits.png', '{newyear,filipino,food,luck}'::text[], null, 1024, 850),
  ('new-year', 4, 'Jump for luck', 'stickers/new-year/jump-for-luck.png', '{newyear,filipino,luck}'::text[], null, 738, 1024),
  ('new-year', 5, 'Sparkler', 'stickers/new-year/sparkler.png', '{newyear,fireworks}'::text[], 'evening', 695, 1024),
  ('new-year', 6, 'Midnight toast', 'stickers/new-year/midnight-toast.png', '{newyear,drink,celebrate}'::text[], 'evening', 931, 1024),
  ('new-year', 7, 'Resolutions', 'stickers/new-year/resolutions.png', '{newyear,goals}'::text[], null, 920, 1024),
  ('new-year', 8, 'Red lantern', 'stickers/new-year/red-lantern.png', '{newyear,lunar,luck}'::text[], null, 756, 1024),
  ('new-year', 9, 'Torotot', 'stickers/new-year/torotot.png', '{newyear,filipino,noise}'::text[], 'evening', 1024, 530),
  ('new-year', 10, 'Red envelope', 'stickers/new-year/red-envelope.png', '{newyear,lunar,luck}'::text[], null, 656, 1024),
  ('new-year', 11, 'Lucky coins', 'stickers/new-year/lucky-coins.png', '{newyear,luck,prosperity}'::text[], null, 890, 1024),
  ('new-year', 12, 'Biko', 'stickers/new-year/biko.png', '{newyear,filipino,food}'::text[], null, 1024, 772),
  ('new-year', 13, 'Disco ball', 'stickers/new-year/disco-ball.png', '{newyear,party,dance}'::text[], 'evening', 1021, 1024),
  ('new-year', 14, 'Slow morning', 'stickers/new-year/slow-morning.png', '{newyear,cozy,coffee}'::text[], 'morning', 1024, 925),
  ('new-year', 15, 'First sunrise', 'stickers/new-year/first-sunrise.png', '{newyear,hope,morning}'::text[], 'morning', 1024, 666),
  ('new-year', 16, 'Party top hat', 'stickers/new-year/party-top-hat.png', '{newyear,ootd,party}'::text[], 'ootd', 1024, 1002),
  ('new-year', 17, 'Media Noche', 'stickers/new-year/media-noche.png', '{newyear,filipino,family,food}'::text[], 'whoamiwith', 1024, 867),
  ('new-year', 18, 'Midnight kiss', 'stickers/new-year/midnight-kiss.png', '{newyear,love,couple}'::text[], 'whoamiwith', 1002, 1024),
  ('new-year', 19, 'Fresh start', 'stickers/new-year/fresh-start.png', '{newyear,hope,calendar}'::text[], null, 1024, 928),
  ('new-year', 20, 'Firecrackers', 'stickers/new-year/firecrackers.png', '{newyear,lunar,noise}'::text[], null, 1015, 1024),
  ('new-year', 21, 'Wish jar', 'stickers/new-year/wish-jar.png', '{newyear,wish,hope}'::text[], null, 881, 1024),
  ('new-year', 22, 'Party pup', 'stickers/new-year/party-pup.png', '{newyear,dog,fireworks}'::text[], null, 1014, 1024),
  ('new-year', 23, 'New Year''s Eve', 'stickers/new-year/moon-and-star.png', '{newyear,night,sky}'::text[], 'evening', 1024, 777),
  ('new-year', 24, 'Tikoy', 'stickers/new-year/tikoy.png', '{newyear,lunar,filipino,food}'::text[], null, 1024, 741),
  ('new-year', 25, 'Countdown', 'stickers/new-year/countdown.png', '{newyear,countdown,celebrate}'::text[], 'evening', 768, 1024),
  ('new-year', 26, 'New routine', 'stickers/new-year/new-routine.png', '{newyear,goals,fitness}'::text[], 'morning', 1024, 937),
  ('new-year', 27, 'Polka dots', 'stickers/new-year/polka-dots.png', '{newyear,filipino,luck,ootd}'::text[], 'ootd', 749, 1024),
  ('new-year', 28, 'Confetti', 'stickers/new-year/confetti-cannon.png', '{newyear,party,celebrate}'::text[], null, 947, 1024),
  ('new-year', 29, 'Long life noodles', 'stickers/new-year/long-noodles.png', '{newyear,lunar,food}'::text[], null, 1011, 1024),
  ('new-year', 30, 'NYE squad', 'stickers/new-year/nye-selfie.png', '{newyear,friends,party}'::text[], 'whoamiwith', 1024, 919)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
