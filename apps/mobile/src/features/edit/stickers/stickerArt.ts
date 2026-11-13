// Bundled art for every catalog sticker (0012 launch packs, 0029 paid packs, 0032 picture stickers: one PNG per sticker at repo-root assets/stickers/<pack>/<name>.png,
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
  'stickers/milestones/first-full-jar.png': {
    source: require('../../../../../../assets/stickers/milestones/first-full-jar.png'),
    width: 753,
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
  'stickers/milestones/jars-30.png': {
    source: require('../../../../../../assets/stickers/milestones/jars-30.png'),
    width: 576,
    height: 252,
  },
  'stickers/milestones/one-year.png': {
    source: require('../../../../../../assets/stickers/milestones/one-year.png'),
    width: 804,
    height: 252,
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
  'stickers/pinoy-life/uwi-na.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/uwi-na.png'),
    width: 456,
    height: 234,
  },
  'stickers/stamps/date.png': {
    source: require('../../../../../../assets/stickers/stamps/date.png'),
    width: 498,
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
