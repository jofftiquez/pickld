-- 0100 — Downloadable sticker packs: the catalog columns (FR-STK-02, FR-STK-04; D-25, D-46, D-131).
-- Additive only: new columns, triggers and one policy condition each. Nothing is dropped, renamed or deleted.
--
-- Until now every sticker's art was bundled with the app. As the catalog grows, new packs ship as art in the photo
-- bucket only, and the app downloads it from the photo Worker and caches it on disk. Bundled packs stay bundled.
--
-- Art keys don't change: `stickers/<pack slug>/<name>.png` (= stickers.asset_path), public and cached as immutable
-- (D-25). Clients ask for `<photo Worker origin>/<asset_path>?v=<art_version>`; the Worker ignores `v`, so it only
-- changes the cache key.
--
--   sticker_packs.status        draft | published. A draft pack can be staged (rows and art) before anyone sees it:
--                               only moderators read it, nobody can use it, and the web page leaves it out. Draft →
--                               published only, never back.
--   sticker_packs.published_at  set when a pack is published (null for packs published before 0100)
--   stickers.art_width/height   the PNG's pixels, so a client can size art it hasn't downloaded yet
--   stickers.art_version        bumped when the file under a key is replaced, which only a draft pack may do
--
-- In a published pack a sticker's asset_path and art_version are frozen: new art is a new file and row, and the old
-- row is retired (D-46, D-42). Catalog writes stay service-role only (0012).

-- ---------------------------------------------------------------- columns
alter table public.sticker_packs
  add column status text not null default 'published',
  add column published_at timestamptz,
  add constraint sticker_packs_status_check check (status in ('draft', 'published'));

alter table public.stickers
  add column art_width int,
  add column art_height int,
  add column art_version int not null default 1,
  add constraint stickers_art_width_check check (art_width between 1 and 2048),
  add constraint stickers_art_height_check check (art_height between 1 and 2048),
  add constraint stickers_art_version_check check (art_version >= 1);

comment on column public.sticker_packs.status is
  'draft: staged, read by moderators only, never usable, not on the web page. published: in the catalog. Draft → published only (0100).';
comment on column public.sticker_packs.published_at is 'When the pack was published; null for packs published before 0100.';
comment on column public.stickers.art_width is 'The art PNG''s width in pixels (0100).';
comment on column public.stickers.art_height is 'The art PNG''s height in pixels (0100).';
comment on column public.stickers.art_version is
  'Cache key for the art: clients fetch <asset_path>?v=<art_version>. Bumped only while the pack is a draft (0100).';

-- ---------------------------------------------------------------- art sizes of the existing catalog
-- The sizes of the PNGs in assets/stickers, the same numbers as apps/mobile/src/features/edit/stickers/stickerArt.ts.
update public.stickers s set art_width = v.w, art_height = v.h
from (values
  ('stickers/barkada/ambagan.png', 576, 234),
  ('stickers/barkada/bff.png', 345, 234),
  ('stickers/barkada/chat-bubbles.png', 360, 312),
  ('stickers/barkada/cheers.png', 360, 330),
  ('stickers/barkada/g-na.png', 369, 234),
  ('stickers/barkada/high-five.png', 354, 360),
  ('stickers/barkada/inuman.png', 534, 234),
  ('stickers/barkada/kanto-vibes.png', 660, 234),
  ('stickers/barkada/kwentuhan.png', 639, 234),
  ('stickers/barkada/late-ka-na-naman.png', 870, 234),
  ('stickers/barkada/libre-mo.png', 585, 234),
  ('stickers/barkada/penguin-trio.png', 360, 343),
  ('stickers/barkada/photo-strip.png', 225, 360),
  ('stickers/barkada/piggy-bank.png', 359, 360),
  ('stickers/barkada/pizza.png', 316, 360),
  ('stickers/barkada/road-trip-car.png', 360, 266),
  ('stickers/barkada/road-trip.png', 555, 234),
  ('stickers/barkada/selfie-muna.png', 654, 234),
  ('stickers/barkada/sino-sasama.png', 732, 234),
  ('stickers/barkada/solid.png', 396, 234),
  ('stickers/barkada/squad.png', 450, 234),
  ('stickers/barkada/tropa.png', 420, 234),
  ('stickers/barkada/videoke-mic.png', 302, 360),
  ('stickers/barkada/videoke-night.png', 744, 234),
  ('stickers/barkada/walang-iwanan.png', 789, 234),
  ('stickers/christmas-2026/aguinaldo.png', 597, 234),
  ('stickers/christmas-2026/bibingka-cake.png', 360, 309),
  ('stickers/christmas-2026/bibingka.png', 540, 234),
  ('stickers/christmas-2026/christmas-party.png', 828, 234),
  ('stickers/christmas-2026/exchange-gift.png', 741, 234),
  ('stickers/christmas-2026/gift-box.png', 330, 360),
  ('stickers/christmas-2026/hamon-ham.png', 360, 288),
  ('stickers/christmas-2026/hamon.png', 474, 234),
  ('stickers/christmas-2026/maligayang-pasko.png', 903, 234),
  ('stickers/christmas-2026/monito-monita.png', 768, 234),
  ('stickers/christmas-2026/ninang-duties.png', 735, 234),
  ('stickers/christmas-2026/noche-buena.png', 717, 234),
  ('stickers/christmas-2026/parol-lantern.png', 305, 360),
  ('stickers/christmas-2026/parol.png', 396, 234),
  ('stickers/christmas-2026/puto-bumbong-plate.png', 360, 295),
  ('stickers/christmas-2026/puto-bumbong.png', 780, 234),
  ('stickers/christmas-2026/santa-cat.png', 333, 360),
  ('stickers/christmas-2026/simbang-gabi.png', 747, 234),
  ('stickers/corporate/action-items-v2.png', 792, 236),
  ('stickers/corporate/action-items.png', 693, 234),
  ('stickers/corporate/blocked-v2.png', 582, 236),
  ('stickers/corporate/blocked.png', 522, 234),
  ('stickers/corporate/circle-back-v2.png', 724, 322),
  ('stickers/corporate/circle-back.png', 843, 234),
  ('stickers/corporate/eod-na-v2.png', 562, 236),
  ('stickers/corporate/eod-na.png', 480, 234),
  ('stickers/corporate/kpi-hit-v2.png', 538, 236),
  ('stickers/corporate/kpi-hit.png', 444, 234),
  ('stickers/corporate/leave-approved-v2.png', 632, 322),
  ('stickers/corporate/leave-approved.png', 831, 234),
  ('stickers/corporate/noted-with-thanks-v2.png', 718, 322),
  ('stickers/corporate/noted-with-thanks.png', 918, 234),
  ('stickers/corporate/pa-sign-po-v2.png', 690, 236),
  ('stickers/corporate/pa-sign-po.png', 627, 234),
  ('stickers/corporate/ping-me-v2.png', 592, 236),
  ('stickers/corporate/ping-me.png', 507, 234),
  ('stickers/corporate/q4-grind-v2.png', 610, 236),
  ('stickers/corporate/q4-grind.png', 540, 234),
  ('stickers/corporate/quick-sync-v2.png', 770, 236),
  ('stickers/corporate/quick-sync.png', 681, 234),
  ('stickers/corporate/take-this-offline-v2.png', 706, 322),
  ('stickers/corporate/take-this-offline.png', 1020, 234),
  ('stickers/cyclists/100-km-done-v2.png', 838, 208),
  ('stickers/cyclists/100-km-done.png', 696, 234),
  ('stickers/cyclists/ahon-pa-v2.png', 636, 208),
  ('stickers/cyclists/ahon-pa.png', 519, 234),
  ('stickers/cyclists/bike-to-work-v2.png', 878, 208),
  ('stickers/cyclists/bike-to-work.png', 687, 234),
  ('stickers/cyclists/clipped-in-v2.png', 730, 208),
  ('stickers/cyclists/clipped-in.png', 597, 234),
  ('stickers/cyclists/coffee-ride-v2.png', 790, 208),
  ('stickers/cyclists/coffee-ride.png', 642, 234),
  ('stickers/cyclists/long-ride-v2.png', 708, 208),
  ('stickers/cyclists/long-ride.png', 564, 234),
  ('stickers/cyclists/padyak-v2.png', 586, 208),
  ('stickers/cyclists/padyak.png', 486, 234),
  ('stickers/cyclists/pedal-power-v2.png', 854, 208),
  ('stickers/cyclists/pedal-power.png', 690, 234),
  ('stickers/cyclists/rest-stop-v2.png', 716, 208),
  ('stickers/cyclists/rest-stop.png', 567, 234),
  ('stickers/cyclists/ride-on-v2.png', 608, 208),
  ('stickers/cyclists/ride-on.png', 489, 234),
  ('stickers/cyclists/sunday-ride-v2.png', 816, 208),
  ('stickers/cyclists/sunday-ride.png', 663, 234),
  ('stickers/cyclists/uphill-grind-v2.png', 848, 208),
  ('stickers/cyclists/uphill-grind.png', 642, 234),
  ('stickers/everyday/avocado.png', 313, 360),
  ('stickers/everyday/bunny.png', 285, 360),
  ('stickers/everyday/busy-bee.png', 561, 234),
  ('stickers/everyday/cat.png', 316, 360),
  ('stickers/everyday/chick.png', 360, 341),
  ('stickers/everyday/dog.png', 325, 360),
  ('stickers/everyday/frog.png', 360, 330),
  ('stickers/everyday/heart.png', 360, 314),
  ('stickers/everyday/kain-tayo.png', 567, 234),
  ('stickers/everyday/kape-muna.png', 636, 234),
  ('stickers/everyday/laban.png', 468, 234),
  ('stickers/everyday/lunch-break.png', 681, 234),
  ('stickers/everyday/mango.png', 314, 360),
  ('stickers/everyday/merienda-time.png', 768, 234),
  ('stickers/everyday/okay-lang.png', 594, 234),
  ('stickers/everyday/petsa-de-peligro.png', 840, 234),
  ('stickers/everyday/real-ako.png', 525, 234),
  ('stickers/everyday/rest-day.png', 537, 234),
  ('stickers/everyday/salamat.png', 516, 234),
  ('stickers/everyday/same-old.png', 564, 234),
  ('stickers/everyday/sana-all.png', 498, 234),
  ('stickers/everyday/strawberry.png', 306, 360),
  ('stickers/everyday/tulog-muna.png', 648, 234),
  ('stickers/everyday/ulam-check.png', 657, 234),
  ('stickers/everyday/watermelon.png', 360, 344),
  ('stickers/fish-moods/angry.png', 347, 360),
  ('stickers/fish-moods/chill.png', 360, 291),
  ('stickers/fish-moods/confused.png', 360, 347),
  ('stickers/fish-moods/happy.png', 360, 355),
  ('stickers/fish-moods/hungry.png', 360, 272),
  ('stickers/fish-moods/in-love.png', 335, 360),
  ('stickers/fish-moods/kiss.png', 360, 330),
  ('stickers/fish-moods/lol.png', 360, 343),
  ('stickers/fish-moods/nervous.png', 360, 326),
  ('stickers/fish-moods/party.png', 350, 360),
  ('stickers/fish-moods/proud.png', 355, 356),
  ('stickers/fish-moods/sad.png', 360, 349),
  ('stickers/fish-moods/shocked.png', 342, 360),
  ('stickers/fish-moods/shy.png', 360, 342),
  ('stickers/fish-moods/sick.png', 360, 280),
  ('stickers/fish-moods/sleepy.png', 360, 334),
  ('stickers/gen-z/ate-that-v2.png', 620, 244),
  ('stickers/gen-z/ate-that.png', 513, 234),
  ('stickers/gen-z/bet-v2.png', 384, 244),
  ('stickers/gen-z/bet.png', 333, 234),
  ('stickers/gen-z/delulu-era-v2.png', 716, 244),
  ('stickers/gen-z/delulu-era.png', 585, 234),
  ('stickers/gen-z/iconic-v2.png', 508, 244),
  ('stickers/gen-z/iconic.png', 438, 234),
  ('stickers/gen-z/its-giving-v2.png', 704, 244),
  ('stickers/gen-z/its-giving.png', 579, 234),
  ('stickers/gen-z/lowkey-v2.png', 572, 244),
  ('stickers/gen-z/lowkey.png', 507, 234),
  ('stickers/gen-z/main-character-v2.png', 704, 340),
  ('stickers/gen-z/main-character.png', 786, 234),
  ('stickers/gen-z/no-cap-v2.png', 546, 244),
  ('stickers/gen-z/no-cap.png', 471, 234),
  ('stickers/gen-z/rent-free-v2.png', 666, 244),
  ('stickers/gen-z/rent-free.png', 555, 234),
  ('stickers/gen-z/slay-v2.png', 434, 244),
  ('stickers/gen-z/slay.png', 363, 234),
  ('stickers/gen-z/understood-the-assignment-v2.png', 954, 340),
  ('stickers/gen-z/understood-the-assignment.png', 1290, 234),
  ('stickers/gen-z/vibe-check-v2.png', 698, 244),
  ('stickers/gen-z/vibe-check.png', 636, 234),
  ('stickers/hashtags/beach-pa.png', 538, 340),
  ('stickers/hashtags/exam-na.png', 600, 450),
  ('stickers/hashtags/gala.png', 374, 340),
  ('stickers/hashtags/happy-weekend.png', 712, 362),
  ('stickers/hashtags/kain-tayo.png', 564, 342),
  ('stickers/hashtags/lodi.png', 444, 444),
  ('stickers/hashtags/lunes-na-naman.png', 728, 358),
  ('stickers/hashtags/petsa-de-peligro.png', 822, 444),
  ('stickers/hashtags/puyat.png', 500, 414),
  ('stickers/hashtags/sahod.png', 424, 342),
  ('stickers/hashtags/sana-all.png', 474, 342),
  ('stickers/hashtags/tag-ulan.png', 614, 456),
  ('stickers/hashtags/tgif.png', 450, 406),
  ('stickers/hashtags/throwback.png', 660, 428),
  ('stickers/hashtags/traffic.png', 486, 334),
  ('stickers/hashtags/walang-pasok.png', 660, 354),
  ('stickers/milestones/first-full-jar.png', 753, 252),
  ('stickers/milestones/full-jars-100.png', 759, 252),
  ('stickers/milestones/full-jars-30.png', 717, 252),
  ('stickers/milestones/full-jars-7.png', 663, 252),
  ('stickers/milestones/jars-100.png', 618, 252),
  ('stickers/milestones/jars-200.png', 633, 252),
  ('stickers/milestones/jars-30.png', 576, 252),
  ('stickers/milestones/jars-50.png', 576, 252),
  ('stickers/milestones/jars-7.png', 516, 252),
  ('stickers/milestones/one-year.png', 804, 252),
  ('stickers/olivia/big-yawn.png', 300, 360),
  ('stickers/olivia/blanket-burrito.png', 360, 353),
  ('stickers/olivia/box-boss.png', 346, 360),
  ('stickers/olivia/cold-shoulder.png', 255, 360),
  ('stickers/olivia/cup-push.png', 360, 359),
  ('stickers/olivia/diva.png', 316, 360),
  ('stickers/olivia/grooming.png', 300, 360),
  ('stickers/olivia/grumpy-floof.png', 348, 360),
  ('stickers/olivia/heart-eyes.png', 316, 360),
  ('stickers/olivia/loaf-nap.png', 337, 360),
  ('stickers/olivia/lounge-queen.png', 360, 290),
  ('stickers/olivia/meow-drama.png', 354, 360),
  ('stickers/olivia/queen.png', 305, 360),
  ('stickers/olivia/treat-please.png', 304, 360),
  ('stickers/olivia/unimpressed.png', 298, 360),
  ('stickers/olivia/zoomies.png', 360, 307),
  ('stickers/pet-parent/bantay-dog.png', 304, 360),
  ('stickers/pet-parent/bantay.png', 474, 234),
  ('stickers/pet-parent/bone.png', 360, 271),
  ('stickers/pet-parent/fur-baby.png', 537, 234),
  ('stickers/pet-parent/fur-dad.png', 492, 234),
  ('stickers/pet-parent/fur-mom.png', 537, 234),
  ('stickers/pet-parent/good-boy.png', 585, 234),
  ('stickers/pet-parent/good-girl.png', 561, 234),
  ('stickers/pet-parent/muning-cat.png', 307, 360),
  ('stickers/pet-parent/muning.png', 486, 234),
  ('stickers/pet-parent/nap-buddy.png', 630, 234),
  ('stickers/pet-parent/nap-cat.png', 360, 344),
  ('stickers/pet-parent/paw-print.png', 360, 328),
  ('stickers/pet-parent/paw-some.png', 630, 234),
  ('stickers/pet-parent/pet-tax.png', 471, 234),
  ('stickers/pet-parent/treat-time.png', 591, 234),
  ('stickers/pet-parent/vet-day-pup.png', 347, 360),
  ('stickers/pet-parent/vet-day.png', 495, 234),
  ('stickers/pet-parent/walkies-dog.png', 360, 316),
  ('stickers/pet-parent/walkies.png', 501, 234),
  ('stickers/pet-parent/zoomies.png', 531, 234),
  ('stickers/pinoy-life/adobo-rice.png', 360, 280),
  ('stickers/pinoy-life/baha-na-naman.png', 783, 234),
  ('stickers/pinoy-life/bahala-na.png', 570, 234),
  ('stickers/pinoy-life/balikbayan-box.png', 798, 234),
  ('stickers/pinoy-life/balikbayan.png', 360, 343),
  ('stickers/pinoy-life/bangka.png', 360, 247),
  ('stickers/pinoy-life/banig.png', 360, 351),
  ('stickers/pinoy-life/carabao.png', 360, 323),
  ('stickers/pinoy-life/charot.png', 468, 234),
  ('stickers/pinoy-life/electric-fan.png', 346, 360),
  ('stickers/pinoy-life/grabe-siya.png', 612, 234),
  ('stickers/pinoy-life/halo-halo.png', 232, 360),
  ('stickers/pinoy-life/ingat.png', 399, 234),
  ('stickers/pinoy-life/jeepney-ride.png', 696, 234),
  ('stickers/pinoy-life/jeepney.png', 360, 296),
  ('stickers/pinoy-life/kain-na.png', 477, 234),
  ('stickers/pinoy-life/lechon.png', 360, 262),
  ('stickers/pinoy-life/lodi.png', 366, 234),
  ('stickers/pinoy-life/mainit-grabe.png', 690, 234),
  ('stickers/pinoy-life/pa-picture.png', 630, 234),
  ('stickers/pinoy-life/pandesal.png', 260, 360),
  ('stickers/pinoy-life/pasalubong.png', 657, 234),
  ('stickers/pinoy-life/petmalu.png', 519, 234),
  ('stickers/pinoy-life/rainy-umbrella.png', 314, 360),
  ('stickers/pinoy-life/sampaguita.png', 201, 360),
  ('stickers/pinoy-life/sari-sari.png', 350, 360),
  ('stickers/pinoy-life/sweldo-day.png', 660, 234),
  ('stickers/pinoy-life/tara-na.png', 471, 234),
  ('stickers/pinoy-life/tipid-mode.png', 636, 234),
  ('stickers/pinoy-life/traffic-na-naman.png', 840, 234),
  ('stickers/pinoy-life/tricycle.png', 360, 329),
  ('stickers/pinoy-life/ube-taho.png', 265, 360),
  ('stickers/pinoy-life/uwi-na.png', 456, 234),
  ('stickers/pinoy-life/videoke.png', 268, 360),
  ('stickers/pride/be-yourself-v2.png', 798, 232),
  ('stickers/pride/be-yourself.png', 639, 234),
  ('stickers/pride/chosen-family-v2.png', 904, 232),
  ('stickers/pride/chosen-family.png', 759, 234),
  ('stickers/pride/ganda-mo-mars-v2.png', 644, 314),
  ('stickers/pride/ganda-mo-mars.png', 837, 234),
  ('stickers/pride/happy-pride-v2.png', 802, 232),
  ('stickers/pride/happy-pride.png', 681, 234),
  ('stickers/pride/love-is-love-v2.png', 822, 232),
  ('stickers/pride/love-is-love.png', 648, 234),
  ('stickers/pride/love-wins-v2.png', 700, 232),
  ('stickers/pride/love-wins.png', 585, 234),
  ('stickers/pride/out-and-proud-v2.png', 908, 232),
  ('stickers/pride/out-and-proud.png', 768, 234),
  ('stickers/pride/pride-march-v2.png', 814, 232),
  ('stickers/pride/pride-march.png', 669, 234),
  ('stickers/pride/proud-ally-v2.png', 758, 232),
  ('stickers/pride/proud-ally.png', 588, 234),
  ('stickers/pride/queer-joy-v2.png', 700, 232),
  ('stickers/pride/queer-joy.png', 579, 234),
  ('stickers/pride/rainbow-vibes-v2.png', 918, 232),
  ('stickers/pride/rainbow-vibes.png', 771, 234),
  ('stickers/pride/safe-space-v2.png', 726, 232),
  ('stickers/pride/safe-space.png', 630, 234),
  ('stickers/stamps/date.png', 498, 240),
  ('stickers/stamps/day-off.png', 576, 240),
  ('stickers/stamps/day.png', 747, 240),
  ('stickers/stamps/jar-number.png', 567, 240),
  ('stickers/stamps/no-filter.png', 642, 240),
  ('stickers/stamps/on-this-day.png', 756, 240),
  ('stickers/stamps/photo-dump.png', 795, 240),
  ('stickers/stamps/real-day.png', 615, 240),
  ('stickers/stamps/time.png', 546, 240),
  ('stickers/stamps/totoo.png', 783, 240),
  ('stickers/the-eight/afternoon-slump.png', 864, 234),
  ('stickers/the-eight/aral-muna.png', 588, 234),
  ('stickers/the-eight/bangon-na.png', 612, 234),
  ('stickers/the-eight/barkada.png', 522, 234),
  ('stickers/the-eight/bear-peace.png', 321, 360),
  ('stickers/the-eight/book-stack.png', 360, 346),
  ('stickers/the-eight/camera.png', 360, 309),
  ('stickers/the-eight/cat-cuddle.png', 360, 315),
  ('stickers/the-eight/chick-trio.png', 360, 320),
  ('stickers/the-eight/cozy-house.png', 360, 340),
  ('stickers/the-eight/deadline-mode.png', 795, 234),
  ('stickers/the-eight/early-bird.png', 573, 234),
  ('stickers/the-eight/egg-toast.png', 360, 356),
  ('stickers/the-eight/family-time.png', 648, 234),
  ('stickers/the-eight/good-morning.png', 768, 234),
  ('stickers/the-eight/gym-fit.png', 489, 234),
  ('stickers/the-eight/haggard-pero-happy.png', 1017, 234),
  ('stickers/the-eight/halfway-there.png', 753, 234),
  ('stickers/the-eight/happy-laptop.png', 360, 294),
  ('stickers/the-eight/hi-its-me.png', 588, 234),
  ('stickers/the-eight/just-me.png', 489, 234),
  ('stickers/the-eight/map-pin.png', 289, 360),
  ('stickers/the-eight/milk-tea.png', 243, 360),
  ('stickers/the-eight/nasa-bahay-lang.png', 837, 234),
  ('stickers/the-eight/new-place.png', 648, 234),
  ('stickers/the-eight/night-owl.png', 576, 234),
  ('stickers/the-eight/office-fit.png', 564, 234),
  ('stickers/the-eight/owl.png', 360, 342),
  ('stickers/the-eight/pahinga.png', 510, 234),
  ('stickers/the-eight/pambahay.png', 612, 234),
  ('stickers/the-eight/side-hustle.png', 636, 234),
  ('stickers/the-eight/siesta.png', 489, 234),
  ('stickers/the-eight/sleepy-moon.png', 333, 360),
  ('stickers/the-eight/sleepy-sloth.png', 337, 360),
  ('stickers/the-eight/sneaker.png', 360, 292),
  ('stickers/the-eight/sunglasses.png', 360, 193),
  ('stickers/the-eight/sunrise.png', 360, 325),
  ('stickers/the-eight/traffic-again.png', 684, 234),
  ('stickers/the-eight/uwian-na.png', 558, 234),
  ('stickers/the-eight/walang-filter.png', 702, 234),
  ('stickers/trentahin/adulting-v2.png', 546, 262),
  ('stickers/trentahin/adulting.png', 531, 234),
  ('stickers/trentahin/bawal-na-mapuyat-v2.png', 912, 262),
  ('stickers/trentahin/bawal-na-mapuyat.png', 912, 234),
  ('stickers/trentahin/bills-paid-v2.png', 588, 262),
  ('stickers/trentahin/bills-paid.png', 549, 234),
  ('stickers/trentahin/early-dinner-club-v2.png', 628, 376),
  ('stickers/trentahin/early-dinner-club.png', 849, 234),
  ('stickers/trentahin/healing-era-v2.png', 662, 262),
  ('stickers/trentahin/healing-era.png', 636, 234),
  ('stickers/trentahin/ipon-mode-v2.png', 608, 262),
  ('stickers/trentahin/ipon-mode.png', 618, 234),
  ('stickers/trentahin/kape-muna-v2.png', 642, 262),
  ('stickers/trentahin/kape-muna.png', 630, 234),
  ('stickers/trentahin/likod-check-v2.png', 650, 262),
  ('stickers/trentahin/likod-check.png', 672, 234),
  ('stickers/trentahin/may-pasok-bukas-v2.png', 874, 262),
  ('stickers/trentahin/may-pasok-bukas.png', 873, 234),
  ('stickers/trentahin/pahinga-is-productive-v2.png', 606, 376),
  ('stickers/trentahin/pahinga-is-productive.png', 1044, 234),
  ('stickers/trentahin/salonpas-gang-v2.png', 746, 262),
  ('stickers/trentahin/salonpas-gang.png', 774, 234),
  ('stickers/trentahin/tulog-by-9-v2.png', 622, 262),
  ('stickers/trentahin/tulog-by-9.png', 591, 234),
  ('stickers/work-from-wherever/bento-box.png', 360, 293),
  ('stickers/work-from-wherever/brb.png', 336, 234),
  ('stickers/work-from-wherever/calendar.png', 360, 343),
  ('stickers/work-from-wherever/camera-off.png', 636, 234),
  ('stickers/work-from-wherever/cat-on-laptop.png', 360, 310),
  ('stickers/work-from-wherever/coffee-chat.png', 663, 234),
  ('stickers/work-from-wherever/coffee-mug.png', 308, 360),
  ('stickers/work-from-wherever/could-be-an-email.png', 891, 234),
  ('stickers/work-from-wherever/deadline-mode.png', 789, 234),
  ('stickers/work-from-wherever/desk-lunch.png', 621, 234),
  ('stickers/work-from-wherever/desk-plant.png', 298, 360),
  ('stickers/work-from-wherever/done-for-today.png', 786, 234),
  ('stickers/work-from-wherever/focus-time.png', 627, 234),
  ('stickers/work-from-wherever/headphones.png', 355, 360),
  ('stickers/work-from-wherever/hybrid-day.png', 627, 234),
  ('stickers/work-from-wherever/laptop-life.png', 621, 234),
  ('stickers/work-from-wherever/logged-off.png', 630, 234),
  ('stickers/work-from-wherever/night-owl.png', 360, 348),
  ('stickers/work-from-wherever/on-mute.png', 534, 234),
  ('stickers/work-from-wherever/ooo.png', 405, 234),
  ('stickers/work-from-wherever/overtime.png', 573, 234),
  ('stickers/work-from-wherever/per-my-last-email.png', 852, 234),
  ('stickers/work-from-wherever/standup.png', 531, 234),
  ('stickers/work-from-wherever/sticky-notes.png', 346, 360)
) as v(asset_path, w, h)
where s.asset_path = v.asset_path;

-- ---------------------------------------------------------------- publishing rules
create or replace function public.sticker_packs_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'draft' then
    raise exception 'a published sticker pack can''t go back to draft' using errcode = 'check_violation';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status = 'draft') then
    if tg_op = 'UPDATE' and exists (
      select 1 from stickers s
      where s.pack_id = new.id and s.retired_at is null and (s.art_width is null or s.art_height is null)
    ) then
      raise exception 'every sticker needs art_width and art_height before its pack is published'
        using errcode = 'check_violation';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;

create trigger sticker_packs_guard before insert or update on public.sticker_packs
for each row execute function public.sticker_packs_guard();

create or replace function public.stickers_art_frozen() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.asset_path is distinct from old.asset_path or new.art_version is distinct from old.art_version)
     and exists (select 1 from sticker_packs p where p.id = old.pack_id and p.status = 'published') then
    raise exception 'art in a published pack never changes under a key: add a new sticker and retire this one (D-46)'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger stickers_art_frozen before update on public.stickers
for each row execute function public.stickers_art_frozen();

revoke execute on function public.sticker_packs_guard() from public, anon, authenticated;
revoke execute on function public.stickers_art_frozen() from public, anon, authenticated;

-- ---------------------------------------------------------------- drafts: moderators only
alter policy packs_read on public.sticker_packs
  using (auth.role() = 'authenticated' and (status = 'published' or public.is_moderator()));
alter policy stickers_read on public.stickers
  using (auth.role() = 'authenticated' and exists (
    select 1 from public.sticker_packs p where p.id = pack_id and (p.status = 'published' or public.is_moderator())
  ));

-- A draft pack is never usable, so a draft sticker can't be added to a moment.
create or replace function public.pack_usable(p public.sticker_packs) returns boolean
language sql stable set search_path = public as $$
  select p.status = 'published'
     and (p.tier = 'free'
          or exists (select 1 from owned_packs o where o.user_id = auth.uid() and o.pack_id = p.id))
$$;

-- The web page's catalog (0012) leaves drafts out, like packs that aren't out yet.
create or replace function public.public_sticker_catalog()
returns table (
  pack_slug text,
  pack_name text,
  pack_tier pack_tier,
  pack_sort int,
  sticker_id uuid,
  label text,
  asset_path text,
  tags text[],
  slot_hint slot,
  stamp sticker_stamp,
  sort int
)
language sql stable security definer set search_path = public as $$
  select p.slug, p.name, p.tier, p.sort, s.id, s.label, s.asset_path, s.tags, s.slot_hint, s.stamp, s.sort
  from sticker_packs p
  join stickers s on s.pack_id = p.id
  where p.status = 'published' and (p.available_from is null or p.available_from <= now())
  order by p.sort, s.sort
$$;
