// Bundled art for every catalog sticker (0012 launch packs, 0029 paid packs, 0032 picture stickers, 0060 new packs, 0065 restyled word art and Hashtags, 0154 thirty per text pack, 0155 six text packs: one PNG per sticker at repo-root assets/stickers/<pack>/<name>.png,
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
  'stickers/corporate/bandwidth.png': {
    source: require('../../../../../../assets/stickers/corporate/bandwidth.png'),
    width: 2047,
    height: 644,
  },
  'stickers/corporate/big-win.png': {
    source: require('../../../../../../assets/stickers/corporate/big-win.png'),
    width: 2047,
    height: 849,
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
  'stickers/corporate/can-you-see-my-screen.png': {
    source: require('../../../../../../assets/stickers/corporate/can-you-see-my-screen.png'),
    width: 2047,
    height: 842,
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
  'stickers/corporate/deep-dive.png': {
    source: require('../../../../../../assets/stickers/corporate/deep-dive.png'),
    width: 2043,
    height: 718,
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
  'stickers/corporate/for-your-approval.png': {
    source: require('../../../../../../assets/stickers/corporate/for-your-approval.png'),
    width: 2045,
    height: 1080,
  },
  'stickers/corporate/hard-stop.png': {
    source: require('../../../../../../assets/stickers/corporate/hard-stop.png'),
    width: 2045,
    height: 718,
  },
  'stickers/corporate/kape-break.png': {
    source: require('../../../../../../assets/stickers/corporate/kape-break.png'),
    width: 2048,
    height: 646,
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
  'stickers/corporate/lets-align.png': {
    source: require('../../../../../../assets/stickers/corporate/lets-align.png'),
    width: 2047,
    height: 694,
  },
  'stickers/corporate/low-hanging-fruit.png': {
    source: require('../../../../../../assets/stickers/corporate/low-hanging-fruit.png'),
    width: 2044,
    height: 839,
  },
  'stickers/corporate/moving-forward.png': {
    source: require('../../../../../../assets/stickers/corporate/moving-forward.png'),
    width: 2041,
    height: 1154,
  },
  'stickers/corporate/new-hire.png': {
    source: require('../../../../../../assets/stickers/corporate/new-hire.png'),
    width: 2043,
    height: 759,
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
  'stickers/corporate/payday.png': {
    source: require('../../../../../../assets/stickers/corporate/payday.png'),
    width: 2048,
    height: 881,
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
  'stickers/corporate/promoted.png': {
    source: require('../../../../../../assets/stickers/corporate/promoted.png'),
    width: 2045,
    height: 706,
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
  'stickers/corporate/ready-for-review.png': {
    source: require('../../../../../../assets/stickers/corporate/ready-for-review.png'),
    width: 2045,
    height: 1004,
  },
  'stickers/corporate/ship-it.png': {
    source: require('../../../../../../assets/stickers/corporate/ship-it.png'),
    width: 2040,
    height: 922,
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
  'stickers/corporate/team-building.png': {
    source: require('../../../../../../assets/stickers/corporate/team-building.png'),
    width: 2047,
    height: 565,
  },
  'stickers/corporate/team-lunch.png': {
    source: require('../../../../../../assets/stickers/corporate/team-lunch.png'),
    width: 2046,
    height: 645,
  },
  'stickers/corporate/touch-base.png': {
    source: require('../../../../../../assets/stickers/corporate/touch-base.png'),
    width: 2043,
    height: 650,
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
  'stickers/cyclists/50-km-done.png': {
    source: require('../../../../../../assets/stickers/cyclists/50-km-done.png'),
    width: 2043,
    height: 533,
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
  'stickers/cyclists/bike-is-life.png': {
    source: require('../../../../../../assets/stickers/cyclists/bike-is-life.png'),
    width: 2043,
    height: 555,
  },
  'stickers/cyclists/bike-shop-run.png': {
    source: require('../../../../../../assets/stickers/cyclists/bike-shop-run.png'),
    width: 2045,
    height: 463,
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
  'stickers/cyclists/downhill.png': {
    source: require('../../../../../../assets/stickers/cyclists/downhill.png'),
    width: 2046,
    height: 597,
  },
  'stickers/cyclists/drafting.png': {
    source: require('../../../../../../assets/stickers/cyclists/drafting.png'),
    width: 2045,
    height: 621,
  },
  'stickers/cyclists/flat-tire.png': {
    source: require('../../../../../../assets/stickers/cyclists/flat-tire.png'),
    width: 2044,
    height: 636,
  },
  'stickers/cyclists/fresh-legs.png': {
    source: require('../../../../../../assets/stickers/cyclists/fresh-legs.png'),
    width: 2043,
    height: 558,
  },
  'stickers/cyclists/gravel-day.png': {
    source: require('../../../../../../assets/stickers/cyclists/gravel-day.png'),
    width: 2047,
    height: 552,
  },
  'stickers/cyclists/group-ride.png': {
    source: require('../../../../../../assets/stickers/cyclists/group-ride.png'),
    width: 2043,
    height: 545,
  },
  'stickers/cyclists/headwind.png': {
    source: require('../../../../../../assets/stickers/cyclists/headwind.png'),
    width: 2045,
    height: 588,
  },
  'stickers/cyclists/kom.png': {
    source: require('../../../../../../assets/stickers/cyclists/kom.png'),
    width: 1816,
    height: 824,
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
  'stickers/cyclists/lusong.png': {
    source: require('../../../../../../assets/stickers/cyclists/lusong.png'),
    width: 2044,
    height: 677,
  },
  'stickers/cyclists/n-plus-1.png': {
    source: require('../../../../../../assets/stickers/cyclists/n-plus-1.png'),
    width: 2038,
    height: 1055,
  },
  'stickers/cyclists/night-ride.png': {
    source: require('../../../../../../assets/stickers/cyclists/night-ride.png'),
    width: 2045,
    height: 568,
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
  'stickers/cyclists/rain-ride.png': {
    source: require('../../../../../../assets/stickers/cyclists/rain-ride.png'),
    width: 2047,
    height: 613,
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
  'stickers/cyclists/ride-buddies.png': {
    source: require('../../../../../../assets/stickers/cyclists/ride-buddies.png'),
    width: 2047,
    height: 496,
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
  'stickers/cyclists/saddle-sore.png': {
    source: require('../../../../../../assets/stickers/cyclists/saddle-sore.png'),
    width: 2047,
    height: 508,
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
  'stickers/cyclists/tailwind.png': {
    source: require('../../../../../../assets/stickers/cyclists/tailwind.png'),
    width: 2046,
    height: 631,
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
  'stickers/fan-life/album-haul.png': {
    source: require('../../../../../../assets/stickers/fan-life/album-haul.png'),
    width: 2044,
    height: 612,
  },
  'stickers/fan-life/bias-wrecked.png': {
    source: require('../../../../../../assets/stickers/fan-life/bias-wrecked.png'),
    width: 2044,
    height: 544,
  },
  'stickers/fan-life/bias.png': {
    source: require('../../../../../../assets/stickers/fan-life/bias.png'),
    width: 2042,
    height: 1096,
  },
  'stickers/fan-life/comeback.png': {
    source: require('../../../../../../assets/stickers/fan-life/comeback.png'),
    width: 2043,
    height: 683,
  },
  'stickers/fan-life/concert-fit.png': {
    source: require('../../../../../../assets/stickers/fan-life/concert-fit.png'),
    width: 2045,
    height: 606,
  },
  'stickers/fan-life/concert-night.png': {
    source: require('../../../../../../assets/stickers/fan-life/concert-night.png'),
    width: 2047,
    height: 522,
  },
  'stickers/fan-life/dance-cover.png': {
    source: require('../../../../../../assets/stickers/fan-life/dance-cover.png'),
    width: 2044,
    height: 575,
  },
  'stickers/fan-life/encore.png': {
    source: require('../../../../../../assets/stickers/fan-life/encore.png'),
    width: 2047,
    height: 798,
  },
  'stickers/fan-life/fan-boy.png': {
    source: require('../../../../../../assets/stickers/fan-life/fan-boy.png'),
    width: 2047,
    height: 783,
  },
  'stickers/fan-life/fan-chant.png': {
    source: require('../../../../../../assets/stickers/fan-life/fan-chant.png'),
    width: 2045,
    height: 663,
  },
  'stickers/fan-life/fan-girl.png': {
    source: require('../../../../../../assets/stickers/fan-life/fan-girl.png'),
    width: 2046,
    height: 767,
  },
  'stickers/fan-life/fan-meet.png': {
    source: require('../../../../../../assets/stickers/fan-life/fan-meet.png'),
    width: 2045,
    height: 725,
  },
  'stickers/fan-life/fandom-friends.png': {
    source: require('../../../../../../assets/stickers/fan-life/fandom-friends.png'),
    width: 2042,
    height: 1093,
  },
  'stickers/fan-life/forever-my-era.png': {
    source: require('../../../../../../assets/stickers/fan-life/forever-my-era.png'),
    width: 2045,
    height: 1049,
  },
  'stickers/fan-life/front-row.png': {
    source: require('../../../../../../assets/stickers/fan-life/front-row.png'),
    width: 2048,
    height: 639,
  },
  'stickers/fan-life/hearts-for-you.png': {
    source: require('../../../../../../assets/stickers/fan-life/hearts-for-you.png'),
    width: 2042,
    height: 1068,
  },
  'stickers/fan-life/lightstick-ready.png': {
    source: require('../../../../../../assets/stickers/fan-life/lightstick-ready.png'),
    width: 2046,
    height: 897,
  },
  'stickers/fan-life/living-my-best-fan-life.png': {
    source: require('../../../../../../assets/stickers/fan-life/living-my-best-fan-life.png'),
    width: 2048,
    height: 767,
  },
  'stickers/fan-life/merch-line.png': {
    source: require('../../../../../../assets/stickers/fan-life/merch-line.png'),
    width: 2047,
    height: 642,
  },
  'stickers/fan-life/music-video-drop.png': {
    source: require('../../../../../../assets/stickers/fan-life/music-video-drop.png'),
    width: 2045,
    height: 854,
  },
  'stickers/fan-life/photocard.png': {
    source: require('../../../../../../assets/stickers/fan-life/photocard.png'),
    width: 2044,
    height: 626,
  },
  'stickers/fan-life/post-concert-blues.png': {
    source: require('../../../../../../assets/stickers/fan-life/post-concert-blues.png'),
    width: 2045,
    height: 726,
  },
  'stickers/fan-life/repeat-mode.png': {
    source: require('../../../../../../assets/stickers/fan-life/repeat-mode.png'),
    width: 2043,
    height: 575,
  },
  'stickers/fan-life/screaming.png': {
    source: require('../../../../../../assets/stickers/fan-life/screaming.png'),
    width: 2048,
    height: 655,
  },
  'stickers/fan-life/sold-out.png': {
    source: require('../../../../../../assets/stickers/fan-life/sold-out.png'),
    width: 2042,
    height: 724,
  },
  'stickers/fan-life/stan-forever.png': {
    source: require('../../../../../../assets/stickers/fan-life/stan-forever.png'),
    width: 2046,
    height: 548,
  },
  'stickers/fan-life/streaming-party.png': {
    source: require('../../../../../../assets/stickers/fan-life/streaming-party.png'),
    width: 2043,
    height: 896,
  },
  'stickers/fan-life/ticket-secured.png': {
    source: require('../../../../../../assets/stickers/fan-life/ticket-secured.png'),
    width: 2043,
    height: 1051,
  },
  'stickers/fan-life/ultimate-fan.png': {
    source: require('../../../../../../assets/stickers/fan-life/ultimate-fan.png'),
    width: 2048,
    height: 562,
  },
  'stickers/fan-life/waiting-for-the-drop.png': {
    source: require('../../../../../../assets/stickers/fan-life/waiting-for-the-drop.png'),
    width: 2043,
    height: 821,
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
  'stickers/foodie/bake-day.png': {
    source: require('../../../../../../assets/stickers/foodie/bake-day.png'),
    width: 2041,
    height: 873,
  },
  'stickers/foodie/breakfast-club.png': {
    source: require('../../../../../../assets/stickers/foodie/breakfast-club.png'),
    width: 2043,
    height: 1191,
  },
  'stickers/foodie/brunch-time.png': {
    source: require('../../../../../../assets/stickers/foodie/brunch-time.png'),
    width: 2045,
    height: 736,
  },
  'stickers/foodie/cheat-day.png': {
    source: require('../../../../../../assets/stickers/foodie/cheat-day.png'),
    width: 2042,
    height: 818,
  },
  'stickers/foodie/chef-mode.png': {
    source: require('../../../../../../assets/stickers/foodie/chef-mode.png'),
    width: 2043,
    height: 808,
  },
  'stickers/foodie/chefs-kiss.png': {
    source: require('../../../../../../assets/stickers/foodie/chefs-kiss.png'),
    width: 2043,
    height: 829,
  },
  'stickers/foodie/coffee-first.png': {
    source: require('../../../../../../assets/stickers/foodie/coffee-first.png'),
    width: 2043,
    height: 756,
  },
  'stickers/foodie/dessert-first.png': {
    source: require('../../../../../../assets/stickers/foodie/dessert-first.png'),
    width: 2043,
    height: 723,
  },
  'stickers/foodie/food-coma.png': {
    source: require('../../../../../../assets/stickers/foodie/food-coma.png'),
    width: 2042,
    height: 816,
  },
  'stickers/foodie/foodie.png': {
    source: require('../../../../../../assets/stickers/foodie/foodie.png'),
    width: 2045,
    height: 1081,
  },
  'stickers/foodie/fresh-from-the-oven.png': {
    source: require('../../../../../../assets/stickers/foodie/fresh-from-the-oven.png'),
    width: 2045,
    height: 1100,
  },
  'stickers/foodie/grill-master.png': {
    source: require('../../../../../../assets/stickers/foodie/grill-master.png'),
    width: 2046,
    height: 746,
  },
  'stickers/foodie/home-cooked.png': {
    source: require('../../../../../../assets/stickers/foodie/home-cooked.png'),
    width: 2046,
    height: 709,
  },
  'stickers/foodie/late-night-snack.png': {
    source: require('../../../../../../assets/stickers/foodie/late-night-snack.png'),
    width: 2046,
    height: 1119,
  },
  'stickers/foodie/leftovers-again.png': {
    source: require('../../../../../../assets/stickers/foodie/leftovers-again.png'),
    width: 2042,
    height: 1194,
  },
  'stickers/foodie/lunch-date.png': {
    source: require('../../../../../../assets/stickers/foodie/lunch-date.png'),
    width: 2042,
    height: 772,
  },
  'stickers/foodie/meal-prep.png': {
    source: require('../../../../../../assets/stickers/foodie/meal-prep.png'),
    width: 2047,
    height: 812,
  },
  'stickers/foodie/new-cafe.png': {
    source: require('../../../../../../assets/stickers/foodie/new-cafe.png'),
    width: 2042,
    height: 849,
  },
  'stickers/foodie/picnic.png': {
    source: require('../../../../../../assets/stickers/foodie/picnic.png'),
    width: 2040,
    height: 1127,
  },
  'stickers/foodie/pizza-party.png': {
    source: require('../../../../../../assets/stickers/foodie/pizza-party.png'),
    width: 2048,
    height: 746,
  },
  'stickers/foodie/ramen-night.png': {
    source: require('../../../../../../assets/stickers/foodie/ramen-night.png'),
    width: 2045,
    height: 721,
  },
  'stickers/foodie/second-helping.png': {
    source: require('../../../../../../assets/stickers/foodie/second-helping.png'),
    width: 2044,
    height: 1382,
  },
  'stickers/foodie/spicy.png': {
    source: require('../../../../../../assets/stickers/foodie/spicy.png'),
    width: 2041,
    height: 1122,
  },
  'stickers/foodie/street-food.png': {
    source: require('../../../../../../assets/stickers/foodie/street-food.png'),
    width: 2047,
    height: 769,
  },
  'stickers/foodie/sushi-date.png': {
    source: require('../../../../../../assets/stickers/foodie/sushi-date.png'),
    width: 2042,
    height: 824,
  },
  'stickers/foodie/taco-tuesday.png': {
    source: require('../../../../../../assets/stickers/foodie/taco-tuesday.png'),
    width: 2047,
    height: 708,
  },
  'stickers/foodie/taste-test.png': {
    source: require('../../../../../../assets/stickers/foodie/taste-test.png'),
    width: 2042,
    height: 846,
  },
  'stickers/foodie/tea-time.png': {
    source: require('../../../../../../assets/stickers/foodie/tea-time.png'),
    width: 2041,
    height: 922,
  },
  'stickers/foodie/treat-yourself.png': {
    source: require('../../../../../../assets/stickers/foodie/treat-yourself.png'),
    width: 2042,
    height: 1302,
  },
  'stickers/foodie/yum.png': {
    source: require('../../../../../../assets/stickers/foodie/yum.png'),
    width: 2039,
    height: 1312,
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
  'stickers/gen-z/bestie.png': {
    source: require('../../../../../../assets/stickers/gen-z/bestie.png'),
    width: 2008,
    height: 968,
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
  'stickers/gen-z/big-w.png': {
    source: require('../../../../../../assets/stickers/gen-z/big-w.png'),
    width: 1936,
    height: 968,
  },
  'stickers/gen-z/bussin.png': {
    source: require('../../../../../../assets/stickers/gen-z/bussin.png'),
    width: 2045,
    height: 927,
  },
  'stickers/gen-z/caught-in-4k.png': {
    source: require('../../../../../../assets/stickers/gen-z/caught-in-4k.png'),
    width: 2048,
    height: 609,
  },
  'stickers/gen-z/core-memory.png': {
    source: require('../../../../../../assets/stickers/gen-z/core-memory.png'),
    width: 2045,
    height: 604,
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
  'stickers/gen-z/era-unlocked.png': {
    source: require('../../../../../../assets/stickers/gen-z/era-unlocked.png'),
    width: 2046,
    height: 589,
  },
  'stickers/gen-z/girl-dinner.png': {
    source: require('../../../../../../assets/stickers/gen-z/girl-dinner.png'),
    width: 2047,
    height: 657,
  },
  'stickers/gen-z/glow-up.png': {
    source: require('../../../../../../assets/stickers/gen-z/glow-up.png'),
    width: 2045,
    height: 809,
  },
  'stickers/gen-z/hard-launch.png': {
    source: require('../../../../../../assets/stickers/gen-z/hard-launch.png'),
    width: 2048,
    height: 613,
  },
  'stickers/gen-z/highkey.png': {
    source: require('../../../../../../assets/stickers/gen-z/highkey.png'),
    width: 2045,
    height: 841,
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
  'stickers/gen-z/its-a-vibe.png': {
    source: require('../../../../../../assets/stickers/gen-z/its-a-vibe.png'),
    width: 2048,
    height: 727,
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
  'stickers/gen-z/mother.png': {
    source: require('../../../../../../assets/stickers/gen-z/mother.png'),
    width: 2043,
    height: 870,
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
  'stickers/gen-z/periodt.png': {
    source: require('../../../../../../assets/stickers/gen-z/periodt.png'),
    width: 2045,
    height: 859,
  },
  'stickers/gen-z/purr.png': {
    source: require('../../../../../../assets/stickers/gen-z/purr.png'),
    width: 1824,
    height: 968,
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
  'stickers/gen-z/say-less.png': {
    source: require('../../../../../../assets/stickers/gen-z/say-less.png'),
    width: 2048,
    height: 823,
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
  'stickers/gen-z/soft-launch.png': {
    source: require('../../../../../../assets/stickers/gen-z/soft-launch.png'),
    width: 2046,
    height: 630,
  },
  'stickers/gen-z/the-ick.png': {
    source: require('../../../../../../assets/stickers/gen-z/the-ick.png'),
    width: 2047,
    height: 907,
  },
  'stickers/gen-z/touch-grass.png': {
    source: require('../../../../../../assets/stickers/gen-z/touch-grass.png'),
    width: 2046,
    height: 622,
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
  'stickers/gym/10k-done.png': {
    source: require('../../../../../../assets/stickers/gym/10k-done.png'),
    width: 2045,
    height: 885,
  },
  'stickers/gym/5-am-club.png': {
    source: require('../../../../../../assets/stickers/gym/5-am-club.png'),
    width: 2042,
    height: 829,
  },
  'stickers/gym/arm-day.png': {
    source: require('../../../../../../assets/stickers/gym/arm-day.png'),
    width: 2046,
    height: 932,
  },
  'stickers/gym/beast-mode.png': {
    source: require('../../../../../../assets/stickers/gym/beast-mode.png'),
    width: 2045,
    height: 764,
  },
  'stickers/gym/cardio-done.png': {
    source: require('../../../../../../assets/stickers/gym/cardio-done.png'),
    width: 2046,
    height: 734,
  },
  'stickers/gym/consistency.png': {
    source: require('../../../../../../assets/stickers/gym/consistency.png'),
    width: 2042,
    height: 743,
  },
  'stickers/gym/earned-this-meal.png': {
    source: require('../../../../../../assets/stickers/gym/earned-this-meal.png'),
    width: 2041,
    height: 1209,
  },
  'stickers/gym/gym-buddy.png': {
    source: require('../../../../../../assets/stickers/gym/gym-buddy.png'),
    width: 2046,
    height: 804,
  },
  'stickers/gym/gym-fit.png': {
    source: require('../../../../../../assets/stickers/gym/gym-fit.png'),
    width: 2045,
    height: 991,
  },
  'stickers/gym/gym-selfie.png': {
    source: require('../../../../../../assets/stickers/gym/gym-selfie.png'),
    width: 2045,
    height: 817,
  },
  'stickers/gym/hydrate.png': {
    source: require('../../../../../../assets/stickers/gym/hydrate.png'),
    width: 2041,
    height: 969,
  },
  'stickers/gym/leg-day.png': {
    source: require('../../../../../../assets/stickers/gym/leg-day.png'),
    width: 2042,
    height: 993,
  },
  'stickers/gym/lift-heavy.png': {
    source: require('../../../../../../assets/stickers/gym/lift-heavy.png'),
    width: 2043,
    height: 849,
  },
  'stickers/gym/new-pr.png': {
    source: require('../../../../../../assets/stickers/gym/new-pr.png'),
    width: 2043,
    height: 1026,
  },
  'stickers/gym/no-pain-no-gain.png': {
    source: require('../../../../../../assets/stickers/gym/no-pain-no-gain.png'),
    width: 2042,
    height: 1353,
  },
  'stickers/gym/one-more-rep.png': {
    source: require('../../../../../../assets/stickers/gym/one-more-rep.png'),
    width: 2048,
    height: 683,
  },
  'stickers/gym/pilates.png': {
    source: require('../../../../../../assets/stickers/gym/pilates.png'),
    width: 2042,
    height: 1042,
  },
  'stickers/gym/post-workout-glow.png': {
    source: require('../../../../../../assets/stickers/gym/post-workout-glow.png'),
    width: 2045,
    height: 931,
  },
  'stickers/gym/pre-workout.png': {
    source: require('../../../../../../assets/stickers/gym/pre-workout.png'),
    width: 2046,
    height: 705,
  },
  'stickers/gym/progress-not-perfection.png': {
    source: require('../../../../../../assets/stickers/gym/progress-not-perfection.png'),
    width: 2043,
    height: 953,
  },
  'stickers/gym/protein-first.png': {
    source: require('../../../../../../assets/stickers/gym/protein-first.png'),
    width: 2044,
    height: 702,
  },
  'stickers/gym/rest-day.png': {
    source: require('../../../../../../assets/stickers/gym/rest-day.png'),
    width: 2042,
    height: 913,
  },
  'stickers/gym/run-club.png': {
    source: require('../../../../../../assets/stickers/gym/run-club.png'),
    width: 2048,
    height: 903,
  },
  'stickers/gym/skipped-leg-day.png': {
    source: require('../../../../../../assets/stickers/gym/skipped-leg-day.png'),
    width: 2042,
    height: 1396,
  },
  'stickers/gym/sore-today.png': {
    source: require('../../../../../../assets/stickers/gym/sore-today.png'),
    width: 2043,
    height: 778,
  },
  'stickers/gym/spotter-needed.png': {
    source: require('../../../../../../assets/stickers/gym/spotter-needed.png'),
    width: 2046,
    height: 1366,
  },
  'stickers/gym/stretch-it-out.png': {
    source: require('../../../../../../assets/stickers/gym/stretch-it-out.png'),
    width: 2045,
    height: 1371,
  },
  'stickers/gym/strong-not-skinny.png': {
    source: require('../../../../../../assets/stickers/gym/strong-not-skinny.png'),
    width: 2045,
    height: 1066,
  },
  'stickers/gym/sweaty-but-happy.png': {
    source: require('../../../../../../assets/stickers/gym/sweaty-but-happy.png'),
    width: 2045,
    height: 1191,
  },
  'stickers/gym/yoga-flow.png': {
    source: require('../../../../../../assets/stickers/gym/yoga-flow.png'),
    width: 2047,
    height: 812,
  },
  'stickers/hashtags/beach-pa.png': {
    source: require('../../../../../../assets/stickers/hashtags/beach-pa.png'),
    width: 538,
    height: 340,
  },
  'stickers/hashtags/blessed.png': {
    source: require('../../../../../../assets/stickers/hashtags/blessed.png'),
    width: 1928,
    height: 1376,
  },
  'stickers/hashtags/bonding.png': {
    source: require('../../../../../../assets/stickers/hashtags/bonding.png'),
    width: 1984,
    height: 1368,
  },
  'stickers/hashtags/budol.png': {
    source: require('../../../../../../assets/stickers/hashtags/budol.png'),
    width: 1648,
    height: 1360,
  },
  'stickers/hashtags/charot.png': {
    source: require('../../../../../../assets/stickers/hashtags/charot.png'),
    width: 1840,
    height: 1360,
  },
  'stickers/hashtags/exam-na.png': {
    source: require('../../../../../../assets/stickers/hashtags/exam-na.png'),
    width: 600,
    height: 450,
  },
  'stickers/hashtags/foodtrip.png': {
    source: require('../../../../../../assets/stickers/hashtags/foodtrip.png'),
    width: 2042,
    height: 1500,
  },
  'stickers/hashtags/gala.png': {
    source: require('../../../../../../assets/stickers/hashtags/gala.png'),
    width: 374,
    height: 340,
  },
  'stickers/hashtags/ganap.png': {
    source: require('../../../../../../assets/stickers/hashtags/ganap.png'),
    width: 1848,
    height: 1328,
  },
  'stickers/hashtags/grateful.png': {
    source: require('../../../../../../assets/stickers/hashtags/grateful.png'),
    width: 2043,
    height: 1279,
  },
  'stickers/hashtags/gym-time.png': {
    source: require('../../../../../../assets/stickers/hashtags/gym-time.png'),
    width: 2046,
    height: 1319,
  },
  'stickers/hashtags/happy-weekend.png': {
    source: require('../../../../../../assets/stickers/hashtags/happy-weekend.png'),
    width: 712,
    height: 362,
  },
  'stickers/hashtags/ipon.png': {
    source: require('../../../../../../assets/stickers/hashtags/ipon.png'),
    width: 1776,
    height: 1616,
  },
  'stickers/hashtags/kain-tayo.png': {
    source: require('../../../../../../assets/stickers/hashtags/kain-tayo.png'),
    width: 564,
    height: 342,
  },
  'stickers/hashtags/kape-muna.png': {
    source: require('../../../../../../assets/stickers/hashtags/kape-muna.png'),
    width: 2047,
    height: 1186,
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
  'stickers/hashtags/mood.png': {
    source: require('../../../../../../assets/stickers/hashtags/mood.png'),
    width: 1952,
    height: 1776,
  },
  'stickers/hashtags/ootd.png': {
    source: require('../../../../../../assets/stickers/hashtags/ootd.png'),
    width: 1680,
    height: 1344,
  },
  'stickers/hashtags/pasyal.png': {
    source: require('../../../../../../assets/stickers/hashtags/pasyal.png'),
    width: 2045,
    height: 1697,
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
  'stickers/hashtags/self-love.png': {
    source: require('../../../../../../assets/stickers/hashtags/self-love.png'),
    width: 2046,
    height: 1432,
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
  'stickers/olivia/good-morning.png': {
    source: require('../../../../../../assets/stickers/olivia/good-morning.png'),
    width: 930,
    height: 1024,
  },
  'stickers/olivia/window-watch.png': {
    source: require('../../../../../../assets/stickers/olivia/window-watch.png'),
    width: 882,
    height: 1024,
  },
  'stickers/olivia/keyboard-cat.png': {
    source: require('../../../../../../assets/stickers/olivia/keyboard-cat.png'),
    width: 1024,
    height: 799,
  },
  'stickers/olivia/sun-puddle.png': {
    source: require('../../../../../../assets/stickers/olivia/sun-puddle.png'),
    width: 1024,
    height: 931,
  },
  'stickers/olivia/night-owl.png': {
    source: require('../../../../../../assets/stickers/olivia/night-owl.png'),
    width: 1024,
    height: 1015,
  },
  'stickers/olivia/selfie.png': {
    source: require('../../../../../../assets/stickers/olivia/selfie.png'),
    width: 907,
    height: 1024,
  },
  'stickers/olivia/lady-queen.png': {
    source: require('../../../../../../assets/stickers/olivia/lady-queen.png'),
    width: 941,
    height: 1024,
  },
  'stickers/olivia/cuddle-buddy.png': {
    source: require('../../../../../../assets/stickers/olivia/cuddle-buddy.png'),
    width: 1024,
    height: 873,
  },
  'stickers/olivia/bath-time-no.png': {
    source: require('../../../../../../assets/stickers/olivia/bath-time-no.png'),
    width: 916,
    height: 1024,
  },
  'stickers/olivia/if-i-fits.png': {
    source: require('../../../../../../assets/stickers/olivia/if-i-fits.png'),
    width: 1024,
    height: 1013,
  },
  'stickers/olivia/laundry-queen.png': {
    source: require('../../../../../../assets/stickers/olivia/laundry-queen.png'),
    width: 898,
    height: 1024,
  },
  'stickers/olivia/hunting-mode.png': {
    source: require('../../../../../../assets/stickers/olivia/hunting-mode.png'),
    width: 1010,
    height: 1024,
  },
  'stickers/olivia/judging-you.png': {
    source: require('../../../../../../assets/stickers/olivia/judging-you.png'),
    width: 831,
    height: 1024,
  },
  'stickers/olivia/tv-time.png': {
    source: require('../../../../../../assets/stickers/olivia/tv-time.png'),
    width: 1024,
    height: 929,
  },
  'stickers/parents/babys-first.png': {
    source: require('../../../../../../assets/stickers/parents/babys-first.png'),
    width: 2047,
    height: 723,
  },
  'stickers/parents/bath-time.png': {
    source: require('../../../../../../assets/stickers/parents/bath-time.png'),
    width: 2043,
    height: 792,
  },
  'stickers/parents/bedtime-story.png': {
    source: require('../../../../../../assets/stickers/parents/bedtime-story.png'),
    width: 2044,
    height: 624,
  },
  'stickers/parents/coffee-is-life.png': {
    source: require('../../../../../../assets/stickers/parents/coffee-is-life.png'),
    width: 2046,
    height: 1375,
  },
  'stickers/parents/dad-life.png': {
    source: require('../../../../../../assets/stickers/parents/dad-life.png'),
    width: 2045,
    height: 901,
  },
  'stickers/parents/family-day.png': {
    source: require('../../../../../../assets/stickers/parents/family-day.png'),
    width: 2047,
    height: 745,
  },
  'stickers/parents/family-dinner.png': {
    source: require('../../../../../../assets/stickers/parents/family-dinner.png'),
    width: 2047,
    height: 643,
  },
  'stickers/parents/family-photo.png': {
    source: require('../../../../../../assets/stickers/parents/family-photo.png'),
    width: 2043,
    height: 663,
  },
  'stickers/parents/first-steps.png': {
    source: require('../../../../../../assets/stickers/parents/first-steps.png'),
    width: 2047,
    height: 754,
  },
  'stickers/parents/growing-up-fast.png': {
    source: require('../../../../../../assets/stickers/parents/growing-up-fast.png'),
    width: 2041,
    height: 1217,
  },
  'stickers/parents/homework-helper.png': {
    source: require('../../../../../../assets/stickers/parents/homework-helper.png'),
    width: 2046,
    height: 1062,
  },
  'stickers/parents/laundry-mountain.png': {
    source: require('../../../../../../assets/stickers/parents/laundry-mountain.png'),
    width: 2044,
    height: 1129,
  },
  'stickers/parents/little-helper.png': {
    source: require('../../../../../../assets/stickers/parents/little-helper.png'),
    width: 2046,
    height: 684,
  },
  'stickers/parents/lola-and-lolo.png': {
    source: require('../../../../../../assets/stickers/parents/lola-and-lolo.png'),
    width: 2043,
    height: 632,
  },
  'stickers/parents/love-you-more.png': {
    source: require('../../../../../../assets/stickers/parents/love-you-more.png'),
    width: 2044,
    height: 599,
  },
  'stickers/parents/messy-house-happy-kids.png': {
    source: require('../../../../../../assets/stickers/parents/messy-house-happy-kids.png'),
    width: 2047,
    height: 902,
  },
  'stickers/parents/mini-me.png': {
    source: require('../../../../../../assets/stickers/parents/mini-me.png'),
    width: 2045,
    height: 911,
  },
  'stickers/parents/mom-life.png': {
    source: require('../../../../../../assets/stickers/parents/mom-life.png'),
    width: 2042,
    height: 850,
  },
  'stickers/parents/nap-time.png': {
    source: require('../../../../../../assets/stickers/parents/nap-time.png'),
    width: 2045,
    height: 836,
  },
  'stickers/parents/parenting-win.png': {
    source: require('../../../../../../assets/stickers/parents/parenting-win.png'),
    width: 2045,
    height: 634,
  },
  'stickers/parents/park-day.png': {
    source: require('../../../../../../assets/stickers/parents/park-day.png'),
    width: 2041,
    height: 838,
  },
  'stickers/parents/playdate.png': {
    source: require('../../../../../../assets/stickers/parents/playdate.png'),
    width: 2042,
    height: 844,
  },
  'stickers/parents/proud-parent.png': {
    source: require('../../../../../../assets/stickers/parents/proud-parent.png'),
    width: 2047,
    height: 655,
  },
  'stickers/parents/quiet-time.png': {
    source: require('../../../../../../assets/stickers/parents/quiet-time.png'),
    width: 2047,
    height: 754,
  },
  'stickers/parents/school-run.png': {
    source: require('../../../../../../assets/stickers/parents/school-run.png'),
    width: 2042,
    height: 748,
  },
  'stickers/parents/snack-duty.png': {
    source: require('../../../../../../assets/stickers/parents/snack-duty.png'),
    width: 2046,
    height: 729,
  },
  'stickers/parents/super-dad.png': {
    source: require('../../../../../../assets/stickers/parents/super-dad.png'),
    width: 2043,
    height: 779,
  },
  'stickers/parents/super-mom.png': {
    source: require('../../../../../../assets/stickers/parents/super-mom.png'),
    width: 2043,
    height: 732,
  },
  'stickers/parents/tantrum-survived.png': {
    source: require('../../../../../../assets/stickers/parents/tantrum-survived.png'),
    width: 2043,
    height: 1188,
  },
  'stickers/parents/weekend-with-the-kids.png': {
    source: require('../../../../../../assets/stickers/parents/weekend-with-the-kids.png'),
    width: 2045,
    height: 867,
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
  'stickers/pride/ace-pride.png': {
    source: require('../../../../../../assets/stickers/pride/ace-pride.png'),
    width: 2046,
    height: 690,
  },
  'stickers/pride/ally-always.png': {
    source: require('../../../../../../assets/stickers/pride/ally-always.png'),
    width: 2044,
    height: 583,
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
  'stickers/pride/bi-pride.png': {
    source: require('../../../../../../assets/stickers/pride/bi-pride.png'),
    width: 2048,
    height: 748,
  },
  'stickers/pride/celebrate-love.png': {
    source: require('../../../../../../assets/stickers/pride/celebrate-love.png'),
    width: 2047,
    height: 905,
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
  'stickers/pride/different-is-beautiful.png': {
    source: require('../../../../../../assets/stickers/pride/different-is-beautiful.png'),
    width: 2044,
    height: 774,
  },
  'stickers/pride/equal-love.png': {
    source: require('../../../../../../assets/stickers/pride/equal-love.png'),
    width: 2044,
    height: 625,
  },
  'stickers/pride/free-to-be-me.png': {
    source: require('../../../../../../assets/stickers/pride/free-to-be-me.png'),
    width: 2045,
    height: 553,
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
  'stickers/pride/gay-and-proud.png': {
    source: require('../../../../../../assets/stickers/pride/gay-and-proud.png'),
    width: 2046,
    height: 521,
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
  'stickers/pride/lesbian-love.png': {
    source: require('../../../../../../assets/stickers/pride/lesbian-love.png'),
    width: 2045,
    height: 553,
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
  'stickers/pride/love-out-loud.png': {
    source: require('../../../../../../assets/stickers/pride/love-out-loud.png'),
    width: 2047,
    height: 525,
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
  'stickers/pride/nonbinary-and-proud.png': {
    source: require('../../../../../../assets/stickers/pride/nonbinary-and-proud.png'),
    width: 2046,
    height: 870,
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
  'stickers/pride/pan-pride.png': {
    source: require('../../../../../../assets/stickers/pride/pan-pride.png'),
    width: 2043,
    height: 679,
  },
  'stickers/pride/pride-all-year.png': {
    source: require('../../../../../../assets/stickers/pride/pride-all-year.png'),
    width: 2044,
    height: 994,
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
  'stickers/pride/proud-of-you.png': {
    source: require('../../../../../../assets/stickers/pride/proud-of-you.png'),
    width: 2046,
    height: 559,
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
  'stickers/pride/rainbow-family.png': {
    source: require('../../../../../../assets/stickers/pride/rainbow-family.png'),
    width: 2046,
    height: 1013,
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
  'stickers/pride/trans-joy.png': {
    source: require('../../../../../../assets/stickers/pride/trans-joy.png'),
    width: 2046,
    height: 674,
  },
  'stickers/pride/you-are-valid.png': {
    source: require('../../../../../../assets/stickers/pride/you-are-valid.png'),
    width: 2045,
    height: 529,
  },
  'stickers/pride/you-belong.png': {
    source: require('../../../../../../assets/stickers/pride/you-belong.png'),
    width: 2046,
    height: 619,
  },
  'stickers/stamps/100-real.png': {
    source: require('../../../../../../assets/stickers/stamps/100-real.png'),
    width: 1840,
    height: 632,
  },
  'stickers/stamps/approved.png': {
    source: require('../../../../../../assets/stickers/stamps/approved.png'),
    width: 1824,
    height: 632,
  },
  'stickers/stamps/behind-the-scenes.png': {
    source: require('../../../../../../assets/stickers/stamps/behind-the-scenes.png'),
    width: 2046,
    height: 448,
  },
  'stickers/stamps/big-day.png': {
    source: require('../../../../../../assets/stickers/stamps/big-day.png'),
    width: 2041,
    height: 876,
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
  'stickers/stamps/done.png': {
    source: require('../../../../../../assets/stickers/stamps/done.png'),
    width: 2035,
    height: 1072,
  },
  'stickers/stamps/first-time.png': {
    source: require('../../../../../../assets/stickers/stamps/first-time.png'),
    width: 1784,
    height: 632,
  },
  'stickers/stamps/good-day.png': {
    source: require('../../../../../../assets/stickers/stamps/good-day.png'),
    width: 1808,
    height: 632,
  },
  'stickers/stamps/grateful.png': {
    source: require('../../../../../../assets/stickers/stamps/grateful.png'),
    width: 1728,
    height: 632,
  },
  'stickers/stamps/hello.png': {
    source: require('../../../../../../assets/stickers/stamps/hello.png'),
    width: 2042,
    height: 1002,
  },
  'stickers/stamps/homebody.png': {
    source: require('../../../../../../assets/stickers/stamps/homebody.png'),
    width: 1920,
    height: 632,
  },
  'stickers/stamps/jar-number.png': {
    source: require('../../../../../../assets/stickers/stamps/jar-number.png'),
    width: 567,
    height: 240,
  },
  'stickers/stamps/keep-this.png': {
    source: require('../../../../../../assets/stickers/stamps/keep-this.png'),
    width: 1696,
    height: 632,
  },
  'stickers/stamps/lazy-day.png': {
    source: require('../../../../../../assets/stickers/stamps/lazy-day.png'),
    width: 1640,
    height: 632,
  },
  'stickers/stamps/long-day.png': {
    source: require('../../../../../../assets/stickers/stamps/long-day.png'),
    width: 1736,
    height: 632,
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
  'stickers/stamps/ordinary-day.png': {
    source: require('../../../../../../assets/stickers/stamps/ordinary-day.png'),
    width: 2045,
    height: 561,
  },
  'stickers/stamps/out-and-about.png': {
    source: require('../../../../../../assets/stickers/stamps/out-and-about.png'),
    width: 2042,
    height: 524,
  },
  'stickers/stamps/payday.png': {
    source: require('../../../../../../assets/stickers/stamps/payday.png'),
    width: 2041,
    height: 891,
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
  'stickers/stamps/sick-day.png': {
    source: require('../../../../../../assets/stickers/stamps/sick-day.png'),
    width: 1616,
    height: 632,
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
  'stickers/stamps/travel-day.png': {
    source: require('../../../../../../assets/stickers/stamps/travel-day.png'),
    width: 1936,
    height: 632,
  },
  'stickers/stamps/unplanned.png': {
    source: require('../../../../../../assets/stickers/stamps/unplanned.png'),
    width: 1968,
    height: 632,
  },
  'stickers/stamps/weekend.png': {
    source: require('../../../../../../assets/stickers/stamps/weekend.png'),
    width: 1672,
    height: 632,
  },
  'stickers/stamps/win.png': {
    source: require('../../../../../../assets/stickers/stamps/win.png'),
    width: 2000,
    height: 1264,
  },
  'stickers/student/all-nighter.png': {
    source: require('../../../../../../assets/stickers/student/all-nighter.png'),
    width: 2045,
    height: 772,
  },
  'stickers/student/back-to-school.png': {
    source: require('../../../../../../assets/stickers/student/back-to-school.png'),
    width: 2044,
    height: 1335,
  },
  'stickers/student/brain-fried.png': {
    source: require('../../../../../../assets/stickers/student/brain-fried.png'),
    width: 2044,
    height: 769,
  },
  'stickers/student/campus-life.png': {
    source: require('../../../../../../assets/stickers/student/campus-life.png'),
    width: 2044,
    height: 737,
  },
  'stickers/student/class-is-cancelled.png': {
    source: require('../../../../../../assets/stickers/student/class-is-cancelled.png'),
    width: 2045,
    height: 1199,
  },
  'stickers/student/classmates.png': {
    source: require('../../../../../../assets/stickers/student/classmates.png'),
    width: 2044,
    height: 753,
  },
  'stickers/student/coffee-and-homework.png': {
    source: require('../../../../../../assets/stickers/student/coffee-and-homework.png'),
    width: 2043,
    height: 1049,
  },
  'stickers/student/deans-list.png': {
    source: require('../../../../../../assets/stickers/student/deans-list.png'),
    width: 2048,
    height: 775,
  },
  'stickers/student/due-tomorrow.png': {
    source: require('../../../../../../assets/stickers/student/due-tomorrow.png'),
    width: 2045,
    height: 620,
  },
  'stickers/student/exam-week.png': {
    source: require('../../../../../../assets/stickers/student/exam-week.png'),
    width: 2047,
    height: 713,
  },
  'stickers/student/field-trip.png': {
    source: require('../../../../../../assets/stickers/student/field-trip.png'),
    width: 2048,
    height: 837,
  },
  'stickers/student/finals.png': {
    source: require('../../../../../../assets/stickers/student/finals.png'),
    width: 2041,
    height: 1101,
  },
  'stickers/student/first-day.png': {
    source: require('../../../../../../assets/stickers/student/first-day.png'),
    width: 2047,
    height: 842,
  },
  'stickers/student/graduation.png': {
    source: require('../../../../../../assets/stickers/student/graduation.png'),
    width: 2048,
    height: 737,
  },
  'stickers/student/group-project.png': {
    source: require('../../../../../../assets/stickers/student/group-project.png'),
    width: 2047,
    height: 649,
  },
  'stickers/student/highlighter-gang.png': {
    source: require('../../../../../../assets/stickers/student/highlighter-gang.png'),
    width: 2042,
    height: 1042,
  },
  'stickers/student/lab-day.png': {
    source: require('../../../../../../assets/stickers/student/lab-day.png'),
    width: 2045,
    height: 901,
  },
  'stickers/student/library-day.png': {
    source: require('../../../../../../assets/stickers/student/library-day.png'),
    width: 2045,
    height: 727,
  },
  'stickers/student/nap-between-classes.png': {
    source: require('../../../../../../assets/stickers/student/nap-between-classes.png'),
    width: 2046,
    height: 910,
  },
  'stickers/student/notes-ready.png': {
    source: require('../../../../../../assets/stickers/student/notes-ready.png'),
    width: 2048,
    height: 685,
  },
  'stickers/student/passed.png': {
    source: require('../../../../../../assets/stickers/student/passed.png'),
    width: 2045,
    height: 939,
  },
  'stickers/student/pop-quiz.png': {
    source: require('../../../../../../assets/stickers/student/pop-quiz.png'),
    width: 2045,
    height: 871,
  },
  'stickers/student/recess.png': {
    source: require('../../../../../../assets/stickers/student/recess.png'),
    width: 2041,
    height: 1042,
  },
  'stickers/student/report-card.png': {
    source: require('../../../../../../assets/stickers/student/report-card.png'),
    width: 2046,
    height: 713,
  },
  'stickers/student/semester-done.png': {
    source: require('../../../../../../assets/stickers/student/semester-done.png'),
    width: 2048,
    height: 608,
  },
  'stickers/student/study-buddy.png': {
    source: require('../../../../../../assets/stickers/student/study-buddy.png'),
    width: 2047,
    height: 675,
  },
  'stickers/student/study-mode.png': {
    source: require('../../../../../../assets/stickers/student/study-mode.png'),
    width: 2045,
    height: 705,
  },
  'stickers/student/summer-break.png': {
    source: require('../../../../../../assets/stickers/student/summer-break.png'),
    width: 2045,
    height: 632,
  },
  'stickers/student/thesis-mode.png': {
    source: require('../../../../../../assets/stickers/student/thesis-mode.png'),
    width: 2044,
    height: 706,
  },
  'stickers/student/uniform-day.png': {
    source: require('../../../../../../assets/stickers/student/uniform-day.png'),
    width: 2043,
    height: 700,
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
  'stickers/travel/airport-mode.png': {
    source: require('../../../../../../assets/stickers/travel/airport-mode.png'),
    width: 2044,
    height: 643,
  },
  'stickers/travel/backpacker.png': {
    source: require('../../../../../../assets/stickers/travel/backpacker.png'),
    width: 2042,
    height: 712,
  },
  'stickers/travel/beach-day.png': {
    source: require('../../../../../../assets/stickers/travel/beach-day.png'),
    width: 2045,
    height: 794,
  },
  'stickers/travel/bon-voyage.png': {
    source: require('../../../../../../assets/stickers/travel/bon-voyage.png'),
    width: 2048,
    height: 726,
  },
  'stickers/travel/camping.png': {
    source: require('../../../../../../assets/stickers/travel/camping.png'),
    width: 2044,
    height: 881,
  },
  'stickers/travel/city-lights.png': {
    source: require('../../../../../../assets/stickers/travel/city-lights.png'),
    width: 2044,
    height: 744,
  },
  'stickers/travel/ferry-ride.png': {
    source: require('../../../../../../assets/stickers/travel/ferry-ride.png'),
    width: 2045,
    height: 785,
  },
  'stickers/travel/hiking-day.png': {
    source: require('../../../../../../assets/stickers/travel/hiking-day.png'),
    width: 2045,
    height: 763,
  },
  'stickers/travel/home-sweet-home.png': {
    source: require('../../../../../../assets/stickers/travel/home-sweet-home.png'),
    width: 2045,
    height: 966,
  },
  'stickers/travel/homesick.png': {
    source: require('../../../../../../assets/stickers/travel/homesick.png'),
    width: 2046,
    height: 818,
  },
  'stickers/travel/hotel-check-in.png': {
    source: require('../../../../../../assets/stickers/travel/hotel-check-in.png'),
    width: 2044,
    height: 1194,
  },
  'stickers/travel/jet-lag.png': {
    source: require('../../../../../../assets/stickers/travel/jet-lag.png'),
    width: 2042,
    height: 899,
  },
  'stickers/travel/local-eats.png': {
    source: require('../../../../../../assets/stickers/travel/local-eats.png'),
    width: 2048,
    height: 741,
  },
  'stickers/travel/lost-but-happy.png': {
    source: require('../../../../../../assets/stickers/travel/lost-but-happy.png'),
    width: 2041,
    height: 1188,
  },
  'stickers/travel/mountain-air.png': {
    source: require('../../../../../../assets/stickers/travel/mountain-air.png'),
    width: 2047,
    height: 649,
  },
  'stickers/travel/new-city.png': {
    source: require('../../../../../../assets/stickers/travel/new-city.png'),
    width: 2044,
    height: 860,
  },
  'stickers/travel/out-of-office.png': {
    source: require('../../../../../../assets/stickers/travel/out-of-office.png'),
    width: 2044,
    height: 636,
  },
  'stickers/travel/passport-ready.png': {
    source: require('../../../../../../assets/stickers/travel/passport-ready.png'),
    width: 2041,
    height: 1197,
  },
  'stickers/travel/postcard-view.png': {
    source: require('../../../../../../assets/stickers/travel/postcard-view.png'),
    width: 2047,
    height: 623,
  },
  'stickers/travel/road-trip.png': {
    source: require('../../../../../../assets/stickers/travel/road-trip.png'),
    width: 2042,
    height: 806,
  },
  'stickers/travel/solo-trip.png': {
    source: require('../../../../../../assets/stickers/travel/solo-trip.png'),
    width: 2043,
    height: 807,
  },
  'stickers/travel/souvenir-hunt.png': {
    source: require('../../../../../../assets/stickers/travel/souvenir-hunt.png'),
    width: 2045,
    height: 627,
  },
  'stickers/travel/sunset-chaser.png': {
    source: require('../../../../../../assets/stickers/travel/sunset-chaser.png'),
    width: 2046,
    height: 629,
  },
  'stickers/travel/tourist-mode.png': {
    source: require('../../../../../../assets/stickers/travel/tourist-mode.png'),
    width: 2045,
    height: 651,
  },
  'stickers/travel/train-ride.png': {
    source: require('../../../../../../assets/stickers/travel/train-ride.png'),
    width: 2042,
    height: 778,
  },
  'stickers/travel/travel-buddy.png': {
    source: require('../../../../../../assets/stickers/travel/travel-buddy.png'),
    width: 2043,
    height: 674,
  },
  'stickers/travel/vacation-mode.png': {
    source: require('../../../../../../assets/stickers/travel/vacation-mode.png'),
    width: 2048,
    height: 614,
  },
  'stickers/travel/wanderlust.png': {
    source: require('../../../../../../assets/stickers/travel/wanderlust.png'),
    width: 2044,
    height: 715,
  },
  'stickers/travel/weekend-getaway.png': {
    source: require('../../../../../../assets/stickers/travel/weekend-getaway.png'),
    width: 2045,
    height: 1195,
  },
  'stickers/travel/window-seat.png': {
    source: require('../../../../../../assets/stickers/travel/window-seat.png'),
    width: 2048,
    height: 666,
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
  'stickers/trentahin/emergency-fund.png': {
    source: require('../../../../../../assets/stickers/trentahin/emergency-fund.png'),
    width: 2046,
    height: 670,
  },
  'stickers/trentahin/grocery-date.png': {
    source: require('../../../../../../assets/stickers/trentahin/grocery-date.png'),
    width: 2045,
    height: 760,
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
  'stickers/trentahin/home-by-8.png': {
    source: require('../../../../../../assets/stickers/trentahin/home-by-8.png'),
    width: 2047,
    height: 832,
  },
  'stickers/trentahin/hydrate.png': {
    source: require('../../../../../../assets/stickers/trentahin/hydrate.png'),
    width: 2043,
    height: 991,
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
  'stickers/trentahin/laba-day.png': {
    source: require('../../../../../../assets/stickers/trentahin/laba-day.png'),
    width: 2047,
    height: 947,
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
  'stickers/trentahin/lumbar-support.png': {
    source: require('../../../../../../assets/stickers/trentahin/lumbar-support.png'),
    width: 2046,
    height: 652,
  },
  'stickers/trentahin/maintenance-meds.png': {
    source: require('../../../../../../assets/stickers/trentahin/maintenance-meds.png'),
    width: 2045,
    height: 592,
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
  'stickers/trentahin/ninang-era.png': {
    source: require('../../../../../../assets/stickers/trentahin/ninang-era.png'),
    width: 2043,
    height: 841,
  },
  'stickers/trentahin/pa-check-up.png': {
    source: require('../../../../../../assets/stickers/trentahin/pa-check-up.png'),
    width: 2045,
    height: 808,
  },
  'stickers/trentahin/pagod-pero-okay.png': {
    source: require('../../../../../../assets/stickers/trentahin/pagod-pero-okay.png'),
    width: 2045,
    height: 642,
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
  'stickers/trentahin/plans-cancelled-yay.png': {
    source: require('../../../../../../assets/stickers/trentahin/plans-cancelled-yay.png'),
    width: 2048,
    height: 1029,
  },
  'stickers/trentahin/plantita-era.png': {
    source: require('../../../../../../assets/stickers/trentahin/plantita-era.png'),
    width: 2046,
    height: 785,
  },
  'stickers/trentahin/quiet-weekend.png': {
    source: require('../../../../../../assets/stickers/trentahin/quiet-weekend.png'),
    width: 2047,
    height: 712,
  },
  'stickers/trentahin/sahod-bayad-ubos.png': {
    source: require('../../../../../../assets/stickers/trentahin/sahod-bayad-ubos.png'),
    width: 2048,
    height: 1193,
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
  'stickers/trentahin/thirty-and-thriving.png': {
    source: require('../../../../../../assets/stickers/trentahin/thirty-and-thriving.png'),
    width: 2046,
    height: 1226,
  },
  'stickers/trentahin/tuhod-check.png': {
    source: require('../../../../../../assets/stickers/trentahin/tuhod-check.png'),
    width: 2044,
    height: 800,
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
  'stickers/trentahin/vitamins-taken.png': {
    source: require('../../../../../../assets/stickers/trentahin/vitamins-taken.png'),
    width: 2043,
    height: 688,
  },
  'stickers/trentahin/walking-is-cardio.png': {
    source: require('../../../../../../assets/stickers/trentahin/walking-is-cardio.png'),
    width: 2041,
    height: 1403,
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
  'stickers/fish-moods/bored.png': {
    source: require('../../../../../../assets/stickers/fish-moods/bored.png'),
    width: 1024,
    height: 776,
  },
  'stickers/fish-moods/excited.png': {
    source: require('../../../../../../assets/stickers/fish-moods/excited.png'),
    width: 949,
    height: 1024,
  },
  'stickers/fish-moods/thinking.png': {
    source: require('../../../../../../assets/stickers/fish-moods/thinking.png'),
    width: 1024,
    height: 955,
  },
  'stickers/fish-moods/grateful.png': {
    source: require('../../../../../../assets/stickers/fish-moods/grateful.png'),
    width: 1024,
    height: 948,
  },
  'stickers/fish-moods/sorry.png': {
    source: require('../../../../../../assets/stickers/fish-moods/sorry.png'),
    width: 1024,
    height: 1003,
  },
  'stickers/fish-moods/hug-me.png': {
    source: require('../../../../../../assets/stickers/fish-moods/hug-me.png'),
    width: 989,
    height: 1024,
  },
  'stickers/fish-moods/determined.png': {
    source: require('../../../../../../assets/stickers/fish-moods/determined.png'),
    width: 1024,
    height: 1009,
  },
  'stickers/fish-moods/cold.png': {
    source: require('../../../../../../assets/stickers/fish-moods/cold.png'),
    width: 1024,
    height: 978,
  },
  'stickers/fish-moods/hot.png': {
    source: require('../../../../../../assets/stickers/fish-moods/hot.png'),
    width: 1024,
    height: 796,
  },
  'stickers/fish-moods/dizzy.png': {
    source: require('../../../../../../assets/stickers/fish-moods/dizzy.png'),
    width: 1011,
    height: 1024,
  },
  'stickers/fish-moods/eye-roll.png': {
    source: require('../../../../../../assets/stickers/fish-moods/eye-roll.png'),
    width: 1024,
    height: 937,
  },
  'stickers/fish-moods/wink.png': {
    source: require('../../../../../../assets/stickers/fish-moods/wink.png'),
    width: 1024,
    height: 1006,
  },
  'stickers/fish-moods/thumbs-up.png': {
    source: require('../../../../../../assets/stickers/fish-moods/thumbs-up.png'),
    width: 1024,
    height: 977,
  },
  'stickers/fish-moods/good-night.png': {
    source: require('../../../../../../assets/stickers/fish-moods/good-night.png'),
    width: 1024,
    height: 956,
  },
  'stickers/the-eight/beach-day.png': {
    source: require('../../../../../../assets/stickers/the-eight/beach-day.png'),
    width: 917,
    height: 1024,
  },
  'stickers/the-eight/mountain-view.png': {
    source: require('../../../../../../assets/stickers/the-eight/mountain-view.png'),
    width: 1024,
    height: 730,
  },
  'stickers/the-eight/art-time.png': {
    source: require('../../../../../../assets/stickers/the-eight/art-time.png'),
    width: 1024,
    height: 808,
  },
  'stickers/the-eight/cooking.png': {
    source: require('../../../../../../assets/stickers/the-eight/cooking.png'),
    width: 1024,
    height: 861,
  },
  'stickers/the-eight/best-buds.png': {
    source: require('../../../../../../assets/stickers/the-eight/best-buds.png'),
    width: 1024,
    height: 891,
  },
  'stickers/the-eight/duck-family.png': {
    source: require('../../../../../../assets/stickers/the-eight/duck-family.png'),
    width: 1024,
    height: 498,
  },
  'stickers/the-eight/fresh-tee.png': {
    source: require('../../../../../../assets/stickers/the-eight/fresh-tee.png'),
    width: 912,
    height: 1024,
  },
  'stickers/the-eight/bucket-hat.png': {
    source: require('../../../../../../assets/stickers/the-eight/bucket-hat.png'),
    width: 1024,
    height: 722,
  },
  'stickers/the-eight/selfie-phone.png': {
    source: require('../../../../../../assets/stickers/the-eight/selfie-phone.png'),
    width: 1024,
    height: 982,
  },
  'stickers/the-eight/mirror-check.png': {
    source: require('../../../../../../assets/stickers/the-eight/mirror-check.png'),
    width: 685,
    height: 1024,
  },
  'stickers/the-eight/latte.png': {
    source: require('../../../../../../assets/stickers/the-eight/latte.png'),
    width: 990,
    height: 1024,
  },
  'stickers/the-eight/ice-cream.png': {
    source: require('../../../../../../assets/stickers/the-eight/ice-cream.png'),
    width: 546,
    height: 1024,
  },
  'stickers/the-eight/ramen.png': {
    source: require('../../../../../../assets/stickers/the-eight/ramen.png'),
    width: 1024,
    height: 962,
  },
  'stickers/the-eight/sleepy-stars.png': {
    source: require('../../../../../../assets/stickers/the-eight/sleepy-stars.png'),
    width: 1024,
    height: 1020,
  },
  'stickers/pinoy-life/sinigang.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/sinigang.png'),
    width: 1024,
    height: 925,
  },
  'stickers/pinoy-life/turon.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/turon.png'),
    width: 1024,
    height: 700,
  },
  'stickers/pinoy-life/lumpia.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/lumpia.png'),
    width: 1024,
    height: 703,
  },
  'stickers/pinoy-life/sapin-sapin.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/sapin-sapin.png'),
    width: 1024,
    height: 732,
  },
  'stickers/pinoy-life/fishball.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/fishball.png'),
    width: 732,
    height: 1024,
  },
  'stickers/pinoy-life/sorbetes.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/sorbetes.png'),
    width: 1024,
    height: 699,
  },
  'stickers/pinoy-life/calamansi.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/calamansi.png'),
    width: 1005,
    height: 1024,
  },
  'stickers/pinoy-life/kalesa.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/kalesa.png'),
    width: 1024,
    height: 686,
  },
  'stickers/pinoy-life/bahay-kubo.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/bahay-kubo.png'),
    width: 1024,
    height: 868,
  },
  'stickers/pinoy-life/tsinelas.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/tsinelas.png'),
    width: 907,
    height: 1024,
  },
  'stickers/pinoy-life/tabo.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/tabo.png'),
    width: 1024,
    height: 831,
  },
  'stickers/pinoy-life/walis-tingting.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/walis-tingting.png'),
    width: 925,
    height: 1024,
  },
  'stickers/pinoy-life/banderitas.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/banderitas.png'),
    width: 1024,
    height: 377,
  },
  'stickers/pinoy-life/street-hoop.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/street-hoop.png'),
    width: 850,
    height: 1024,
  },
  'stickers/everyday/panda.png': {
    source: require('../../../../../../assets/stickers/everyday/panda.png'),
    width: 850,
    height: 1024,
  },
  'stickers/everyday/penguin.png': {
    source: require('../../../../../../assets/stickers/everyday/penguin.png'),
    width: 998,
    height: 1024,
  },
  'stickers/everyday/fox.png': {
    source: require('../../../../../../assets/stickers/everyday/fox.png'),
    width: 807,
    height: 1024,
  },
  'stickers/everyday/koala.png': {
    source: require('../../../../../../assets/stickers/everyday/koala.png'),
    width: 932,
    height: 1024,
  },
  'stickers/everyday/hamster.png': {
    source: require('../../../../../../assets/stickers/everyday/hamster.png'),
    width: 954,
    height: 1024,
  },
  'stickers/everyday/turtle.png': {
    source: require('../../../../../../assets/stickers/everyday/turtle.png'),
    width: 1024,
    height: 810,
  },
  'stickers/everyday/duckling.png': {
    source: require('../../../../../../assets/stickers/everyday/duckling.png'),
    width: 824,
    height: 1024,
  },
  'stickers/everyday/pineapple.png': {
    source: require('../../../../../../assets/stickers/everyday/pineapple.png'),
    width: 648,
    height: 1024,
  },
  'stickers/everyday/cherries.png': {
    source: require('../../../../../../assets/stickers/everyday/cherries.png'),
    width: 1024,
    height: 960,
  },
  'stickers/everyday/lemon.png': {
    source: require('../../../../../../assets/stickers/everyday/lemon.png'),
    width: 826,
    height: 1024,
  },
  'stickers/everyday/peach.png': {
    source: require('../../../../../../assets/stickers/everyday/peach.png'),
    width: 975,
    height: 1024,
  },
  'stickers/everyday/donut.png': {
    source: require('../../../../../../assets/stickers/everyday/donut.png'),
    width: 997,
    height: 1024,
  },
  'stickers/everyday/cupcake.png': {
    source: require('../../../../../../assets/stickers/everyday/cupcake.png'),
    width: 735,
    height: 1024,
  },
  'stickers/everyday/popsicle.png': {
    source: require('../../../../../../assets/stickers/everyday/popsicle.png'),
    width: 547,
    height: 1024,
  },
  'stickers/everyday/sunny.png': {
    source: require('../../../../../../assets/stickers/everyday/sunny.png'),
    width: 986,
    height: 1024,
  },
  'stickers/everyday/cloudy.png': {
    source: require('../../../../../../assets/stickers/everyday/cloudy.png'),
    width: 1024,
    height: 922,
  },
  'stickers/everyday/rainbow.png': {
    source: require('../../../../../../assets/stickers/everyday/rainbow.png'),
    width: 1024,
    height: 540,
  },
  'stickers/everyday/star.png': {
    source: require('../../../../../../assets/stickers/everyday/star.png'),
    width: 1024,
    height: 958,
  },
  'stickers/everyday/flower.png': {
    source: require('../../../../../../assets/stickers/everyday/flower.png'),
    width: 812,
    height: 1024,
  },
  'stickers/everyday/teddy.png': {
    source: require('../../../../../../assets/stickers/everyday/teddy.png'),
    width: 865,
    height: 1024,
  },
  'stickers/barkada/bonfire.png': {
    source: require('../../../../../../assets/stickers/barkada/bonfire.png'),
    width: 1024,
    height: 847,
  },
  'stickers/barkada/camping.png': {
    source: require('../../../../../../assets/stickers/barkada/camping.png'),
    width: 1024,
    height: 790,
  },
  'stickers/barkada/game-night.png': {
    source: require('../../../../../../assets/stickers/barkada/game-night.png'),
    width: 1024,
    height: 822,
  },
  'stickers/barkada/movie-night.png': {
    source: require('../../../../../../assets/stickers/barkada/movie-night.png'),
    width: 1024,
    height: 1007,
  },
  'stickers/barkada/milk-tea-date.png': {
    source: require('../../../../../../assets/stickers/barkada/milk-tea-date.png'),
    width: 1020,
    height: 1024,
  },
  'stickers/barkada/friendship-bracelets.png': {
    source: require('../../../../../../assets/stickers/barkada/friendship-bracelets.png'),
    width: 1024,
    height: 845,
  },
  'stickers/barkada/beach-ball.png': {
    source: require('../../../../../../assets/stickers/barkada/beach-ball.png'),
    width: 669,
    height: 1024,
  },
  'stickers/barkada/picnic.png': {
    source: require('../../../../../../assets/stickers/barkada/picnic.png'),
    width: 922,
    height: 1024,
  },
  'stickers/barkada/samgyup.png': {
    source: require('../../../../../../assets/stickers/barkada/samgyup.png'),
    width: 1024,
    height: 894,
  },
  'stickers/barkada/share-fries.png': {
    source: require('../../../../../../assets/stickers/barkada/share-fries.png'),
    width: 1024,
    height: 889,
  },
  'stickers/barkada/sparklers.png': {
    source: require('../../../../../../assets/stickers/barkada/sparklers.png'),
    width: 1024,
    height: 1020,
  },
  'stickers/barkada/pinky-promise.png': {
    source: require('../../../../../../assets/stickers/barkada/pinky-promise.png'),
    width: 1024,
    height: 943,
  },
  'stickers/barkada/group-hug.png': {
    source: require('../../../../../../assets/stickers/barkada/group-hug.png'),
    width: 970,
    height: 1024,
  },
  'stickers/barkada/bowling.png': {
    source: require('../../../../../../assets/stickers/barkada/bowling.png'),
    width: 1024,
    height: 854,
  },
  'stickers/barkada/player-two.png': {
    source: require('../../../../../../assets/stickers/barkada/player-two.png'),
    width: 1024,
    height: 687,
  },
  'stickers/barkada/party-popper.png': {
    source: require('../../../../../../assets/stickers/barkada/party-popper.png'),
    width: 926,
    height: 1024,
  },
  'stickers/barkada/video-call.png': {
    source: require('../../../../../../assets/stickers/barkada/video-call.png'),
    width: 728,
    height: 1024,
  },
  'stickers/barkada/balloons.png': {
    source: require('../../../../../../assets/stickers/barkada/balloons.png'),
    width: 845,
    height: 1024,
  },
  'stickers/barkada/walk-together.png': {
    source: require('../../../../../../assets/stickers/barkada/walk-together.png'),
    width: 1024,
    height: 670,
  },
  'stickers/barkada/food-crawl.png': {
    source: require('../../../../../../assets/stickers/barkada/food-crawl.png'),
    width: 609,
    height: 1024,
  },
  'stickers/barkada/sleepover.png': {
    source: require('../../../../../../assets/stickers/barkada/sleepover.png'),
    width: 1024,
    height: 829,
  },
  'stickers/work-from-wherever/cafe-desk.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/cafe-desk.png'),
    width: 1024,
    height: 1019,
  },
  'stickers/work-from-wherever/beach-desk.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/beach-desk.png'),
    width: 1024,
    height: 964,
  },
  'stickers/work-from-wherever/bed-desk.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/bed-desk.png'),
    width: 1024,
    height: 855,
  },
  'stickers/work-from-wherever/five-oclock.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/five-oclock.png'),
    width: 1024,
    height: 959,
  },
  'stickers/work-from-wherever/all-done.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/all-done.png'),
    width: 994,
    height: 1024,
  },
  'stickers/work-from-wherever/crunch-time.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/crunch-time.png'),
    width: 1024,
    height: 923,
  },
  'stickers/work-from-wherever/desk-lamp.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/desk-lamp.png'),
    width: 1024,
    height: 964,
  },
  'stickers/work-from-wherever/keyboard.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/keyboard.png'),
    width: 1024,
    height: 588,
  },
  'stickers/work-from-wherever/mouse.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/mouse.png'),
    width: 861,
    height: 1024,
  },
  'stickers/work-from-wherever/video-meeting.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/video-meeting.png'),
    width: 1024,
    height: 947,
  },
  'stickers/work-from-wherever/comfy-chair.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/comfy-chair.png'),
    width: 760,
    height: 1024,
  },
  'stickers/work-from-wherever/workation.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/workation.png'),
    width: 554,
    height: 1024,
  },
  'stickers/work-from-wherever/full-wifi.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/full-wifi.png'),
    width: 1024,
    height: 887,
  },
  'stickers/work-from-wherever/low-battery.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/low-battery.png'),
    width: 1024,
    height: 950,
  },
  'stickers/work-from-wherever/balcony-office.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/balcony-office.png'),
    width: 1024,
    height: 680,
  },
  'stickers/work-from-wherever/water-bottle.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/water-bottle.png'),
    width: 745,
    height: 1024,
  },
  'stickers/work-from-wherever/focus-timer.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/focus-timer.png'),
    width: 1016,
    height: 1024,
  },
  'stickers/work-from-wherever/laptop-bag.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/laptop-bag.png'),
    width: 1010,
    height: 1024,
  },
  'stickers/work-from-wherever/stretch-break.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/stretch-break.png'),
    width: 1024,
    height: 762,
  },
  'stickers/work-from-wherever/paperwork.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/paperwork.png'),
    width: 1024,
    height: 931,
  },
  'stickers/work-from-wherever/bright-idea.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/bright-idea.png'),
    width: 855,
    height: 1024,
  },
  'stickers/work-from-wherever/train-office.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/train-office.png'),
    width: 1024,
    height: 890,
  },
  'stickers/pet-parent/bath-time.png': {
    source: require('../../../../../../assets/stickers/pet-parent/bath-time.png'),
    width: 1002,
    height: 1024,
  },
  'stickers/pet-parent/box-cat.png': {
    source: require('../../../../../../assets/stickers/pet-parent/box-cat.png'),
    width: 1024,
    height: 952,
  },
  'stickers/pet-parent/dinner-bowl.png': {
    source: require('../../../../../../assets/stickers/pet-parent/dinner-bowl.png'),
    width: 952,
    height: 1024,
  },
  'stickers/pet-parent/yarn-kitten.png': {
    source: require('../../../../../../assets/stickers/pet-parent/yarn-kitten.png'),
    width: 1024,
    height: 895,
  },
  'stickers/pet-parent/car-ride.png': {
    source: require('../../../../../../assets/stickers/pet-parent/car-ride.png'),
    width: 1024,
    height: 788,
  },
  'stickers/pet-parent/keyboard-cat.png': {
    source: require('../../../../../../assets/stickers/pet-parent/keyboard-cat.png'),
    width: 984,
    height: 1024,
  },
  'stickers/pet-parent/sweater-corgi.png': {
    source: require('../../../../../../assets/stickers/pet-parent/sweater-corgi.png'),
    width: 946,
    height: 1024,
  },
  'stickers/pet-parent/hamster.png': {
    source: require('../../../../../../assets/stickers/pet-parent/hamster.png'),
    width: 1024,
    height: 931,
  },
  'stickers/pet-parent/slipper-crime.png': {
    source: require('../../../../../../assets/stickers/pet-parent/slipper-crime.png'),
    width: 1024,
    height: 773,
  },
  'stickers/pet-parent/window-cat.png': {
    source: require('../../../../../../assets/stickers/pet-parent/window-cat.png'),
    width: 924,
    height: 1024,
  },
  'stickers/pet-parent/fetch.png': {
    source: require('../../../../../../assets/stickers/pet-parent/fetch.png'),
    width: 1024,
    height: 692,
  },
  'stickers/pet-parent/goldfish.png': {
    source: require('../../../../../../assets/stickers/pet-parent/goldfish.png'),
    width: 1024,
    height: 955,
  },
  'stickers/pet-parent/bunny.png': {
    source: require('../../../../../../assets/stickers/pet-parent/bunny.png'),
    width: 1024,
    height: 1007,
  },
  'stickers/pet-parent/cuddle-pile.png': {
    source: require('../../../../../../assets/stickers/pet-parent/cuddle-pile.png'),
    width: 1024,
    height: 906,
  },
  'stickers/pet-parent/glass-push.png': {
    source: require('../../../../../../assets/stickers/pet-parent/glass-push.png'),
    width: 1024,
    height: 855,
  },
  'stickers/pet-parent/budgie.png': {
    source: require('../../../../../../assets/stickers/pet-parent/budgie.png'),
    width: 874,
    height: 1024,
  },
  'stickers/pet-parent/muddy-pup.png': {
    source: require('../../../../../../assets/stickers/pet-parent/muddy-pup.png'),
    width: 1024,
    height: 837,
  },
  'stickers/pet-parent/scratch-post.png': {
    source: require('../../../../../../assets/stickers/pet-parent/scratch-post.png'),
    width: 930,
    height: 1024,
  },
  'stickers/pet-parent/leash.png': {
    source: require('../../../../../../assets/stickers/pet-parent/leash.png'),
    width: 1024,
    height: 752,
  },
  'stickers/pet-parent/groomed-pup.png': {
    source: require('../../../../../../assets/stickers/pet-parent/groomed-pup.png'),
    width: 869,
    height: 1024,
  },
  'stickers/pet-parent/turtle.png': {
    source: require('../../../../../../assets/stickers/pet-parent/turtle.png'),
    width: 1024,
    height: 600,
  },
  'stickers/pet-parent/pet-birthday.png': {
    source: require('../../../../../../assets/stickers/pet-parent/pet-birthday.png'),
    width: 1024,
    height: 1000,
  },
  'stickers/pet-parent/laundry-cat.png': {
    source: require('../../../../../../assets/stickers/pet-parent/laundry-cat.png'),
    width: 972,
    height: 1024,
  },
  'stickers/christmas-2026/christmas-tree.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/christmas-tree.png'),
    width: 702,
    height: 1024,
  },
  'stickers/christmas-2026/snowman.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/snowman.png'),
    width: 849,
    height: 1024,
  },
  'stickers/christmas-2026/belen.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/belen.png'),
    width: 1024,
    height: 958,
  },
  'stickers/christmas-2026/stocking.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/stocking.png'),
    width: 817,
    height: 1024,
  },
  'stickers/christmas-2026/queso-de-bola.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/queso-de-bola.png'),
    width: 1024,
    height: 956,
  },
  'stickers/christmas-2026/gingerbread.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/gingerbread.png'),
    width: 893,
    height: 1024,
  },
  'stickers/christmas-2026/carolers.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/carolers.png'),
    width: 1024,
    height: 1002,
  },
  'stickers/christmas-2026/reindeer.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/reindeer.png'),
    width: 779,
    height: 1024,
  },
  'stickers/christmas-2026/salabat.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/salabat.png'),
    width: 1024,
    height: 730,
  },
  'stickers/christmas-2026/candy-cane.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/candy-cane.png'),
    width: 675,
    height: 1024,
  },
  'stickers/christmas-2026/hot-cocoa.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/hot-cocoa.png'),
    width: 829,
    height: 1024,
  },
  'stickers/christmas-2026/ornament.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/ornament.png'),
    width: 700,
    height: 1024,
  },
  'stickers/christmas-2026/santa.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/santa.png'),
    width: 922,
    height: 1024,
  },
  'stickers/christmas-2026/milk-cookies.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/milk-cookies.png'),
    width: 1024,
    height: 860,
  },
  'stickers/christmas-2026/wreath.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/wreath.png'),
    width: 890,
    height: 1024,
  },
  'stickers/christmas-2026/noche-buena-table.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/noche-buena-table.png'),
    width: 1024,
    height: 818,
  },
  'stickers/christmas-2026/poinsettia.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/poinsettia.png'),
    width: 972,
    height: 1024,
  },
  'stickers/christmas-2026/string-lights.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/string-lights.png'),
    width: 1024,
    height: 334,
  },
  'stickers/christmas-2026/leche-flan.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/leche-flan.png'),
    width: 1024,
    height: 722,
  },
  'stickers/christmas-2026/gift-opening.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/gift-opening.png'),
    width: 989,
    height: 1024,
  },
  'stickers/christmas-2026/snow-globe.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/snow-globe.png'),
    width: 783,
    height: 1024,
  },
  'stickers/christmas-2026/jingle-bells.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/jingle-bells.png'),
    width: 1024,
    height: 870,
  },
  'stickers/christmas-2026/skating-penguin.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/skating-penguin.png'),
    width: 875,
    height: 1024,
  },
  'stickers/christmas-2026/balikbayan-box.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/balikbayan-box.png'),
    width: 1024,
    height: 1013,
  },
  'stickers/birthdays/birthday-cake.png': {
    source: require('../../../../../../assets/stickers/birthdays/birthday-cake.png'),
    width: 817,
    height: 1024,
  },
  'stickers/birthdays/balloons.png': {
    source: require('../../../../../../assets/stickers/birthdays/balloons.png'),
    width: 941,
    height: 1024,
  },
  'stickers/birthdays/party-hat.png': {
    source: require('../../../../../../assets/stickers/birthdays/party-hat.png'),
    width: 869,
    height: 1024,
  },
  'stickers/birthdays/party-popper.png': {
    source: require('../../../../../../assets/stickers/birthdays/party-popper.png'),
    width: 951,
    height: 1024,
  },
  'stickers/birthdays/make-a-wish.png': {
    source: require('../../../../../../assets/stickers/birthdays/make-a-wish.png'),
    width: 963,
    height: 1024,
  },
  'stickers/birthdays/gift-stack.png': {
    source: require('../../../../../../assets/stickers/birthdays/gift-stack.png'),
    width: 653,
    height: 1024,
  },
  'stickers/birthdays/cake-slice.png': {
    source: require('../../../../../../assets/stickers/birthdays/cake-slice.png'),
    width: 875,
    height: 1024,
  },
  'stickers/birthdays/bunting.png': {
    source: require('../../../../../../assets/stickers/birthdays/bunting.png'),
    width: 1024,
    height: 363,
  },
  'stickers/birthdays/blow-candles.png': {
    source: require('../../../../../../assets/stickers/birthdays/blow-candles.png'),
    width: 1024,
    height: 997,
  },
  'stickers/birthdays/cupcake.png': {
    source: require('../../../../../../assets/stickers/birthdays/cupcake.png'),
    width: 727,
    height: 1024,
  },
  'stickers/birthdays/crown.png': {
    source: require('../../../../../../assets/stickers/birthdays/crown.png'),
    width: 1024,
    height: 758,
  },
  'stickers/birthdays/pinata.png': {
    source: require('../../../../../../assets/stickers/birthdays/pinata.png'),
    width: 967,
    height: 1024,
  },
  'stickers/birthdays/pancit.png': {
    source: require('../../../../../../assets/stickers/birthdays/pancit.png'),
    width: 1024,
    height: 703,
  },
  'stickers/birthdays/birthday-card.png': {
    source: require('../../../../../../assets/stickers/birthdays/birthday-card.png'),
    width: 845,
    height: 1024,
  },
  'stickers/birthdays/gift-bear.png': {
    source: require('../../../../../../assets/stickers/birthdays/gift-bear.png'),
    width: 741,
    height: 1024,
  },
  'stickers/birthdays/party-blower.png': {
    source: require('../../../../../../assets/stickers/birthdays/party-blower.png'),
    width: 1024,
    height: 657,
  },
  'stickers/birthdays/party-animals.png': {
    source: require('../../../../../../assets/stickers/birthdays/party-animals.png'),
    width: 1024,
    height: 917,
  },
  'stickers/birthdays/spaghetti.png': {
    source: require('../../../../../../assets/stickers/birthdays/spaghetti.png'),
    width: 1024,
    height: 883,
  },
  'stickers/birthdays/heart-balloon.png': {
    source: require('../../../../../../assets/stickers/birthdays/heart-balloon.png'),
    width: 860,
    height: 1024,
  },
  'stickers/birthdays/surprise-cat.png': {
    source: require('../../../../../../assets/stickers/birthdays/surprise-cat.png'),
    width: 907,
    height: 1024,
  },
  'stickers/birthdays/ice-cream.png': {
    source: require('../../../../../../assets/stickers/birthdays/ice-cream.png'),
    width: 620,
    height: 1024,
  },
  'stickers/birthdays/birthday-photo.png': {
    source: require('../../../../../../assets/stickers/birthdays/birthday-photo.png'),
    width: 985,
    height: 1024,
  },
  'stickers/birthdays/lola-cake.png': {
    source: require('../../../../../../assets/stickers/birthdays/lola-cake.png'),
    width: 931,
    height: 1024,
  },
  'stickers/birthdays/cheers.png': {
    source: require('../../../../../../assets/stickers/birthdays/cheers.png'),
    width: 1024,
    height: 875,
  },
  'stickers/birthdays/birthday-sash.png': {
    source: require('../../../../../../assets/stickers/birthdays/birthday-sash.png'),
    width: 674,
    height: 1024,
  },
  'stickers/birthdays/loot-bag.png': {
    source: require('../../../../../../assets/stickers/birthdays/loot-bag.png'),
    width: 716,
    height: 1024,
  },
  'stickers/birthdays/sparkler-cake.png': {
    source: require('../../../../../../assets/stickers/birthdays/sparkler-cake.png'),
    width: 597,
    height: 1024,
  },
  'stickers/birthdays/big-day.png': {
    source: require('../../../../../../assets/stickers/birthdays/big-day.png'),
    width: 965,
    height: 1024,
  },
  'stickers/birthdays/karaoke.png': {
    source: require('../../../../../../assets/stickers/birthdays/karaoke.png'),
    width: 1024,
    height: 999,
  },
  'stickers/birthdays/first-birthday.png': {
    source: require('../../../../../../assets/stickers/birthdays/first-birthday.png'),
    width: 848,
    height: 1024,
  },
  'stickers/new-year/fireworks.png': {
    source: require('../../../../../../assets/stickers/new-year/fireworks.png'),
    width: 1024,
    height: 1019,
  },
  'stickers/new-year/midnight-clock.png': {
    source: require('../../../../../../assets/stickers/new-year/midnight-clock.png'),
    width: 1024,
    height: 954,
  },
  'stickers/new-year/round-fruits.png': {
    source: require('../../../../../../assets/stickers/new-year/round-fruits.png'),
    width: 1024,
    height: 850,
  },
  'stickers/new-year/jump-for-luck.png': {
    source: require('../../../../../../assets/stickers/new-year/jump-for-luck.png'),
    width: 738,
    height: 1024,
  },
  'stickers/new-year/sparkler.png': {
    source: require('../../../../../../assets/stickers/new-year/sparkler.png'),
    width: 695,
    height: 1024,
  },
  'stickers/new-year/midnight-toast.png': {
    source: require('../../../../../../assets/stickers/new-year/midnight-toast.png'),
    width: 931,
    height: 1024,
  },
  'stickers/new-year/resolutions.png': {
    source: require('../../../../../../assets/stickers/new-year/resolutions.png'),
    width: 920,
    height: 1024,
  },
  'stickers/new-year/red-lantern.png': {
    source: require('../../../../../../assets/stickers/new-year/red-lantern.png'),
    width: 756,
    height: 1024,
  },
  'stickers/new-year/torotot.png': {
    source: require('../../../../../../assets/stickers/new-year/torotot.png'),
    width: 1024,
    height: 530,
  },
  'stickers/new-year/red-envelope.png': {
    source: require('../../../../../../assets/stickers/new-year/red-envelope.png'),
    width: 656,
    height: 1024,
  },
  'stickers/new-year/lucky-coins.png': {
    source: require('../../../../../../assets/stickers/new-year/lucky-coins.png'),
    width: 890,
    height: 1024,
  },
  'stickers/new-year/biko.png': {
    source: require('../../../../../../assets/stickers/new-year/biko.png'),
    width: 1024,
    height: 772,
  },
  'stickers/new-year/disco-ball.png': {
    source: require('../../../../../../assets/stickers/new-year/disco-ball.png'),
    width: 1021,
    height: 1024,
  },
  'stickers/new-year/slow-morning.png': {
    source: require('../../../../../../assets/stickers/new-year/slow-morning.png'),
    width: 1024,
    height: 925,
  },
  'stickers/new-year/first-sunrise.png': {
    source: require('../../../../../../assets/stickers/new-year/first-sunrise.png'),
    width: 1024,
    height: 666,
  },
  'stickers/new-year/party-top-hat.png': {
    source: require('../../../../../../assets/stickers/new-year/party-top-hat.png'),
    width: 1024,
    height: 1002,
  },
  'stickers/new-year/media-noche.png': {
    source: require('../../../../../../assets/stickers/new-year/media-noche.png'),
    width: 1024,
    height: 867,
  },
  'stickers/new-year/midnight-kiss.png': {
    source: require('../../../../../../assets/stickers/new-year/midnight-kiss.png'),
    width: 1002,
    height: 1024,
  },
  'stickers/new-year/fresh-start.png': {
    source: require('../../../../../../assets/stickers/new-year/fresh-start.png'),
    width: 1024,
    height: 928,
  },
  'stickers/new-year/firecrackers.png': {
    source: require('../../../../../../assets/stickers/new-year/firecrackers.png'),
    width: 1015,
    height: 1024,
  },
  'stickers/new-year/wish-jar.png': {
    source: require('../../../../../../assets/stickers/new-year/wish-jar.png'),
    width: 881,
    height: 1024,
  },
  'stickers/new-year/party-pup.png': {
    source: require('../../../../../../assets/stickers/new-year/party-pup.png'),
    width: 1014,
    height: 1024,
  },
  'stickers/new-year/moon-and-star.png': {
    source: require('../../../../../../assets/stickers/new-year/moon-and-star.png'),
    width: 1024,
    height: 777,
  },
  'stickers/new-year/tikoy.png': {
    source: require('../../../../../../assets/stickers/new-year/tikoy.png'),
    width: 1024,
    height: 741,
  },
  'stickers/new-year/countdown.png': {
    source: require('../../../../../../assets/stickers/new-year/countdown.png'),
    width: 768,
    height: 1024,
  },
  'stickers/new-year/new-routine.png': {
    source: require('../../../../../../assets/stickers/new-year/new-routine.png'),
    width: 1024,
    height: 937,
  },
  'stickers/new-year/polka-dots.png': {
    source: require('../../../../../../assets/stickers/new-year/polka-dots.png'),
    width: 749,
    height: 1024,
  },
  'stickers/new-year/confetti-cannon.png': {
    source: require('../../../../../../assets/stickers/new-year/confetti-cannon.png'),
    width: 947,
    height: 1024,
  },
  'stickers/new-year/long-noodles.png': {
    source: require('../../../../../../assets/stickers/new-year/long-noodles.png'),
    width: 1011,
    height: 1024,
  },
  'stickers/new-year/nye-selfie.png': {
    source: require('../../../../../../assets/stickers/new-year/nye-selfie.png'),
    width: 1024,
    height: 919,
  },
  'stickers/valentines/hearts.png': {
    source: require('../../../../../../assets/stickers/valentines/hearts.png'),
    width: 1024,
    height: 791,
  },
  'stickers/valentines/roses.png': {
    source: require('../../../../../../assets/stickers/valentines/roses.png'),
    width: 834,
    height: 1024,
  },
  'stickers/valentines/chocolates.png': {
    source: require('../../../../../../assets/stickers/valentines/chocolates.png'),
    width: 902,
    height: 1024,
  },
  'stickers/valentines/love-letter.png': {
    source: require('../../../../../../assets/stickers/valentines/love-letter.png'),
    width: 932,
    height: 1024,
  },
  'stickers/valentines/cupid.png': {
    source: require('../../../../../../assets/stickers/valentines/cupid.png'),
    width: 996,
    height: 1024,
  },
  'stickers/valentines/heart-bear.png': {
    source: require('../../../../../../assets/stickers/valentines/heart-bear.png'),
    width: 772,
    height: 1024,
  },
  'stickers/valentines/coffee-date.png': {
    source: require('../../../../../../assets/stickers/valentines/coffee-date.png'),
    width: 1024,
    height: 775,
  },
  'stickers/valentines/holding-hands.png': {
    source: require('../../../../../../assets/stickers/valentines/holding-hands.png'),
    width: 995,
    height: 1024,
  },
  'stickers/valentines/love-lock.png': {
    source: require('../../../../../../assets/stickers/valentines/love-lock.png'),
    width: 1024,
    height: 928,
  },
  'stickers/valentines/penguin-pair.png': {
    source: require('../../../../../../assets/stickers/valentines/penguin-pair.png'),
    width: 1024,
    height: 1015,
  },
  'stickers/valentines/candlelit-dinner.png': {
    source: require('../../../../../../assets/stickers/valentines/candlelit-dinner.png'),
    width: 1024,
    height: 718,
  },
  'stickers/valentines/ring-box.png': {
    source: require('../../../../../../assets/stickers/valentines/ring-box.png'),
    width: 816,
    height: 1024,
  },
  'stickers/valentines/sweet-treats.png': {
    source: require('../../../../../../assets/stickers/valentines/sweet-treats.png'),
    width: 1024,
    height: 734,
  },
  'stickers/valentines/cat-couple.png': {
    source: require('../../../../../../assets/stickers/valentines/cat-couple.png'),
    width: 1024,
    height: 867,
  },
  'stickers/valentines/galentines.png': {
    source: require('../../../../../../assets/stickers/valentines/galentines.png'),
    width: 1024,
    height: 931,
  },
  'stickers/valentines/heart-balloon.png': {
    source: require('../../../../../../assets/stickers/valentines/heart-balloon.png'),
    width: 783,
    height: 1024,
  },
  'stickers/valentines/finger-heart.png': {
    source: require('../../../../../../assets/stickers/valentines/finger-heart.png'),
    width: 1024,
    height: 674,
  },
  'stickers/valentines/single-rose.png': {
    source: require('../../../../../../assets/stickers/valentines/single-rose.png'),
    width: 655,
    height: 1024,
  },
  'stickers/valentines/self-love.png': {
    source: require('../../../../../../assets/stickers/valentines/self-love.png'),
    width: 1024,
    height: 864,
  },
  'stickers/valentines/mended-heart.png': {
    source: require('../../../../../../assets/stickers/valentines/mended-heart.png'),
    width: 1024,
    height: 897,
  },
  'stickers/valentines/rain-date.png': {
    source: require('../../../../../../assets/stickers/valentines/rain-date.png'),
    width: 1024,
    height: 1019,
  },
  'stickers/valentines/boba-date.png': {
    source: require('../../../../../../assets/stickers/valentines/boba-date.png'),
    width: 1024,
    height: 926,
  },
  'stickers/valentines/lolo-lola.png': {
    source: require('../../../../../../assets/stickers/valentines/lolo-lola.png'),
    width: 922,
    height: 1024,
  },
  'stickers/valentines/movie-night.png': {
    source: require('../../../../../../assets/stickers/valentines/movie-night.png'),
    width: 1024,
    height: 791,
  },
  'stickers/valentines/picnic-date.png': {
    source: require('../../../../../../assets/stickers/valentines/picnic-date.png'),
    width: 1024,
    height: 834,
  },
  'stickers/valentines/video-call.png': {
    source: require('../../../../../../assets/stickers/valentines/video-call.png'),
    width: 929,
    height: 1024,
  },
  'stickers/valentines/lovebirds.png': {
    source: require('../../../../../../assets/stickers/valentines/lovebirds.png'),
    width: 1024,
    height: 697,
  },
  'stickers/valentines/rose-pup.png': {
    source: require('../../../../../../assets/stickers/valentines/rose-pup.png'),
    width: 1024,
    height: 1015,
  },
  'stickers/valentines/heart-pizza.png': {
    source: require('../../../../../../assets/stickers/valentines/heart-pizza.png'),
    width: 1024,
    height: 904,
  },
  'stickers/valentines/love-song.png': {
    source: require('../../../../../../assets/stickers/valentines/love-song.png'),
    width: 1024,
    height: 1007,
  },
};

/** The art for a catalog asset_path, or undefined for a sticker this app version doesn't bundle. */
export function stickerArtFor(assetPath: string): StickerArt | undefined {
  return Object.prototype.hasOwnProperty.call(stickerArt, assetPath) ? stickerArt[assetPath] : undefined;
}
