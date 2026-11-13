-- 0032 — Fewer word stickers, more picture stickers (T-506, #270; FR-STK-02, FR-STK-04). Additive only: one new
-- column, new rows, and updates to existing rows; nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 12: "reduce the text stickers, add more variants like animals, fruits, and other cute ones."
-- About half the word stickers in each themed pack are retired and 64 picture stickers (animals, fruits, food and
-- things, each in its pack's theme) take their place. Stamps and Milestones are unchanged. Prices, tiers and which
-- packs are free stay as they are.
--
--   Everyday       15 words → 7 words + 10 pictures      The Eight   24 → 8 words + 16 pictures (3 per slot)
--   Christmas      12 → 6 + 6                            Pinoy Life  18 → 9 + 8
--   Barkada        16 → 8 + 9                            Work From Wherever 16 → 8 + 8
--   Pet Parent     14 → 7 + 7
--
-- retired_at: the sticker is no longer offered (the Stickers tool, the shop, Pack preview and My stickers leave it
-- out), but its row, id and art stay, so moments that already use it still draw it in the app and on the web page
-- (public_sticker_catalog() keeps returning it; viewing is never gated, FR-STK-04). sticker_usable() is unchanged,
-- so re-saving an old moment with a retired sticker still works. New pictures sort before the word stickers that
-- stay, so pack cards and the "For #slot" row lead with them.
--
-- Art: generated in the Pickld sticker style (flat, rounded, dark outline, white die-cut border, soft shadow) and
-- bundled under assets/stickers/<pack>/; upload it with `cd workers/photos && deno task stickers` as before.

alter table public.stickers add column retired_at timestamptz;

comment on column public.stickers.retired_at is
  'When the sticker stopped being offered. Retired stickers stay in the catalog so moments that use them still draw them.';

-- ---------------------------------------------------------------- retire about half the word stickers
update public.stickers set retired_at = '2026-11-13 00:00+08' where asset_path in (
  'stickers/everyday/kain-tayo.png',
  'stickers/everyday/ulam-check.png',
  'stickers/everyday/lunch-break.png',
  'stickers/everyday/merienda-time.png',
  'stickers/everyday/tulog-muna.png',
  'stickers/everyday/rest-day.png',
  'stickers/everyday/petsa-de-peligro.png',
  'stickers/everyday/same-old.png',
  'stickers/the-eight/traffic-again.png',
  'stickers/the-eight/new-place.png',
  'stickers/the-eight/side-hustle.png',
  'stickers/the-eight/aral-muna.png',
  'stickers/the-eight/family-time.png',
  'stickers/the-eight/just-me.png',
  'stickers/the-eight/pambahay.png',
  'stickers/the-eight/gym-fit.png',
  'stickers/the-eight/hi-its-me.png',
  'stickers/the-eight/haggard-pero-happy.png',
  'stickers/the-eight/bangon-na.png',
  'stickers/the-eight/early-bird.png',
  'stickers/the-eight/afternoon-slump.png',
  'stickers/the-eight/halfway-there.png',
  'stickers/the-eight/night-owl.png',
  'stickers/the-eight/pahinga.png',
  'stickers/christmas-2026/parol.png',
  'stickers/christmas-2026/bibingka.png',
  'stickers/christmas-2026/puto-bumbong.png',
  'stickers/christmas-2026/hamon.png',
  'stickers/christmas-2026/monito-monita.png',
  'stickers/christmas-2026/exchange-gift.png',
  'stickers/pinoy-life/grabe-siya.png',
  'stickers/pinoy-life/uwi-na.png',
  'stickers/pinoy-life/jeepney-ride.png',
  'stickers/pinoy-life/ingat.png',
  'stickers/pinoy-life/lodi.png',
  'stickers/pinoy-life/petmalu.png',
  'stickers/pinoy-life/balikbayan-box.png',
  'stickers/pinoy-life/tipid-mode.png',
  'stickers/pinoy-life/baha-na-naman.png',
  'stickers/barkada/tropa.png',
  'stickers/barkada/sino-sasama.png',
  'stickers/barkada/kanto-vibes.png',
  'stickers/barkada/videoke-night.png',
  'stickers/barkada/ambagan.png',
  'stickers/barkada/road-trip.png',
  'stickers/barkada/selfie-muna.png',
  'stickers/barkada/solid.png',
  'stickers/work-from-wherever/brb.png',
  'stickers/work-from-wherever/standup.png',
  'stickers/work-from-wherever/coffee-chat.png',
  'stickers/work-from-wherever/desk-lunch.png',
  'stickers/work-from-wherever/laptop-life.png',
  'stickers/work-from-wherever/overtime.png',
  'stickers/work-from-wherever/hybrid-day.png',
  'stickers/work-from-wherever/done-for-today.png',
  'stickers/pet-parent/walkies.png',
  'stickers/pet-parent/nap-buddy.png',
  'stickers/pet-parent/treat-time.png',
  'stickers/pet-parent/muning.png',
  'stickers/pet-parent/bantay.png',
  'stickers/pet-parent/vet-day.png',
  'stickers/pet-parent/paw-some.png'
);

-- The word stickers that stay come after the new pictures, in their old order.
update public.stickers s set sort = s.sort + 100
from public.sticker_packs p
where p.id = s.pack_id and p.slug in ('everyday', 'the-eight', 'christmas-2026', 'pinoy-life', 'barkada', 'work-from-wherever', 'pet-parent') and s.retired_at is null;

-- ---------------------------------------------------------------- new picture stickers
insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort
from (values
  ('everyday', 1 , 'Kitty'             , 'stickers/everyday/cat.png'                         , '{cat,pets,cute,animal}'::text[], null),
  ('everyday', 2 , 'Puppy'             , 'stickers/everyday/dog.png'                         , '{dog,pets,cute,animal}'::text[], null),
  ('everyday', 3 , 'Bunny'             , 'stickers/everyday/bunny.png'                       , '{bunny,cute,animal}'::text[], null),
  ('everyday', 4 , 'Sisiw'             , 'stickers/everyday/chick.png'                       , '{chick,sisiw,cute,animal,filipino}'::text[], 'morning'),
  ('everyday', 5 , 'Hello frog'        , 'stickers/everyday/frog.png'                        , '{frog,hello,cute,animal}'::text[], null),
  ('everyday', 6 , 'Strawberry'        , 'stickers/everyday/strawberry.png'                  , '{fruit,strawberry,food,cute}'::text[], null),
  ('everyday', 7 , 'Mangga'            , 'stickers/everyday/mango.png'                       , '{fruit,mango,mangga,food,filipino}'::text[], 'afternoon'),
  ('everyday', 8 , 'Pakwan'            , 'stickers/everyday/watermelon.png'                  , '{fruit,watermelon,pakwan,food,summer}'::text[], 'afternoon'),
  ('everyday', 9 , 'Avocado'           , 'stickers/everyday/avocado.png'                     , '{fruit,avocado,food,cute}'::text[], null),
  ('everyday', 10, 'Heart'             , 'stickers/everyday/heart.png'                       , '{love,heart,cute,popular}'::text[], null),
  ('the-eight', 1 , 'Pin drop'          , 'stickers/the-eight/map-pin.png'                    , '{place,travel,location}'::text[], 'whereami'),
  ('the-eight', 2 , 'Home sweet home'   , 'stickers/the-eight/cozy-house.png'                 , '{home,bahay,family}'::text[], 'whereami'),
  ('the-eight', 3 , 'Laptop'            , 'stickers/the-eight/happy-laptop.png'               , '{work,laptop,side_hustle}'::text[], 'mebusywith'),
  ('the-eight', 4 , 'Books'             , 'stickers/the-eight/book-stack.png'                 , '{school,study,books}'::text[], 'mebusywith'),
  ('the-eight', 5 , 'Cuddle buddies'    , 'stickers/the-eight/cat-cuddle.png'                 , '{friends,partner,family,cat}'::text[], 'whoamiwith'),
  ('the-eight', 6 , 'Chick squad'       , 'stickers/the-eight/chick-trio.png'                 , '{barkada,friends,family,chick}'::text[], 'whoamiwith'),
  ('the-eight', 7 , 'Sneaker'           , 'stickers/the-eight/sneaker.png'                    , '{outfit,shoes,gym,ootd}'::text[], 'ootd'),
  ('the-eight', 8 , 'Shades'            , 'stickers/the-eight/sunglasses.png'                 , '{outfit,sunglasses,summer,ootd}'::text[], 'ootd'),
  ('the-eight', 9 , 'Say cheese'        , 'stickers/the-eight/camera.png'                     , '{selfie,camera,photo}'::text[], 'selfie'),
  ('the-eight', 10, 'Peace bear'        , 'stickers/the-eight/bear-peace.png'                 , '{selfie,peace,bear,animal}'::text[], 'selfie'),
  ('the-eight', 11, 'Sunrise'           , 'stickers/the-eight/sunrise.png'                    , '{morning,sun,early}'::text[], 'morning'),
  ('the-eight', 12, 'Egg toast'         , 'stickers/the-eight/egg-toast.png'                  , '{morning,breakfast,food}'::text[], 'morning'),
  ('the-eight', 13, 'Milk tea'          , 'stickers/the-eight/milk-tea.png'                   , '{afternoon,drink,milk_tea,merienda}'::text[], 'afternoon'),
  ('the-eight', 14, 'Sleepy sloth'      , 'stickers/the-eight/sleepy-sloth.png'               , '{afternoon,nap,sloth,animal}'::text[], 'afternoon'),
  ('the-eight', 15, 'Sleepy moon'       , 'stickers/the-eight/sleepy-moon.png'                , '{evening,night,sleep}'::text[], 'evening'),
  ('the-eight', 16, 'Owl'               , 'stickers/the-eight/owl.png'                        , '{evening,night,owl,animal}'::text[], 'evening'),
  ('christmas-2026', 1 , 'Parol'             , 'stickers/christmas-2026/parol-lantern.png'         , '{christmas,parol,lights}'::text[], 'whereami'),
  ('christmas-2026', 2 , 'Bibingka'          , 'stickers/christmas-2026/bibingka-cake.png'         , '{christmas,food,merienda}'::text[], 'morning'),
  ('christmas-2026', 3 , 'Puto bumbong'      , 'stickers/christmas-2026/puto-bumbong-plate.png'    , '{christmas,food,merienda}'::text[], 'morning'),
  ('christmas-2026', 4 , 'Hamon'             , 'stickers/christmas-2026/hamon-ham.png'             , '{christmas,food,family,noche_buena}'::text[], 'evening'),
  ('christmas-2026', 5 , 'Regalo'            , 'stickers/christmas-2026/gift-box.png'              , '{christmas,gift,regalo,family}'::text[], null),
  ('christmas-2026', 6 , 'Santa cat'         , 'stickers/christmas-2026/santa-cat.png'             , '{christmas,cat,pets,cute}'::text[], null),
  ('pinoy-life', 1 , 'Jeepney'           , 'stickers/pinoy-life/jeepney.png'                   , '{commute,jeepney,filipino}'::text[], 'whereami'),
  ('pinoy-life', 2 , 'Halo-halo'         , 'stickers/pinoy-life/halo-halo.png'                 , '{food,merienda,summer,filipino}'::text[], 'afternoon'),
  ('pinoy-life', 3 , 'Balikbayan box'    , 'stickers/pinoy-life/balikbayan.png'                , '{family,ofw,filipino}'::text[], null),
  ('pinoy-life', 4 , 'Kalabaw'           , 'stickers/pinoy-life/carabao.png'                   , '{carabao,kalabaw,animal,filipino}'::text[], null),
  ('pinoy-life', 5 , 'Tricycle'          , 'stickers/pinoy-life/tricycle.png'                  , '{commute,tricycle,filipino}'::text[], 'whereami'),
  ('pinoy-life', 6 , 'Tag-ulan'          , 'stickers/pinoy-life/rainy-umbrella.png'            , '{weather,rain,filipino}'::text[], null),
  ('pinoy-life', 7 , 'Electric fan'      , 'stickers/pinoy-life/electric-fan.png'              , '{weather,hot,home,filipino}'::text[], 'afternoon'),
  ('pinoy-life', 8 , 'Adobo'             , 'stickers/pinoy-life/adobo-rice.png'                , '{food,ulam,family,filipino}'::text[], 'evening'),
  ('barkada', 1 , 'Ambagan'           , 'stickers/barkada/piggy-bank.png'                   , '{barkada,money,ambagan}'::text[], null),
  ('barkada', 2 , 'Videoke'           , 'stickers/barkada/videoke-mic.png'                  , '{barkada,videoke,night}'::text[], 'evening'),
  ('barkada', 3 , 'Cheers'            , 'stickers/barkada/cheers.png'                       , '{barkada,night,inuman}'::text[], 'evening'),
  ('barkada', 4 , 'Penguin squad'     , 'stickers/barkada/penguin-trio.png'                 , '{barkada,friends,squad,animal}'::text[], 'whoamiwith'),
  ('barkada', 5 , 'Road trip'         , 'stickers/barkada/road-trip-car.png'                , '{barkada,travel,car}'::text[], 'whereami'),
  ('barkada', 6 , 'Pizza night'       , 'stickers/barkada/pizza.png'                        , '{barkada,food,pizza}'::text[], null),
  ('barkada', 7 , 'Group chat'        , 'stickers/barkada/chat-bubbles.png'                 , '{barkada,talk,chat}'::text[], null),
  ('barkada', 8 , 'Apir'              , 'stickers/barkada/high-five.png'                    , '{barkada,friends,apir}'::text[], 'whoamiwith'),
  ('barkada', 9 , 'Photo booth'       , 'stickers/barkada/photo-strip.png'                  , '{barkada,selfie,photo}'::text[], 'selfie'),
  ('work-from-wherever', 1 , 'Cat on keyboard'   , 'stickers/work-from-wherever/cat-on-laptop.png'     , '{work,cat,pets,funny}'::text[], 'mebusywith'),
  ('work-from-wherever', 2 , 'Coffee'            , 'stickers/work-from-wherever/coffee-mug.png'        , '{work,coffee,morning}'::text[], 'morning'),
  ('work-from-wherever', 3 , 'Headphones on'     , 'stickers/work-from-wherever/headphones.png'        , '{work,focus,music}'::text[], 'mebusywith'),
  ('work-from-wherever', 4 , 'Desk plant'        , 'stickers/work-from-wherever/desk-plant.png'        , '{work,plant,office}'::text[], 'whereami'),
  ('work-from-wherever', 5 , 'Baon'              , 'stickers/work-from-wherever/bento-box.png'         , '{work,food,lunch,baon}'::text[], 'afternoon'),
  ('work-from-wherever', 6 , 'Calendar'          , 'stickers/work-from-wherever/calendar.png'          , '{work,meeting,plans}'::text[], null),
  ('work-from-wherever', 7 , 'Late shift'        , 'stickers/work-from-wherever/night-owl.png'         , '{work,night,overtime}'::text[], 'evening'),
  ('work-from-wherever', 8 , 'Sticky notes'      , 'stickers/work-from-wherever/sticky-notes.png'      , '{work,school,notes}'::text[], 'mebusywith'),
  ('pet-parent', 1 , 'Walkies'           , 'stickers/pet-parent/walkies-dog.png'               , '{pets,dog,walk}'::text[], 'morning'),
  ('pet-parent', 2 , 'Nap buddy'         , 'stickers/pet-parent/nap-cat.png'                   , '{pets,cat,rest}'::text[], 'afternoon'),
  ('pet-parent', 3 , 'Treat time'        , 'stickers/pet-parent/bone.png'                      , '{pets,dog,food}'::text[], null),
  ('pet-parent', 4 , 'Muning'            , 'stickers/pet-parent/muning-cat.png'                , '{pets,cat,filipino}'::text[], null),
  ('pet-parent', 5 , 'Bantay'            , 'stickers/pet-parent/bantay-dog.png'                , '{pets,dog,filipino}'::text[], null),
  ('pet-parent', 6 , 'Vet day'           , 'stickers/pet-parent/vet-day-pup.png'               , '{pets,vet,dog}'::text[], 'whereami'),
  ('pet-parent', 7 , 'Paw-some'          , 'stickers/pet-parent/paw-print.png'                 , '{pets,paw,love}'::text[], null)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint)
join public.sticker_packs p on p.slug = v.pack_slug;
