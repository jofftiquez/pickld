// Bundled art for the launch stickers (0012: one PNG per sticker at repo-root assets/stickers/<pack>/<name>.png,
// the same files the photo worker serves), keyed by the catalog's asset_path. Bundled so the Stickers tool and
// every moment's stickers draw offline and from the first use (FR-STK-02 cached art). Width and height are the
// PNG's pixels: the overlay's box takes the art's aspect.

/** `source` is the bundler's asset id (what `require` of an image returns). */
export type StickerArt = { source: number; width: number; height: number };

export const stickerArt: Readonly<Record<string, StickerArt>> = {
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
};

/** The art for a catalog asset_path, or undefined for a sticker this app version doesn't bundle. */
export function stickerArtFor(assetPath: string): StickerArt | undefined {
  return Object.prototype.hasOwnProperty.call(stickerArt, assetPath) ? stickerArt[assetPath] : undefined;
}
