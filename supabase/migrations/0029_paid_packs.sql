-- 0029 — Paid sticker packs for the shop (FR-STK-06, FR-STK-07; M6-02). Additive only: one new column, new rows.
--
-- The shop (design: StickerShop) sells four premium packs and one seasonal pack. Like the launch packs (0012),
-- their rows ship in a migration so every environment gets the same catalog and the app reads it from the
-- server; sticker ids derive from the asset path. Each pack's store_product_id is the App Store / Play product
-- a purchase unlocks through fn:revenuecat-webhook (0028, D-40). Prices come from the store, never from here.
--
--   Christmas pack       seasonal  12   sold Sep 1 – Dec 31, 2026 (Manila); buyers keep it after the season
--   Pinoy Life           premium   18
--   Barkada              premium   16
--   Work From Wherever   premium   16
--   Pet Parent           premium   14
--
-- description: the line under a pack's name in Pack preview. Tags on the stickers use the onboarding answer
-- keys (barkada, work, pets, …), so the shop's "For you" row and the editor's suggestions can match them.
-- Art: rendered by scripts/render-stickers.mjs into assets/stickers/<slug>/ and uploaded like the launch art.

alter table public.sticker_packs add column description text check (char_length(description) <= 200);

insert into public.sticker_packs (slug, name, tier, store_product_id, sort, description, available_from, available_to) values
  ('christmas-2026', 'Christmas pack', 'seasonal', 'me.pickld.pack.christmas_2026', 10, 'Simbang Gabi, Noche Buena, aguinaldo. For the longest Christmas season in the world.', '2026-09-01 00:00+08', '2027-01-01 00:00+08'),
  ('pinoy-life', 'Pinoy Life', 'premium', 'me.pickld.pack.pinoy_life', 11, 'Traffic, ulam, sweldo and everything in between. For the days that are very, very Pinoy.', null, null),
  ('barkada', 'Barkada', 'premium', 'me.pickld.pack.barkada', 12, 'Libre mo? For the group chat that never sleeps and the friends who always show up.', null, null),
  ('work-from-wherever', 'Work From Wherever', 'premium', 'me.pickld.pack.work_from_wherever', 13, 'Camera off, coffee on. For meetings that could have been an email and the desk you carry everywhere.', null, null),
  ('pet-parent', 'Pet Parent', 'premium', 'me.pickld.pack.pet_parent', 14, 'Pet tax paid. For fur babies, zoomies and the nap buddy who owns the bed.', null, null);

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort
from (values
  ('christmas-2026', 1 , 'Simbang Gabi',        'stickers/christmas-2026/simbang-gabi.png',          '{christmas,simbang_gabi,church,family}'::text[], 'morning'),
  ('christmas-2026', 2 , 'Noche Buena',         'stickers/christmas-2026/noche-buena.png',           '{christmas,food,family,noche_buena}'::text[], 'evening'),
  ('christmas-2026', 3 , 'Aguinaldo',           'stickers/christmas-2026/aguinaldo.png',             '{christmas,gift,ninang,family}'::text[], null),
  ('christmas-2026', 4 , 'Parol',               'stickers/christmas-2026/parol.png',                 '{christmas,parol,lights}'::text[], 'whereami'),
  ('christmas-2026', 5 , 'Puto bumbong',        'stickers/christmas-2026/puto-bumbong.png',          '{christmas,food,merienda}'::text[], 'morning'),
  ('christmas-2026', 6 , 'Bibingka',            'stickers/christmas-2026/bibingka.png',              '{christmas,food,merienda}'::text[], 'morning'),
  ('christmas-2026', 7 , 'Monito monita',       'stickers/christmas-2026/monito-monita.png',         '{christmas,barkada,coworkers,gift}'::text[], 'whoamiwith'),
  ('christmas-2026', 8 , 'Exchange gift',       'stickers/christmas-2026/exchange-gift.png',         '{christmas,barkada,coworkers,gift}'::text[], 'whoamiwith'),
  ('christmas-2026', 9 , 'Christmas party',     'stickers/christmas-2026/christmas-party.png',       '{christmas,party,coworkers,barkada}'::text[], 'evening'),
  ('christmas-2026', 10, 'Hamon',               'stickers/christmas-2026/hamon.png',                 '{christmas,food,family}'::text[], 'evening'),
  ('christmas-2026', 11, 'Maligayang Pasko',    'stickers/christmas-2026/maligayang-pasko.png',      '{christmas,pasko,greeting}'::text[], null),
  ('christmas-2026', 12, 'Ninang duties',       'stickers/christmas-2026/ninang-duties.png',         '{christmas,family,ninang,gift}'::text[], 'whoamiwith'),
  ('pinoy-life', 1 , 'Traffic na naman',    'stickers/pinoy-life/traffic-na-naman.png',          '{traffic,commute,work,filipino}'::text[], 'whereami'),
  ('pinoy-life', 2 , 'Sweldo day',          'stickers/pinoy-life/sweldo-day.png',                '{sweldo,payday,work,filipino}'::text[], null),
  ('pinoy-life', 3 , 'Bahala na',           'stickers/pinoy-life/bahala-na.png',                 '{filipino,words}'::text[], null),
  ('pinoy-life', 4 , 'Charot',              'stickers/pinoy-life/charot.png',                    '{filipino,words,funny}'::text[], null),
  ('pinoy-life', 5 , 'Kain na',             'stickers/pinoy-life/kain-na.png',                   '{food,family,filipino}'::text[], 'evening'),
  ('pinoy-life', 6 , 'Grabe siya',          'stickers/pinoy-life/grabe-siya.png',                '{filipino,words,funny}'::text[], null),
  ('pinoy-life', 7 , 'Pa-picture',          'stickers/pinoy-life/pa-picture.png',                '{selfie,filipino,barkada}'::text[], 'selfie'),
  ('pinoy-life', 8 , 'Uwi na',              'stickers/pinoy-life/uwi-na.png',                    '{home,commute,work}'::text[], 'evening'),
  ('pinoy-life', 9 , 'Jeepney ride',        'stickers/pinoy-life/jeepney-ride.png',              '{commute,jeepney,filipino}'::text[], 'whereami'),
  ('pinoy-life', 10, 'Tara na',             'stickers/pinoy-life/tara-na.png',                   '{barkada,filipino,words}'::text[], null),
  ('pinoy-life', 11, 'Ingat',               'stickers/pinoy-life/ingat.png',                     '{filipino,words,family}'::text[], null),
  ('pinoy-life', 12, 'Lodi',                'stickers/pinoy-life/lodi.png',                      '{filipino,words,barkada}'::text[], null),
  ('pinoy-life', 13, 'Petmalu',             'stickers/pinoy-life/petmalu.png',                   '{filipino,words}'::text[], null),
  ('pinoy-life', 14, 'Pasalubong',          'stickers/pinoy-life/pasalubong.png',                '{family,gift,filipino}'::text[], 'whoamiwith'),
  ('pinoy-life', 15, 'Balikbayan box',      'stickers/pinoy-life/balikbayan-box.png',            '{family,ofw,filipino}'::text[], null),
  ('pinoy-life', 16, 'Tipid mode',          'stickers/pinoy-life/tipid-mode.png',                '{money,filipino,side_hustle}'::text[], null),
  ('pinoy-life', 17, 'Mainit grabe',        'stickers/pinoy-life/mainit-grabe.png',              '{weather,filipino}'::text[], 'afternoon'),
  ('pinoy-life', 18, 'Baha na naman',       'stickers/pinoy-life/baha-na-naman.png',             '{weather,rain,commute,filipino}'::text[], 'whereami'),
  ('barkada', 1 , 'Libre mo?',           'stickers/barkada/libre-mo.png',                     '{barkada,food,funny}'::text[], null),
  ('barkada', 2 , 'Squad',               'stickers/barkada/squad.png',                        '{barkada,friends}'::text[], 'whoamiwith'),
  ('barkada', 3 , 'Tropa',               'stickers/barkada/tropa.png',                        '{barkada,friends}'::text[], 'whoamiwith'),
  ('barkada', 4 , 'G na',                'stickers/barkada/g-na.png',                         '{barkada,words}'::text[], null),
  ('barkada', 5 , 'Inuman?',             'stickers/barkada/inuman.png',                       '{barkada,night}'::text[], 'evening'),
  ('barkada', 6 , 'Sino sasama?',        'stickers/barkada/sino-sasama.png',                  '{barkada,plans}'::text[], null),
  ('barkada', 7 , 'Late ka na naman',    'stickers/barkada/late-ka-na-naman.png',             '{barkada,funny}'::text[], null),
  ('barkada', 8 , 'Walang iwanan',       'stickers/barkada/walang-iwanan.png',                '{barkada,friends}'::text[], 'whoamiwith'),
  ('barkada', 9 , 'Kwentuhan',           'stickers/barkada/kwentuhan.png',                    '{barkada,talk}'::text[], 'evening'),
  ('barkada', 10, 'Kanto vibes',         'stickers/barkada/kanto-vibes.png',                  '{barkada,street}'::text[], 'whereami'),
  ('barkada', 11, 'Videoke night',       'stickers/barkada/videoke-night.png',                '{barkada,videoke,night}'::text[], 'evening'),
  ('barkada', 12, 'Ambagan',             'stickers/barkada/ambagan.png',                      '{barkada,money}'::text[], null),
  ('barkada', 13, 'Road trip',           'stickers/barkada/road-trip.png',                    '{barkada,travel}'::text[], 'whereami'),
  ('barkada', 14, 'Selfie muna',         'stickers/barkada/selfie-muna.png',                  '{barkada,selfie}'::text[], 'selfie'),
  ('barkada', 15, 'BFF',                 'stickers/barkada/bff.png',                          '{barkada,friends}'::text[], 'whoamiwith'),
  ('barkada', 16, 'Solid',               'stickers/barkada/solid.png',                        '{barkada,words}'::text[], null),
  ('work-from-wherever', 1 , 'Camera off',          'stickers/work-from-wherever/camera-off.png',        '{work,meeting,coworkers}'::text[], 'mebusywith'),
  ('work-from-wherever', 2 , 'OOO',                 'stickers/work-from-wherever/ooo.png',               '{work,rest}'::text[], null),
  ('work-from-wherever', 3 , 'Could be an email',   'stickers/work-from-wherever/could-be-an-email.png', '{work,meeting,funny}'::text[], 'mebusywith'),
  ('work-from-wherever', 4 , 'Per my last email',   'stickers/work-from-wherever/per-my-last-email.png', '{work,funny}'::text[], 'mebusywith'),
  ('work-from-wherever', 5 , 'On mute',             'stickers/work-from-wherever/on-mute.png',           '{work,meeting}'::text[], 'mebusywith'),
  ('work-from-wherever', 6 , 'Brb',                 'stickers/work-from-wherever/brb.png',               '{work,words}'::text[], null),
  ('work-from-wherever', 7 , 'Deadline mode',       'stickers/work-from-wherever/deadline-mode.png',     '{work,school,side_hustle}'::text[], 'mebusywith'),
  ('work-from-wherever', 8 , 'Focus time',          'stickers/work-from-wherever/focus-time.png',        '{work,school}'::text[], 'mebusywith'),
  ('work-from-wherever', 9 , 'Standup',             'stickers/work-from-wherever/standup.png',           '{work,meeting,coworkers}'::text[], 'morning'),
  ('work-from-wherever', 10, 'Coffee chat',         'stickers/work-from-wherever/coffee-chat.png',       '{work,coffee,coworkers}'::text[], 'morning'),
  ('work-from-wherever', 11, 'Desk lunch',          'stickers/work-from-wherever/desk-lunch.png',        '{work,food}'::text[], 'afternoon'),
  ('work-from-wherever', 12, 'Laptop life',         'stickers/work-from-wherever/laptop-life.png',       '{work,side_hustle,cafe}'::text[], 'whereami'),
  ('work-from-wherever', 13, 'Overtime',            'stickers/work-from-wherever/overtime.png',          '{work,night}'::text[], 'evening'),
  ('work-from-wherever', 14, 'Hybrid day',          'stickers/work-from-wherever/hybrid-day.png',        '{work,office_fit}'::text[], 'whereami'),
  ('work-from-wherever', 15, 'Logged off',          'stickers/work-from-wherever/logged-off.png',        '{work,rest}'::text[], 'evening'),
  ('work-from-wherever', 16, 'Done for today',      'stickers/work-from-wherever/done-for-today.png',    '{work,rest}'::text[], 'evening'),
  ('pet-parent', 1 , 'Pet tax',             'stickers/pet-parent/pet-tax.png',                   '{pets,funny}'::text[], null),
  ('pet-parent', 2 , 'Fur baby',            'stickers/pet-parent/fur-baby.png',                  '{pets,family}'::text[], 'whoamiwith'),
  ('pet-parent', 3 , 'Walkies',             'stickers/pet-parent/walkies.png',                   '{pets,walk}'::text[], 'morning'),
  ('pet-parent', 4 , 'Good boy',            'stickers/pet-parent/good-boy.png',                  '{pets,dog}'::text[], null),
  ('pet-parent', 5 , 'Good girl',           'stickers/pet-parent/good-girl.png',                 '{pets,dog,cat}'::text[], null),
  ('pet-parent', 6 , 'Zoomies',             'stickers/pet-parent/zoomies.png',                   '{pets,funny}'::text[], null),
  ('pet-parent', 7 , 'Nap buddy',           'stickers/pet-parent/nap-buddy.png',                 '{pets,rest}'::text[], 'afternoon'),
  ('pet-parent', 8 , 'Treat time',          'stickers/pet-parent/treat-time.png',                '{pets,food}'::text[], null),
  ('pet-parent', 9 , 'Muning',              'stickers/pet-parent/muning.png',                    '{pets,cat,filipino}'::text[], null),
  ('pet-parent', 10, 'Bantay',              'stickers/pet-parent/bantay.png',                    '{pets,dog,filipino}'::text[], null),
  ('pet-parent', 11, 'Vet day',             'stickers/pet-parent/vet-day.png',                   '{pets,vet}'::text[], 'whereami'),
  ('pet-parent', 12, 'Paw-some',            'stickers/pet-parent/paw-some.png',                  '{pets,words}'::text[], null),
  ('pet-parent', 13, 'Fur mom',             'stickers/pet-parent/fur-mom.png',                   '{pets,family}'::text[], 'whoamiwith'),
  ('pet-parent', 14, 'Fur dad',             'stickers/pet-parent/fur-dad.png',                   '{pets,family}'::text[], 'whoamiwith')
) as v(pack_slug, sort, label, asset_path, tags, slot_hint)
join public.sticker_packs p on p.slug = v.pack_slug;
