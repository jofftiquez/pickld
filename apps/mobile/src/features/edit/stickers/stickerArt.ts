// Bundled art for every catalog sticker (0012 launch packs, 0029 paid packs, 0032 picture stickers, 0060 new packs, 0065 restyled word art and Hashtags: one PNG per sticker at repo-root assets/stickers/<pack>/<name>.png,
// the same files the photo worker serves), keyed by the catalog's asset_path. Bundled so the Stickers tool and
// every moment's stickers draw offline and from the first use (FR-STK-02 cached art). Width and height are the
// PNG's pixels: the overlay's box takes the art's aspect.

/** `source` is the bundler's asset id (what `require` of an image returns). */
export type StickerArt = { source: number; width: number; height: number };

export const stickerArt: Readonly<Record<string, StickerArt>> = {
  'stickers/barkada/ambagan.png': {
    source: require('../../../../../../assets/stickers/barkada/ambagan.png'),
    width: 576,
    height: 234,
  },
  'stickers/barkada/bff.png': {
    source: require('../../../../../../assets/stickers/barkada/bff.png'),
    width: 345,
    height: 234,
  },
  'stickers/barkada/chat-bubbles.png': {
    source: require('../../../../../../assets/stickers/barkada/chat-bubbles.png'),
    width: 360,
    height: 312,
  },
  'stickers/barkada/cheers.png': {
    source: require('../../../../../../assets/stickers/barkada/cheers.png'),
    width: 360,
    height: 330,
  },
  'stickers/barkada/g-na.png': {
    source: require('../../../../../../assets/stickers/barkada/g-na.png'),
    width: 369,
    height: 234,
  },
  'stickers/barkada/high-five.png': {
    source: require('../../../../../../assets/stickers/barkada/high-five.png'),
    width: 354,
    height: 360,
  },
  'stickers/barkada/inuman.png': {
    source: require('../../../../../../assets/stickers/barkada/inuman.png'),
    width: 534,
    height: 234,
  },
  'stickers/barkada/kanto-vibes.png': {
    source: require('../../../../../../assets/stickers/barkada/kanto-vibes.png'),
    width: 660,
    height: 234,
  },
  'stickers/barkada/kwentuhan.png': {
    source: require('../../../../../../assets/stickers/barkada/kwentuhan.png'),
    width: 639,
    height: 234,
  },
  'stickers/barkada/late-ka-na-naman.png': {
    source: require('../../../../../../assets/stickers/barkada/late-ka-na-naman.png'),
    width: 870,
    height: 234,
  },
  'stickers/barkada/libre-mo.png': {
    source: require('../../../../../../assets/stickers/barkada/libre-mo.png'),
    width: 585,
    height: 234,
  },
  'stickers/barkada/penguin-trio.png': {
    source: require('../../../../../../assets/stickers/barkada/penguin-trio.png'),
    width: 360,
    height: 343,
  },
  'stickers/barkada/photo-strip.png': {
    source: require('../../../../../../assets/stickers/barkada/photo-strip.png'),
    width: 225,
    height: 360,
  },
  'stickers/barkada/piggy-bank.png': {
    source: require('../../../../../../assets/stickers/barkada/piggy-bank.png'),
    width: 359,
    height: 360,
  },
  'stickers/barkada/pizza.png': {
    source: require('../../../../../../assets/stickers/barkada/pizza.png'),
    width: 316,
    height: 360,
  },
  'stickers/barkada/road-trip-car.png': {
    source: require('../../../../../../assets/stickers/barkada/road-trip-car.png'),
    width: 360,
    height: 266,
  },
  'stickers/barkada/road-trip.png': {
    source: require('../../../../../../assets/stickers/barkada/road-trip.png'),
    width: 555,
    height: 234,
  },
  'stickers/barkada/selfie-muna.png': {
    source: require('../../../../../../assets/stickers/barkada/selfie-muna.png'),
    width: 654,
    height: 234,
  },
  'stickers/barkada/sino-sasama.png': {
    source: require('../../../../../../assets/stickers/barkada/sino-sasama.png'),
    width: 732,
    height: 234,
  },
  'stickers/barkada/solid.png': {
    source: require('../../../../../../assets/stickers/barkada/solid.png'),
    width: 396,
    height: 234,
  },
  'stickers/barkada/squad.png': {
    source: require('../../../../../../assets/stickers/barkada/squad.png'),
    width: 450,
    height: 234,
  },
  'stickers/barkada/tropa.png': {
    source: require('../../../../../../assets/stickers/barkada/tropa.png'),
    width: 420,
    height: 234,
  },
  'stickers/barkada/videoke-mic.png': {
    source: require('../../../../../../assets/stickers/barkada/videoke-mic.png'),
    width: 302,
    height: 360,
  },
  'stickers/barkada/videoke-night.png': {
    source: require('../../../../../../assets/stickers/barkada/videoke-night.png'),
    width: 744,
    height: 234,
  },
  'stickers/barkada/walang-iwanan.png': {
    source: require('../../../../../../assets/stickers/barkada/walang-iwanan.png'),
    width: 789,
    height: 234,
  },
  'stickers/christmas-2026/aguinaldo.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/aguinaldo.png'),
    width: 597,
    height: 234,
  },
  'stickers/christmas-2026/bibingka-cake.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/bibingka-cake.png'),
    width: 360,
    height: 309,
  },
  'stickers/christmas-2026/bibingka.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/bibingka.png'),
    width: 540,
    height: 234,
  },
  'stickers/christmas-2026/christmas-party.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/christmas-party.png'),
    width: 828,
    height: 234,
  },
  'stickers/christmas-2026/exchange-gift.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/exchange-gift.png'),
    width: 741,
    height: 234,
  },
  'stickers/christmas-2026/gift-box.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/gift-box.png'),
    width: 330,
    height: 360,
  },
  'stickers/christmas-2026/hamon-ham.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/hamon-ham.png'),
    width: 360,
    height: 288,
  },
  'stickers/christmas-2026/hamon.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/hamon.png'),
    width: 474,
    height: 234,
  },
  'stickers/christmas-2026/maligayang-pasko.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/maligayang-pasko.png'),
    width: 903,
    height: 234,
  },
  'stickers/christmas-2026/monito-monita.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/monito-monita.png'),
    width: 768,
    height: 234,
  },
  'stickers/christmas-2026/ninang-duties.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/ninang-duties.png'),
    width: 735,
    height: 234,
  },
  'stickers/christmas-2026/noche-buena.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/noche-buena.png'),
    width: 717,
    height: 234,
  },
  'stickers/christmas-2026/parol-lantern.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/parol-lantern.png'),
    width: 305,
    height: 360,
  },
  'stickers/christmas-2026/parol.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/parol.png'),
    width: 396,
    height: 234,
  },
  'stickers/christmas-2026/puto-bumbong-plate.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/puto-bumbong-plate.png'),
    width: 360,
    height: 295,
  },
  'stickers/christmas-2026/puto-bumbong.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/puto-bumbong.png'),
    width: 780,
    height: 234,
  },
  'stickers/christmas-2026/santa-cat.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/santa-cat.png'),
    width: 333,
    height: 360,
  },
  'stickers/christmas-2026/simbang-gabi.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/simbang-gabi.png'),
    width: 747,
    height: 234,
  },
  'stickers/corporate/action-items-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/action-items-v2.png'),
    width: 792,
    height: 236,
  },
  'stickers/corporate/action-items.png': {
    source: require('../../../../../../assets/stickers/corporate/action-items.png'),
    width: 693,
    height: 234,
  },
  'stickers/corporate/blocked-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/blocked-v2.png'),
    width: 582,
    height: 236,
  },
  'stickers/corporate/blocked.png': {
    source: require('../../../../../../assets/stickers/corporate/blocked.png'),
    width: 522,
    height: 234,
  },
  'stickers/corporate/circle-back-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/circle-back-v2.png'),
    width: 724,
    height: 322,
  },
  'stickers/corporate/circle-back.png': {
    source: require('../../../../../../assets/stickers/corporate/circle-back.png'),
    width: 843,
    height: 234,
  },
  'stickers/corporate/eod-na-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/eod-na-v2.png'),
    width: 562,
    height: 236,
  },
  'stickers/corporate/eod-na.png': {
    source: require('../../../../../../assets/stickers/corporate/eod-na.png'),
    width: 480,
    height: 234,
  },
  'stickers/corporate/kpi-hit-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/kpi-hit-v2.png'),
    width: 538,
    height: 236,
  },
  'stickers/corporate/kpi-hit.png': {
    source: require('../../../../../../assets/stickers/corporate/kpi-hit.png'),
    width: 444,
    height: 234,
  },
  'stickers/corporate/leave-approved-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/leave-approved-v2.png'),
    width: 632,
    height: 322,
  },
  'stickers/corporate/leave-approved.png': {
    source: require('../../../../../../assets/stickers/corporate/leave-approved.png'),
    width: 831,
    height: 234,
  },
  'stickers/corporate/noted-with-thanks-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/noted-with-thanks-v2.png'),
    width: 718,
    height: 322,
  },
  'stickers/corporate/noted-with-thanks.png': {
    source: require('../../../../../../assets/stickers/corporate/noted-with-thanks.png'),
    width: 918,
    height: 234,
  },
  'stickers/corporate/pa-sign-po-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/pa-sign-po-v2.png'),
    width: 690,
    height: 236,
  },
  'stickers/corporate/pa-sign-po.png': {
    source: require('../../../../../../assets/stickers/corporate/pa-sign-po.png'),
    width: 627,
    height: 234,
  },
  'stickers/corporate/ping-me-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/ping-me-v2.png'),
    width: 592,
    height: 236,
  },
  'stickers/corporate/ping-me.png': {
    source: require('../../../../../../assets/stickers/corporate/ping-me.png'),
    width: 507,
    height: 234,
  },
  'stickers/corporate/q4-grind-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/q4-grind-v2.png'),
    width: 610,
    height: 236,
  },
  'stickers/corporate/q4-grind.png': {
    source: require('../../../../../../assets/stickers/corporate/q4-grind.png'),
    width: 540,
    height: 234,
  },
  'stickers/corporate/quick-sync-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/quick-sync-v2.png'),
    width: 770,
    height: 236,
  },
  'stickers/corporate/quick-sync.png': {
    source: require('../../../../../../assets/stickers/corporate/quick-sync.png'),
    width: 681,
    height: 234,
  },
  'stickers/corporate/take-this-offline-v2.png': {
    source: require('../../../../../../assets/stickers/corporate/take-this-offline-v2.png'),
    width: 706,
    height: 322,
  },
  'stickers/corporate/take-this-offline.png': {
    source: require('../../../../../../assets/stickers/corporate/take-this-offline.png'),
    width: 1020,
    height: 234,
  },
  'stickers/cyclists/100-km-done-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/100-km-done-v2.png'),
    width: 838,
    height: 208,
  },
  'stickers/cyclists/100-km-done.png': {
    source: require('../../../../../../assets/stickers/cyclists/100-km-done.png'),
    width: 696,
    height: 234,
  },
  'stickers/cyclists/ahon-pa-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/ahon-pa-v2.png'),
    width: 636,
    height: 208,
  },
  'stickers/cyclists/ahon-pa.png': {
    source: require('../../../../../../assets/stickers/cyclists/ahon-pa.png'),
    width: 519,
    height: 234,
  },
  'stickers/cyclists/bike-to-work-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/bike-to-work-v2.png'),
    width: 878,
    height: 208,
  },
  'stickers/cyclists/bike-to-work.png': {
    source: require('../../../../../../assets/stickers/cyclists/bike-to-work.png'),
    width: 687,
    height: 234,
  },
  'stickers/cyclists/clipped-in-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/clipped-in-v2.png'),
    width: 730,
    height: 208,
  },
  'stickers/cyclists/clipped-in.png': {
    source: require('../../../../../../assets/stickers/cyclists/clipped-in.png'),
    width: 597,
    height: 234,
  },
  'stickers/cyclists/coffee-ride-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/coffee-ride-v2.png'),
    width: 790,
    height: 208,
  },
  'stickers/cyclists/coffee-ride.png': {
    source: require('../../../../../../assets/stickers/cyclists/coffee-ride.png'),
    width: 642,
    height: 234,
  },
  'stickers/cyclists/long-ride-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/long-ride-v2.png'),
    width: 708,
    height: 208,
  },
  'stickers/cyclists/long-ride.png': {
    source: require('../../../../../../assets/stickers/cyclists/long-ride.png'),
    width: 564,
    height: 234,
  },
  'stickers/cyclists/padyak-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/padyak-v2.png'),
    width: 586,
    height: 208,
  },
  'stickers/cyclists/padyak.png': {
    source: require('../../../../../../assets/stickers/cyclists/padyak.png'),
    width: 486,
    height: 234,
  },
  'stickers/cyclists/pedal-power-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/pedal-power-v2.png'),
    width: 854,
    height: 208,
  },
  'stickers/cyclists/pedal-power.png': {
    source: require('../../../../../../assets/stickers/cyclists/pedal-power.png'),
    width: 690,
    height: 234,
  },
  'stickers/cyclists/rest-stop-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/rest-stop-v2.png'),
    width: 716,
    height: 208,
  },
  'stickers/cyclists/rest-stop.png': {
    source: require('../../../../../../assets/stickers/cyclists/rest-stop.png'),
    width: 567,
    height: 234,
  },
  'stickers/cyclists/ride-on-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/ride-on-v2.png'),
    width: 608,
    height: 208,
  },
  'stickers/cyclists/ride-on.png': {
    source: require('../../../../../../assets/stickers/cyclists/ride-on.png'),
    width: 489,
    height: 234,
  },
  'stickers/cyclists/sunday-ride-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/sunday-ride-v2.png'),
    width: 816,
    height: 208,
  },
  'stickers/cyclists/sunday-ride.png': {
    source: require('../../../../../../assets/stickers/cyclists/sunday-ride.png'),
    width: 663,
    height: 234,
  },
  'stickers/cyclists/uphill-grind-v2.png': {
    source: require('../../../../../../assets/stickers/cyclists/uphill-grind-v2.png'),
    width: 848,
    height: 208,
  },
  'stickers/cyclists/uphill-grind.png': {
    source: require('../../../../../../assets/stickers/cyclists/uphill-grind.png'),
    width: 642,
    height: 234,
  },
  'stickers/everyday/avocado.png': {
    source: require('../../../../../../assets/stickers/everyday/avocado.png'),
    width: 313,
    height: 360,
  },
  'stickers/everyday/bunny.png': {
    source: require('../../../../../../assets/stickers/everyday/bunny.png'),
    width: 285,
    height: 360,
  },
  'stickers/everyday/busy-bee.png': {
    source: require('../../../../../../assets/stickers/everyday/busy-bee.png'),
    width: 561,
    height: 234,
  },
  'stickers/everyday/cat.png': {
    source: require('../../../../../../assets/stickers/everyday/cat.png'),
    width: 316,
    height: 360,
  },
  'stickers/everyday/chick.png': {
    source: require('../../../../../../assets/stickers/everyday/chick.png'),
    width: 360,
    height: 341,
  },
  'stickers/everyday/dog.png': {
    source: require('../../../../../../assets/stickers/everyday/dog.png'),
    width: 325,
    height: 360,
  },
  'stickers/everyday/frog.png': {
    source: require('../../../../../../assets/stickers/everyday/frog.png'),
    width: 360,
    height: 330,
  },
  'stickers/everyday/heart.png': {
    source: require('../../../../../../assets/stickers/everyday/heart.png'),
    width: 360,
    height: 314,
  },
  'stickers/everyday/kain-tayo.png': {
    source: require('../../../../../../assets/stickers/everyday/kain-tayo.png'),
    width: 567,
    height: 234,
  },
  'stickers/everyday/kape-muna.png': {
    source: require('../../../../../../assets/stickers/everyday/kape-muna.png'),
    width: 636,
    height: 234,
  },
  'stickers/everyday/laban.png': {
    source: require('../../../../../../assets/stickers/everyday/laban.png'),
    width: 468,
    height: 234,
  },
  'stickers/everyday/lunch-break.png': {
    source: require('../../../../../../assets/stickers/everyday/lunch-break.png'),
    width: 681,
    height: 234,
  },
  'stickers/everyday/mango.png': {
    source: require('../../../../../../assets/stickers/everyday/mango.png'),
    width: 314,
    height: 360,
  },
  'stickers/everyday/merienda-time.png': {
    source: require('../../../../../../assets/stickers/everyday/merienda-time.png'),
    width: 768,
    height: 234,
  },
  'stickers/everyday/okay-lang.png': {
    source: require('../../../../../../assets/stickers/everyday/okay-lang.png'),
    width: 594,
    height: 234,
  },
  'stickers/everyday/petsa-de-peligro.png': {
    source: require('../../../../../../assets/stickers/everyday/petsa-de-peligro.png'),
    width: 840,
    height: 234,
  },
  'stickers/everyday/real-ako.png': {
    source: require('../../../../../../assets/stickers/everyday/real-ako.png'),
    width: 525,
    height: 234,
  },
  'stickers/everyday/rest-day.png': {
    source: require('../../../../../../assets/stickers/everyday/rest-day.png'),
    width: 537,
    height: 234,
  },
  'stickers/everyday/salamat.png': {
    source: require('../../../../../../assets/stickers/everyday/salamat.png'),
    width: 516,
    height: 234,
  },
  'stickers/everyday/same-old.png': {
    source: require('../../../../../../assets/stickers/everyday/same-old.png'),
    width: 564,
    height: 234,
  },
  'stickers/everyday/sana-all.png': {
    source: require('../../../../../../assets/stickers/everyday/sana-all.png'),
    width: 498,
    height: 234,
  },
  'stickers/everyday/strawberry.png': {
    source: require('../../../../../../assets/stickers/everyday/strawberry.png'),
    width: 306,
    height: 360,
  },
  'stickers/everyday/tulog-muna.png': {
    source: require('../../../../../../assets/stickers/everyday/tulog-muna.png'),
    width: 648,
    height: 234,
  },
  'stickers/everyday/ulam-check.png': {
    source: require('../../../../../../assets/stickers/everyday/ulam-check.png'),
    width: 657,
    height: 234,
  },
  'stickers/everyday/watermelon.png': {
    source: require('../../../../../../assets/stickers/everyday/watermelon.png'),
    width: 360,
    height: 344,
  },
  'stickers/fish-moods/angry.png': {
    source: require('../../../../../../assets/stickers/fish-moods/angry.png'),
    width: 347,
    height: 360,
  },
  'stickers/fish-moods/chill.png': {
    source: require('../../../../../../assets/stickers/fish-moods/chill.png'),
    width: 360,
    height: 291,
  },
  'stickers/fish-moods/confused.png': {
    source: require('../../../../../../assets/stickers/fish-moods/confused.png'),
    width: 360,
    height: 347,
  },
  'stickers/fish-moods/happy.png': {
    source: require('../../../../../../assets/stickers/fish-moods/happy.png'),
    width: 360,
    height: 355,
  },
  'stickers/fish-moods/hungry.png': {
    source: require('../../../../../../assets/stickers/fish-moods/hungry.png'),
    width: 360,
    height: 272,
  },
  'stickers/fish-moods/in-love.png': {
    source: require('../../../../../../assets/stickers/fish-moods/in-love.png'),
    width: 335,
    height: 360,
  },
  'stickers/fish-moods/kiss.png': {
    source: require('../../../../../../assets/stickers/fish-moods/kiss.png'),
    width: 360,
    height: 330,
  },
  'stickers/fish-moods/lol.png': {
    source: require('../../../../../../assets/stickers/fish-moods/lol.png'),
    width: 360,
    height: 343,
  },
  'stickers/fish-moods/nervous.png': {
    source: require('../../../../../../assets/stickers/fish-moods/nervous.png'),
    width: 360,
    height: 326,
  },
  'stickers/fish-moods/party.png': {
    source: require('../../../../../../assets/stickers/fish-moods/party.png'),
    width: 350,
    height: 360,
  },
  'stickers/fish-moods/proud.png': {
    source: require('../../../../../../assets/stickers/fish-moods/proud.png'),
    width: 355,
    height: 356,
  },
  'stickers/fish-moods/sad.png': {
    source: require('../../../../../../assets/stickers/fish-moods/sad.png'),
    width: 360,
    height: 349,
  },
  'stickers/fish-moods/shocked.png': {
    source: require('../../../../../../assets/stickers/fish-moods/shocked.png'),
    width: 342,
    height: 360,
  },
  'stickers/fish-moods/shy.png': {
    source: require('../../../../../../assets/stickers/fish-moods/shy.png'),
    width: 360,
    height: 342,
  },
  'stickers/fish-moods/sick.png': {
    source: require('../../../../../../assets/stickers/fish-moods/sick.png'),
    width: 360,
    height: 280,
  },
  'stickers/fish-moods/sleepy.png': {
    source: require('../../../../../../assets/stickers/fish-moods/sleepy.png'),
    width: 360,
    height: 334,
  },
  'stickers/gen-z/ate-that-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/ate-that-v2.png'),
    width: 620,
    height: 244,
  },
  'stickers/gen-z/ate-that.png': {
    source: require('../../../../../../assets/stickers/gen-z/ate-that.png'),
    width: 513,
    height: 234,
  },
  'stickers/gen-z/bet-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/bet-v2.png'),
    width: 384,
    height: 244,
  },
  'stickers/gen-z/bet.png': {
    source: require('../../../../../../assets/stickers/gen-z/bet.png'),
    width: 333,
    height: 234,
  },
  'stickers/gen-z/delulu-era-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/delulu-era-v2.png'),
    width: 716,
    height: 244,
  },
  'stickers/gen-z/delulu-era.png': {
    source: require('../../../../../../assets/stickers/gen-z/delulu-era.png'),
    width: 585,
    height: 234,
  },
  'stickers/gen-z/iconic-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/iconic-v2.png'),
    width: 508,
    height: 244,
  },
  'stickers/gen-z/iconic.png': {
    source: require('../../../../../../assets/stickers/gen-z/iconic.png'),
    width: 438,
    height: 234,
  },
  'stickers/gen-z/its-giving-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/its-giving-v2.png'),
    width: 704,
    height: 244,
  },
  'stickers/gen-z/its-giving.png': {
    source: require('../../../../../../assets/stickers/gen-z/its-giving.png'),
    width: 579,
    height: 234,
  },
  'stickers/gen-z/lowkey-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/lowkey-v2.png'),
    width: 572,
    height: 244,
  },
  'stickers/gen-z/lowkey.png': {
    source: require('../../../../../../assets/stickers/gen-z/lowkey.png'),
    width: 507,
    height: 234,
  },
  'stickers/gen-z/main-character-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/main-character-v2.png'),
    width: 704,
    height: 340,
  },
  'stickers/gen-z/main-character.png': {
    source: require('../../../../../../assets/stickers/gen-z/main-character.png'),
    width: 786,
    height: 234,
  },
  'stickers/gen-z/no-cap-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/no-cap-v2.png'),
    width: 546,
    height: 244,
  },
  'stickers/gen-z/no-cap.png': {
    source: require('../../../../../../assets/stickers/gen-z/no-cap.png'),
    width: 471,
    height: 234,
  },
  'stickers/gen-z/rent-free-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/rent-free-v2.png'),
    width: 666,
    height: 244,
  },
  'stickers/gen-z/rent-free.png': {
    source: require('../../../../../../assets/stickers/gen-z/rent-free.png'),
    width: 555,
    height: 234,
  },
  'stickers/gen-z/slay-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/slay-v2.png'),
    width: 434,
    height: 244,
  },
  'stickers/gen-z/slay.png': {
    source: require('../../../../../../assets/stickers/gen-z/slay.png'),
    width: 363,
    height: 234,
  },
  'stickers/gen-z/understood-the-assignment-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/understood-the-assignment-v2.png'),
    width: 954,
    height: 340,
  },
  'stickers/gen-z/understood-the-assignment.png': {
    source: require('../../../../../../assets/stickers/gen-z/understood-the-assignment.png'),
    width: 1290,
    height: 234,
  },
  'stickers/gen-z/vibe-check-v2.png': {
    source: require('../../../../../../assets/stickers/gen-z/vibe-check-v2.png'),
    width: 698,
    height: 244,
  },
  'stickers/gen-z/vibe-check.png': {
    source: require('../../../../../../assets/stickers/gen-z/vibe-check.png'),
    width: 636,
    height: 234,
  },
  'stickers/hashtags/beach-pa.png': {
    source: require('../../../../../../assets/stickers/hashtags/beach-pa.png'),
    width: 538,
    height: 340,
  },
  'stickers/hashtags/exam-na.png': {
    source: require('../../../../../../assets/stickers/hashtags/exam-na.png'),
    width: 600,
    height: 450,
  },
  'stickers/hashtags/gala.png': {
    source: require('../../../../../../assets/stickers/hashtags/gala.png'),
    width: 374,
    height: 340,
  },
  'stickers/hashtags/happy-weekend.png': {
    source: require('../../../../../../assets/stickers/hashtags/happy-weekend.png'),
    width: 712,
    height: 362,
  },
  'stickers/hashtags/kain-tayo.png': {
    source: require('../../../../../../assets/stickers/hashtags/kain-tayo.png'),
    width: 564,
    height: 342,
  },
  'stickers/hashtags/lodi.png': {
    source: require('../../../../../../assets/stickers/hashtags/lodi.png'),
    width: 444,
    height: 444,
  },
  'stickers/hashtags/lunes-na-naman.png': {
    source: require('../../../../../../assets/stickers/hashtags/lunes-na-naman.png'),
    width: 728,
    height: 358,
  },
  'stickers/hashtags/petsa-de-peligro.png': {
    source: require('../../../../../../assets/stickers/hashtags/petsa-de-peligro.png'),
    width: 822,
    height: 444,
  },
  'stickers/hashtags/puyat.png': {
    source: require('../../../../../../assets/stickers/hashtags/puyat.png'),
    width: 500,
    height: 414,
  },
  'stickers/hashtags/sahod.png': {
    source: require('../../../../../../assets/stickers/hashtags/sahod.png'),
    width: 424,
    height: 342,
  },
  'stickers/hashtags/sana-all.png': {
    source: require('../../../../../../assets/stickers/hashtags/sana-all.png'),
    width: 474,
    height: 342,
  },
  'stickers/hashtags/tag-ulan.png': {
    source: require('../../../../../../assets/stickers/hashtags/tag-ulan.png'),
    width: 614,
    height: 456,
  },
  'stickers/hashtags/tgif.png': {
    source: require('../../../../../../assets/stickers/hashtags/tgif.png'),
    width: 450,
    height: 406,
  },
  'stickers/hashtags/throwback.png': {
    source: require('../../../../../../assets/stickers/hashtags/throwback.png'),
    width: 660,
    height: 428,
  },
  'stickers/hashtags/traffic.png': {
    source: require('../../../../../../assets/stickers/hashtags/traffic.png'),
    width: 486,
    height: 334,
  },
  'stickers/hashtags/walang-pasok.png': {
    source: require('../../../../../../assets/stickers/hashtags/walang-pasok.png'),
    width: 660,
    height: 354,
  },
  'stickers/milestones/first-friend.png': {
    source: require('../../../../../../assets/stickers/milestones/first-friend.png'),
    width: 744,
    height: 252,
  },
  'stickers/milestones/first-full-jar.png': {
    source: require('../../../../../../assets/stickers/milestones/first-full-jar.png'),
    width: 753,
    height: 252,
  },
  'stickers/milestones/full-jar-of-friends.png': {
    source: require('../../../../../../assets/stickers/milestones/full-jar-of-friends.png'),
    width: 966,
    height: 252,
  },
  'stickers/milestones/full-jars-100.png': {
    source: require('../../../../../../assets/stickers/milestones/full-jars-100.png'),
    width: 759,
    height: 252,
  },
  'stickers/milestones/full-jars-30.png': {
    source: require('../../../../../../assets/stickers/milestones/full-jars-30.png'),
    width: 717,
    height: 252,
  },
  'stickers/milestones/full-jars-7.png': {
    source: require('../../../../../../assets/stickers/milestones/full-jars-7.png'),
    width: 663,
    height: 252,
  },
  'stickers/milestones/jars-100.png': {
    source: require('../../../../../../assets/stickers/milestones/jars-100.png'),
    width: 618,
    height: 252,
  },
  'stickers/milestones/jars-200.png': {
    source: require('../../../../../../assets/stickers/milestones/jars-200.png'),
    width: 633,
    height: 252,
  },
  'stickers/milestones/jars-30.png': {
    source: require('../../../../../../assets/stickers/milestones/jars-30.png'),
    width: 576,
    height: 252,
  },
  'stickers/milestones/jars-50.png': {
    source: require('../../../../../../assets/stickers/milestones/jars-50.png'),
    width: 576,
    height: 252,
  },
  'stickers/milestones/jars-7.png': {
    source: require('../../../../../../assets/stickers/milestones/jars-7.png'),
    width: 516,
    height: 252,
  },
  'stickers/milestones/one-year.png': {
    source: require('../../../../../../assets/stickers/milestones/one-year.png'),
    width: 804,
    height: 252,
  },
  'stickers/olivia/big-yawn.png': {
    source: require('../../../../../../assets/stickers/olivia/big-yawn.png'),
    width: 300,
    height: 360,
  },
  'stickers/olivia/blanket-burrito.png': {
    source: require('../../../../../../assets/stickers/olivia/blanket-burrito.png'),
    width: 360,
    height: 353,
  },
  'stickers/olivia/box-boss.png': {
    source: require('../../../../../../assets/stickers/olivia/box-boss.png'),
    width: 346,
    height: 360,
  },
  'stickers/olivia/cold-shoulder.png': {
    source: require('../../../../../../assets/stickers/olivia/cold-shoulder.png'),
    width: 255,
    height: 360,
  },
  'stickers/olivia/cup-push.png': {
    source: require('../../../../../../assets/stickers/olivia/cup-push.png'),
    width: 360,
    height: 359,
  },
  'stickers/olivia/diva.png': {
    source: require('../../../../../../assets/stickers/olivia/diva.png'),
    width: 316,
    height: 360,
  },
  'stickers/olivia/grooming.png': {
    source: require('../../../../../../assets/stickers/olivia/grooming.png'),
    width: 300,
    height: 360,
  },
  'stickers/olivia/grumpy-floof.png': {
    source: require('../../../../../../assets/stickers/olivia/grumpy-floof.png'),
    width: 348,
    height: 360,
  },
  'stickers/olivia/heart-eyes.png': {
    source: require('../../../../../../assets/stickers/olivia/heart-eyes.png'),
    width: 316,
    height: 360,
  },
  'stickers/olivia/loaf-nap.png': {
    source: require('../../../../../../assets/stickers/olivia/loaf-nap.png'),
    width: 337,
    height: 360,
  },
  'stickers/olivia/lounge-queen.png': {
    source: require('../../../../../../assets/stickers/olivia/lounge-queen.png'),
    width: 360,
    height: 290,
  },
  'stickers/olivia/meow-drama.png': {
    source: require('../../../../../../assets/stickers/olivia/meow-drama.png'),
    width: 354,
    height: 360,
  },
  'stickers/olivia/queen.png': {
    source: require('../../../../../../assets/stickers/olivia/queen.png'),
    width: 305,
    height: 360,
  },
  'stickers/olivia/treat-please.png': {
    source: require('../../../../../../assets/stickers/olivia/treat-please.png'),
    width: 304,
    height: 360,
  },
  'stickers/olivia/unimpressed.png': {
    source: require('../../../../../../assets/stickers/olivia/unimpressed.png'),
    width: 298,
    height: 360,
  },
  'stickers/olivia/zoomies.png': {
    source: require('../../../../../../assets/stickers/olivia/zoomies.png'),
    width: 360,
    height: 307,
  },
  'stickers/pet-parent/bantay-dog.png': {
    source: require('../../../../../../assets/stickers/pet-parent/bantay-dog.png'),
    width: 304,
    height: 360,
  },
  'stickers/pet-parent/bantay.png': {
    source: require('../../../../../../assets/stickers/pet-parent/bantay.png'),
    width: 474,
    height: 234,
  },
  'stickers/pet-parent/bone.png': {
    source: require('../../../../../../assets/stickers/pet-parent/bone.png'),
    width: 360,
    height: 271,
  },
  'stickers/pet-parent/fur-baby.png': {
    source: require('../../../../../../assets/stickers/pet-parent/fur-baby.png'),
    width: 537,
    height: 234,
  },
  'stickers/pet-parent/fur-dad.png': {
    source: require('../../../../../../assets/stickers/pet-parent/fur-dad.png'),
    width: 492,
    height: 234,
  },
  'stickers/pet-parent/fur-mom.png': {
    source: require('../../../../../../assets/stickers/pet-parent/fur-mom.png'),
    width: 537,
    height: 234,
  },
  'stickers/pet-parent/good-boy.png': {
    source: require('../../../../../../assets/stickers/pet-parent/good-boy.png'),
    width: 585,
    height: 234,
  },
  'stickers/pet-parent/good-girl.png': {
    source: require('../../../../../../assets/stickers/pet-parent/good-girl.png'),
    width: 561,
    height: 234,
  },
  'stickers/pet-parent/muning-cat.png': {
    source: require('../../../../../../assets/stickers/pet-parent/muning-cat.png'),
    width: 307,
    height: 360,
  },
  'stickers/pet-parent/muning.png': {
    source: require('../../../../../../assets/stickers/pet-parent/muning.png'),
    width: 486,
    height: 234,
  },
  'stickers/pet-parent/nap-buddy.png': {
    source: require('../../../../../../assets/stickers/pet-parent/nap-buddy.png'),
    width: 630,
    height: 234,
  },
  'stickers/pet-parent/nap-cat.png': {
    source: require('../../../../../../assets/stickers/pet-parent/nap-cat.png'),
    width: 360,
    height: 344,
  },
  'stickers/pet-parent/paw-print.png': {
    source: require('../../../../../../assets/stickers/pet-parent/paw-print.png'),
    width: 360,
    height: 328,
  },
  'stickers/pet-parent/paw-some.png': {
    source: require('../../../../../../assets/stickers/pet-parent/paw-some.png'),
    width: 630,
    height: 234,
  },
  'stickers/pet-parent/pet-tax.png': {
    source: require('../../../../../../assets/stickers/pet-parent/pet-tax.png'),
    width: 471,
    height: 234,
  },
  'stickers/pet-parent/treat-time.png': {
    source: require('../../../../../../assets/stickers/pet-parent/treat-time.png'),
    width: 591,
    height: 234,
  },
  'stickers/pet-parent/vet-day-pup.png': {
    source: require('../../../../../../assets/stickers/pet-parent/vet-day-pup.png'),
    width: 347,
    height: 360,
  },
  'stickers/pet-parent/vet-day.png': {
    source: require('../../../../../../assets/stickers/pet-parent/vet-day.png'),
    width: 495,
    height: 234,
  },
  'stickers/pet-parent/walkies-dog.png': {
    source: require('../../../../../../assets/stickers/pet-parent/walkies-dog.png'),
    width: 360,
    height: 316,
  },
  'stickers/pet-parent/walkies.png': {
    source: require('../../../../../../assets/stickers/pet-parent/walkies.png'),
    width: 501,
    height: 234,
  },
  'stickers/pet-parent/zoomies.png': {
    source: require('../../../../../../assets/stickers/pet-parent/zoomies.png'),
    width: 531,
    height: 234,
  },
  'stickers/pinoy-life/adobo-rice.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/adobo-rice.png'),
    width: 360,
    height: 280,
  },
  'stickers/pinoy-life/baha-na-naman.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/baha-na-naman.png'),
    width: 783,
    height: 234,
  },
  'stickers/pinoy-life/bahala-na.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/bahala-na.png'),
    width: 570,
    height: 234,
  },
  'stickers/pinoy-life/balikbayan-box.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/balikbayan-box.png'),
    width: 798,
    height: 234,
  },
  'stickers/pinoy-life/balikbayan.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/balikbayan.png'),
    width: 360,
    height: 343,
  },
  'stickers/pinoy-life/bangka.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/bangka.png'),
    width: 360,
    height: 247,
  },
  'stickers/pinoy-life/banig.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/banig.png'),
    width: 360,
    height: 351,
  },
  'stickers/pinoy-life/carabao.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/carabao.png'),
    width: 360,
    height: 323,
  },
  'stickers/pinoy-life/charot.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/charot.png'),
    width: 468,
    height: 234,
  },
  'stickers/pinoy-life/electric-fan.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/electric-fan.png'),
    width: 346,
    height: 360,
  },
  'stickers/pinoy-life/grabe-siya.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/grabe-siya.png'),
    width: 612,
    height: 234,
  },
  'stickers/pinoy-life/halo-halo.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/halo-halo.png'),
    width: 232,
    height: 360,
  },
  'stickers/pinoy-life/ingat.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/ingat.png'),
    width: 399,
    height: 234,
  },
  'stickers/pinoy-life/jeepney-ride.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/jeepney-ride.png'),
    width: 696,
    height: 234,
  },
  'stickers/pinoy-life/jeepney.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/jeepney.png'),
    width: 360,
    height: 296,
  },
  'stickers/pinoy-life/kain-na.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/kain-na.png'),
    width: 477,
    height: 234,
  },
  'stickers/pinoy-life/lechon.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/lechon.png'),
    width: 360,
    height: 262,
  },
  'stickers/pinoy-life/lodi.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/lodi.png'),
    width: 366,
    height: 234,
  },
  'stickers/pinoy-life/mainit-grabe.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/mainit-grabe.png'),
    width: 690,
    height: 234,
  },
  'stickers/pinoy-life/pa-picture.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/pa-picture.png'),
    width: 630,
    height: 234,
  },
  'stickers/pinoy-life/pandesal.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/pandesal.png'),
    width: 260,
    height: 360,
  },
  'stickers/pinoy-life/pasalubong.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/pasalubong.png'),
    width: 657,
    height: 234,
  },
  'stickers/pinoy-life/petmalu.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/petmalu.png'),
    width: 519,
    height: 234,
  },
  'stickers/pinoy-life/rainy-umbrella.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/rainy-umbrella.png'),
    width: 314,
    height: 360,
  },
  'stickers/pinoy-life/sampaguita.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/sampaguita.png'),
    width: 201,
    height: 360,
  },
  'stickers/pinoy-life/sari-sari.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/sari-sari.png'),
    width: 350,
    height: 360,
  },
  'stickers/pinoy-life/sweldo-day.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/sweldo-day.png'),
    width: 660,
    height: 234,
  },
  'stickers/pinoy-life/tara-na.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/tara-na.png'),
    width: 471,
    height: 234,
  },
  'stickers/pinoy-life/tipid-mode.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/tipid-mode.png'),
    width: 636,
    height: 234,
  },
  'stickers/pinoy-life/traffic-na-naman.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/traffic-na-naman.png'),
    width: 840,
    height: 234,
  },
  'stickers/pinoy-life/tricycle.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/tricycle.png'),
    width: 360,
    height: 329,
  },
  'stickers/pinoy-life/ube-taho.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/ube-taho.png'),
    width: 265,
    height: 360,
  },
  'stickers/pinoy-life/uwi-na.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/uwi-na.png'),
    width: 456,
    height: 234,
  },
  'stickers/pinoy-life/videoke.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/videoke.png'),
    width: 268,
    height: 360,
  },
  'stickers/pride/be-yourself-v2.png': {
    source: require('../../../../../../assets/stickers/pride/be-yourself-v2.png'),
    width: 798,
    height: 232,
  },
  'stickers/pride/be-yourself.png': {
    source: require('../../../../../../assets/stickers/pride/be-yourself.png'),
    width: 639,
    height: 234,
  },
  'stickers/pride/chosen-family-v2.png': {
    source: require('../../../../../../assets/stickers/pride/chosen-family-v2.png'),
    width: 904,
    height: 232,
  },
  'stickers/pride/chosen-family.png': {
    source: require('../../../../../../assets/stickers/pride/chosen-family.png'),
    width: 759,
    height: 234,
  },
  'stickers/pride/ganda-mo-mars-v2.png': {
    source: require('../../../../../../assets/stickers/pride/ganda-mo-mars-v2.png'),
    width: 644,
    height: 314,
  },
  'stickers/pride/ganda-mo-mars.png': {
    source: require('../../../../../../assets/stickers/pride/ganda-mo-mars.png'),
    width: 837,
    height: 234,
  },
  'stickers/pride/happy-pride-v2.png': {
    source: require('../../../../../../assets/stickers/pride/happy-pride-v2.png'),
    width: 802,
    height: 232,
  },
  'stickers/pride/happy-pride.png': {
    source: require('../../../../../../assets/stickers/pride/happy-pride.png'),
    width: 681,
    height: 234,
  },
  'stickers/pride/love-is-love-v2.png': {
    source: require('../../../../../../assets/stickers/pride/love-is-love-v2.png'),
    width: 822,
    height: 232,
  },
  'stickers/pride/love-is-love.png': {
    source: require('../../../../../../assets/stickers/pride/love-is-love.png'),
    width: 648,
    height: 234,
  },
  'stickers/pride/love-wins-v2.png': {
    source: require('../../../../../../assets/stickers/pride/love-wins-v2.png'),
    width: 700,
    height: 232,
  },
  'stickers/pride/love-wins.png': {
    source: require('../../../../../../assets/stickers/pride/love-wins.png'),
    width: 585,
    height: 234,
  },
  'stickers/pride/out-and-proud-v2.png': {
    source: require('../../../../../../assets/stickers/pride/out-and-proud-v2.png'),
    width: 908,
    height: 232,
  },
  'stickers/pride/out-and-proud.png': {
    source: require('../../../../../../assets/stickers/pride/out-and-proud.png'),
    width: 768,
    height: 234,
  },
  'stickers/pride/pride-march-v2.png': {
    source: require('../../../../../../assets/stickers/pride/pride-march-v2.png'),
    width: 814,
    height: 232,
  },
  'stickers/pride/pride-march.png': {
    source: require('../../../../../../assets/stickers/pride/pride-march.png'),
    width: 669,
    height: 234,
  },
  'stickers/pride/proud-ally-v2.png': {
    source: require('../../../../../../assets/stickers/pride/proud-ally-v2.png'),
    width: 758,
    height: 232,
  },
  'stickers/pride/proud-ally.png': {
    source: require('../../../../../../assets/stickers/pride/proud-ally.png'),
    width: 588,
    height: 234,
  },
  'stickers/pride/queer-joy-v2.png': {
    source: require('../../../../../../assets/stickers/pride/queer-joy-v2.png'),
    width: 700,
    height: 232,
  },
  'stickers/pride/queer-joy.png': {
    source: require('../../../../../../assets/stickers/pride/queer-joy.png'),
    width: 579,
    height: 234,
  },
  'stickers/pride/rainbow-vibes-v2.png': {
    source: require('../../../../../../assets/stickers/pride/rainbow-vibes-v2.png'),
    width: 918,
    height: 232,
  },
  'stickers/pride/rainbow-vibes.png': {
    source: require('../../../../../../assets/stickers/pride/rainbow-vibes.png'),
    width: 771,
    height: 234,
  },
  'stickers/pride/safe-space-v2.png': {
    source: require('../../../../../../assets/stickers/pride/safe-space-v2.png'),
    width: 726,
    height: 232,
  },
  'stickers/pride/safe-space.png': {
    source: require('../../../../../../assets/stickers/pride/safe-space.png'),
    width: 630,
    height: 234,
  },
  'stickers/stamps/date.png': {
    source: require('../../../../../../assets/stickers/stamps/date.png'),
    width: 498,
    height: 240,
  },
  'stickers/stamps/day-off.png': {
    source: require('../../../../../../assets/stickers/stamps/day-off.png'),
    width: 576,
    height: 240,
  },
  'stickers/stamps/day.png': {
    source: require('../../../../../../assets/stickers/stamps/day.png'),
    width: 747,
    height: 240,
  },
  'stickers/stamps/jar-number.png': {
    source: require('../../../../../../assets/stickers/stamps/jar-number.png'),
    width: 567,
    height: 240,
  },
  'stickers/stamps/no-filter.png': {
    source: require('../../../../../../assets/stickers/stamps/no-filter.png'),
    width: 642,
    height: 240,
  },
  'stickers/stamps/on-this-day.png': {
    source: require('../../../../../../assets/stickers/stamps/on-this-day.png'),
    width: 756,
    height: 240,
  },
  'stickers/stamps/photo-dump.png': {
    source: require('../../../../../../assets/stickers/stamps/photo-dump.png'),
    width: 795,
    height: 240,
  },
  'stickers/stamps/real-day.png': {
    source: require('../../../../../../assets/stickers/stamps/real-day.png'),
    width: 615,
    height: 240,
  },
  'stickers/stamps/time.png': {
    source: require('../../../../../../assets/stickers/stamps/time.png'),
    width: 546,
    height: 240,
  },
  'stickers/stamps/totoo.png': {
    source: require('../../../../../../assets/stickers/stamps/totoo.png'),
    width: 783,
    height: 240,
  },
  'stickers/the-eight/afternoon-slump.png': {
    source: require('../../../../../../assets/stickers/the-eight/afternoon-slump.png'),
    width: 864,
    height: 234,
  },
  'stickers/the-eight/aral-muna.png': {
    source: require('../../../../../../assets/stickers/the-eight/aral-muna.png'),
    width: 588,
    height: 234,
  },
  'stickers/the-eight/bangon-na.png': {
    source: require('../../../../../../assets/stickers/the-eight/bangon-na.png'),
    width: 612,
    height: 234,
  },
  'stickers/the-eight/barkada.png': {
    source: require('../../../../../../assets/stickers/the-eight/barkada.png'),
    width: 522,
    height: 234,
  },
  'stickers/the-eight/bear-peace.png': {
    source: require('../../../../../../assets/stickers/the-eight/bear-peace.png'),
    width: 321,
    height: 360,
  },
  'stickers/the-eight/book-stack.png': {
    source: require('../../../../../../assets/stickers/the-eight/book-stack.png'),
    width: 360,
    height: 346,
  },
  'stickers/the-eight/camera.png': {
    source: require('../../../../../../assets/stickers/the-eight/camera.png'),
    width: 360,
    height: 309,
  },
  'stickers/the-eight/cat-cuddle.png': {
    source: require('../../../../../../assets/stickers/the-eight/cat-cuddle.png'),
    width: 360,
    height: 315,
  },
  'stickers/the-eight/chick-trio.png': {
    source: require('../../../../../../assets/stickers/the-eight/chick-trio.png'),
    width: 360,
    height: 320,
  },
  'stickers/the-eight/cozy-house.png': {
    source: require('../../../../../../assets/stickers/the-eight/cozy-house.png'),
    width: 360,
    height: 340,
  },
  'stickers/the-eight/deadline-mode.png': {
    source: require('../../../../../../assets/stickers/the-eight/deadline-mode.png'),
    width: 795,
    height: 234,
  },
  'stickers/the-eight/early-bird.png': {
    source: require('../../../../../../assets/stickers/the-eight/early-bird.png'),
    width: 573,
    height: 234,
  },
  'stickers/the-eight/egg-toast.png': {
    source: require('../../../../../../assets/stickers/the-eight/egg-toast.png'),
    width: 360,
    height: 356,
  },
  'stickers/the-eight/family-time.png': {
    source: require('../../../../../../assets/stickers/the-eight/family-time.png'),
    width: 648,
    height: 234,
  },
  'stickers/the-eight/good-morning.png': {
    source: require('../../../../../../assets/stickers/the-eight/good-morning.png'),
    width: 768,
    height: 234,
  },
  'stickers/the-eight/gym-fit.png': {
    source: require('../../../../../../assets/stickers/the-eight/gym-fit.png'),
    width: 489,
    height: 234,
  },
  'stickers/the-eight/haggard-pero-happy.png': {
    source: require('../../../../../../assets/stickers/the-eight/haggard-pero-happy.png'),
    width: 1017,
    height: 234,
  },
  'stickers/the-eight/halfway-there.png': {
    source: require('../../../../../../assets/stickers/the-eight/halfway-there.png'),
    width: 753,
    height: 234,
  },
  'stickers/the-eight/happy-laptop.png': {
    source: require('../../../../../../assets/stickers/the-eight/happy-laptop.png'),
    width: 360,
    height: 294,
  },
  'stickers/the-eight/hi-its-me.png': {
    source: require('../../../../../../assets/stickers/the-eight/hi-its-me.png'),
    width: 588,
    height: 234,
  },
  'stickers/the-eight/just-me.png': {
    source: require('../../../../../../assets/stickers/the-eight/just-me.png'),
    width: 489,
    height: 234,
  },
  'stickers/the-eight/map-pin.png': {
    source: require('../../../../../../assets/stickers/the-eight/map-pin.png'),
    width: 289,
    height: 360,
  },
  'stickers/the-eight/milk-tea.png': {
    source: require('../../../../../../assets/stickers/the-eight/milk-tea.png'),
    width: 243,
    height: 360,
  },
  'stickers/the-eight/nasa-bahay-lang.png': {
    source: require('../../../../../../assets/stickers/the-eight/nasa-bahay-lang.png'),
    width: 837,
    height: 234,
  },
  'stickers/the-eight/new-place.png': {
    source: require('../../../../../../assets/stickers/the-eight/new-place.png'),
    width: 648,
    height: 234,
  },
  'stickers/the-eight/night-owl.png': {
    source: require('../../../../../../assets/stickers/the-eight/night-owl.png'),
    width: 576,
    height: 234,
  },
  'stickers/the-eight/office-fit.png': {
    source: require('../../../../../../assets/stickers/the-eight/office-fit.png'),
    width: 564,
    height: 234,
  },
  'stickers/the-eight/owl.png': {
    source: require('../../../../../../assets/stickers/the-eight/owl.png'),
    width: 360,
    height: 342,
  },
  'stickers/the-eight/pahinga.png': {
    source: require('../../../../../../assets/stickers/the-eight/pahinga.png'),
    width: 510,
    height: 234,
  },
  'stickers/the-eight/pambahay.png': {
    source: require('../../../../../../assets/stickers/the-eight/pambahay.png'),
    width: 612,
    height: 234,
  },
  'stickers/the-eight/side-hustle.png': {
    source: require('../../../../../../assets/stickers/the-eight/side-hustle.png'),
    width: 636,
    height: 234,
  },
  'stickers/the-eight/siesta.png': {
    source: require('../../../../../../assets/stickers/the-eight/siesta.png'),
    width: 489,
    height: 234,
  },
  'stickers/the-eight/sleepy-moon.png': {
    source: require('../../../../../../assets/stickers/the-eight/sleepy-moon.png'),
    width: 333,
    height: 360,
  },
  'stickers/the-eight/sleepy-sloth.png': {
    source: require('../../../../../../assets/stickers/the-eight/sleepy-sloth.png'),
    width: 337,
    height: 360,
  },
  'stickers/the-eight/sneaker.png': {
    source: require('../../../../../../assets/stickers/the-eight/sneaker.png'),
    width: 360,
    height: 292,
  },
  'stickers/the-eight/sunglasses.png': {
    source: require('../../../../../../assets/stickers/the-eight/sunglasses.png'),
    width: 360,
    height: 193,
  },
  'stickers/the-eight/sunrise.png': {
    source: require('../../../../../../assets/stickers/the-eight/sunrise.png'),
    width: 360,
    height: 325,
  },
  'stickers/the-eight/traffic-again.png': {
    source: require('../../../../../../assets/stickers/the-eight/traffic-again.png'),
    width: 684,
    height: 234,
  },
  'stickers/the-eight/uwian-na.png': {
    source: require('../../../../../../assets/stickers/the-eight/uwian-na.png'),
    width: 558,
    height: 234,
  },
  'stickers/the-eight/walang-filter.png': {
    source: require('../../../../../../assets/stickers/the-eight/walang-filter.png'),
    width: 702,
    height: 234,
  },
  'stickers/trentahin/adulting-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/adulting-v2.png'),
    width: 546,
    height: 262,
  },
  'stickers/trentahin/adulting.png': {
    source: require('../../../../../../assets/stickers/trentahin/adulting.png'),
    width: 531,
    height: 234,
  },
  'stickers/trentahin/bawal-na-mapuyat-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/bawal-na-mapuyat-v2.png'),
    width: 912,
    height: 262,
  },
  'stickers/trentahin/bawal-na-mapuyat.png': {
    source: require('../../../../../../assets/stickers/trentahin/bawal-na-mapuyat.png'),
    width: 912,
    height: 234,
  },
  'stickers/trentahin/bills-paid-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/bills-paid-v2.png'),
    width: 588,
    height: 262,
  },
  'stickers/trentahin/bills-paid.png': {
    source: require('../../../../../../assets/stickers/trentahin/bills-paid.png'),
    width: 549,
    height: 234,
  },
  'stickers/trentahin/early-dinner-club-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/early-dinner-club-v2.png'),
    width: 628,
    height: 376,
  },
  'stickers/trentahin/early-dinner-club.png': {
    source: require('../../../../../../assets/stickers/trentahin/early-dinner-club.png'),
    width: 849,
    height: 234,
  },
  'stickers/trentahin/healing-era-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/healing-era-v2.png'),
    width: 662,
    height: 262,
  },
  'stickers/trentahin/healing-era.png': {
    source: require('../../../../../../assets/stickers/trentahin/healing-era.png'),
    width: 636,
    height: 234,
  },
  'stickers/trentahin/ipon-mode-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/ipon-mode-v2.png'),
    width: 608,
    height: 262,
  },
  'stickers/trentahin/ipon-mode.png': {
    source: require('../../../../../../assets/stickers/trentahin/ipon-mode.png'),
    width: 618,
    height: 234,
  },
  'stickers/trentahin/kape-muna-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/kape-muna-v2.png'),
    width: 642,
    height: 262,
  },
  'stickers/trentahin/kape-muna.png': {
    source: require('../../../../../../assets/stickers/trentahin/kape-muna.png'),
    width: 630,
    height: 234,
  },
  'stickers/trentahin/likod-check-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/likod-check-v2.png'),
    width: 650,
    height: 262,
  },
  'stickers/trentahin/likod-check.png': {
    source: require('../../../../../../assets/stickers/trentahin/likod-check.png'),
    width: 672,
    height: 234,
  },
  'stickers/trentahin/may-pasok-bukas-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/may-pasok-bukas-v2.png'),
    width: 874,
    height: 262,
  },
  'stickers/trentahin/may-pasok-bukas.png': {
    source: require('../../../../../../assets/stickers/trentahin/may-pasok-bukas.png'),
    width: 873,
    height: 234,
  },
  'stickers/trentahin/pahinga-is-productive-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/pahinga-is-productive-v2.png'),
    width: 606,
    height: 376,
  },
  'stickers/trentahin/pahinga-is-productive.png': {
    source: require('../../../../../../assets/stickers/trentahin/pahinga-is-productive.png'),
    width: 1044,
    height: 234,
  },
  'stickers/trentahin/salonpas-gang-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/salonpas-gang-v2.png'),
    width: 746,
    height: 262,
  },
  'stickers/trentahin/salonpas-gang.png': {
    source: require('../../../../../../assets/stickers/trentahin/salonpas-gang.png'),
    width: 774,
    height: 234,
  },
  'stickers/trentahin/tulog-by-9-v2.png': {
    source: require('../../../../../../assets/stickers/trentahin/tulog-by-9-v2.png'),
    width: 622,
    height: 262,
  },
  'stickers/trentahin/tulog-by-9.png': {
    source: require('../../../../../../assets/stickers/trentahin/tulog-by-9.png'),
    width: 591,
    height: 234,
  },
  'stickers/work-from-wherever/bento-box.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/bento-box.png'),
    width: 360,
    height: 293,
  },
  'stickers/work-from-wherever/brb.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/brb.png'),
    width: 336,
    height: 234,
  },
  'stickers/work-from-wherever/calendar.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/calendar.png'),
    width: 360,
    height: 343,
  },
  'stickers/work-from-wherever/camera-off.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/camera-off.png'),
    width: 636,
    height: 234,
  },
  'stickers/work-from-wherever/cat-on-laptop.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/cat-on-laptop.png'),
    width: 360,
    height: 310,
  },
  'stickers/work-from-wherever/coffee-chat.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/coffee-chat.png'),
    width: 663,
    height: 234,
  },
  'stickers/work-from-wherever/coffee-mug.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/coffee-mug.png'),
    width: 308,
    height: 360,
  },
  'stickers/work-from-wherever/could-be-an-email.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/could-be-an-email.png'),
    width: 891,
    height: 234,
  },
  'stickers/work-from-wherever/deadline-mode.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/deadline-mode.png'),
    width: 789,
    height: 234,
  },
  'stickers/work-from-wherever/desk-lunch.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/desk-lunch.png'),
    width: 621,
    height: 234,
  },
  'stickers/work-from-wherever/desk-plant.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/desk-plant.png'),
    width: 298,
    height: 360,
  },
  'stickers/work-from-wherever/done-for-today.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/done-for-today.png'),
    width: 786,
    height: 234,
  },
  'stickers/work-from-wherever/focus-time.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/focus-time.png'),
    width: 627,
    height: 234,
  },
  'stickers/work-from-wherever/headphones.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/headphones.png'),
    width: 355,
    height: 360,
  },
  'stickers/work-from-wherever/hybrid-day.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/hybrid-day.png'),
    width: 627,
    height: 234,
  },
  'stickers/work-from-wherever/laptop-life.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/laptop-life.png'),
    width: 621,
    height: 234,
  },
  'stickers/work-from-wherever/logged-off.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/logged-off.png'),
    width: 630,
    height: 234,
  },
  'stickers/work-from-wherever/night-owl.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/night-owl.png'),
    width: 360,
    height: 348,
  },
  'stickers/work-from-wherever/on-mute.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/on-mute.png'),
    width: 534,
    height: 234,
  },
  'stickers/work-from-wherever/ooo.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/ooo.png'),
    width: 405,
    height: 234,
  },
  'stickers/work-from-wherever/overtime.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/overtime.png'),
    width: 573,
    height: 234,
  },
  'stickers/work-from-wherever/per-my-last-email.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/per-my-last-email.png'),
    width: 852,
    height: 234,
  },
  'stickers/work-from-wherever/standup.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/standup.png'),
    width: 531,
    height: 234,
  },
  'stickers/work-from-wherever/sticky-notes.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/sticky-notes.png'),
    width: 346,
    height: 360,
  },
};

/** The art for a catalog asset_path, or undefined for a sticker this app version doesn't bundle. */
export function stickerArtFor(assetPath: string): StickerArt | undefined {
  return Object.prototype.hasOwnProperty.call(stickerArt, assetPath) ? stickerArt[assetPath] : undefined;
}
