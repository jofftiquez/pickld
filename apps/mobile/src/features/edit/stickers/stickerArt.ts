// Bundled art for every catalog sticker (0012 launch packs, 0029 paid packs: one PNG per sticker at repo-root assets/stickers/<pack>/<name>.png,
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
  'stickers/barkada/g-na.png': {
    source: require('../../../../../../assets/stickers/barkada/g-na.png'),
    width: 369,
    height: 234,
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
  'stickers/christmas-2026/parol.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/parol.png'),
    width: 396,
    height: 234,
  },
  'stickers/christmas-2026/puto-bumbong.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/puto-bumbong.png'),
    width: 780,
    height: 234,
  },
  'stickers/christmas-2026/simbang-gabi.png': {
    source: require('../../../../../../assets/stickers/christmas-2026/simbang-gabi.png'),
    width: 747,
    height: 234,
  },
  'stickers/everyday/busy-bee.png': {
    source: require('../../../../../../assets/stickers/everyday/busy-bee.png'),
    width: 561,
    height: 234,
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
  'stickers/pet-parent/bantay.png': {
    source: require('../../../../../../assets/stickers/pet-parent/bantay.png'),
    width: 474,
    height: 234,
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
  'stickers/pet-parent/vet-day.png': {
    source: require('../../../../../../assets/stickers/pet-parent/vet-day.png'),
    width: 495,
    height: 234,
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
  'stickers/pinoy-life/charot.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/charot.png'),
    width: 468,
    height: 234,
  },
  'stickers/pinoy-life/grabe-siya.png': {
    source: require('../../../../../../assets/stickers/pinoy-life/grabe-siya.png'),
    width: 612,
    height: 234,
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
  'stickers/work-from-wherever/brb.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/brb.png'),
    width: 336,
    height: 234,
  },
  'stickers/work-from-wherever/camera-off.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/camera-off.png'),
    width: 636,
    height: 234,
  },
  'stickers/work-from-wherever/coffee-chat.png': {
    source: require('../../../../../../assets/stickers/work-from-wherever/coffee-chat.png'),
    width: 663,
    height: 234,
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
};

/** The art for a catalog asset_path, or undefined for a sticker this app version doesn't bundle. */
export function stickerArtFor(assetPath: string): StickerArt | undefined {
  return Object.prototype.hasOwnProperty.call(stickerArt, assetPath) ? stickerArt[assetPath] : undefined;
}
