import { StyleSheet, View, type ViewStyle } from 'react-native';

import { stickerArtFor } from '@/features/edit/stickers/stickerArt';
import { StickerImage } from '@/features/edit/stickers/StickerImage';
import { stickerShop } from '@/theme/tokens';

/**
 * Where one sample sits: `at` is its center as percentages of the art well (x, y), so a cluster fills the well
 * at any width; `place` pins it by an edge instead (the seasonal banner). `rotate` tilts it in degrees.
 */
export type PackSpot = { rotate: number } & ({ at: readonly [number, number] } | { place: ViewStyle });

/** A set of spots and the box each sticker fits in: `height` is the PNG's (shadow margin included). */
export type PackLayout = { height: number; maxWidth?: number; spots: readonly PackSpot[] };

export type PackArtProps = {
  samples: { asset: string; label: string }[];
  /** One layout per sample count (index 0 for one sample); a pack with more samples uses the last one. */
  layouts: readonly PackLayout[];
  testID?: string;
};

/** A pack's first stickers clustered over its art well. Decorative: the card carries the name. */
export function PackArt({ samples, layouts, testID }: PackArtProps) {
  const layout = layouts[Math.min(samples.length, layouts.length) - 1];
  if (!layout) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      testID={testID}
    >
      {samples.slice(0, layout.spots.length).map((sample, i) => {
        const spot = layout.spots[i];
        if (!spot) return null;
        const art = stickerArtFor(sample.asset);
        const ratio = art ? art.width / art.height : 1;
        // The sticker keeps its shape inside the box: wide word art is held to maxWidth, pictures to height.
        const width = Math.min(layout.height * ratio, layout.maxWidth ?? Infinity);
        const height = width / ratio;
        const where: ViewStyle =
          'at' in spot
            ? { left: `${spot.at[0]}%`, top: `${spot.at[1]}%`, marginLeft: -width / 2, marginTop: -height / 2 }
            : spot.place;
        return (
          <View
            key={sample.asset}
            style={[styles.sample, where, { transform: [{ rotate: `${spot.rotate}deg` }] }]}
            testID={testID ? `${testID}-sticker` : undefined}
          >
            <StickerImage asset={sample.asset} width={width} height={height} />
          </View>
        );
      })}
    </View>
  );
}

/**
 * A pack card's art well (StickerShop: "For you" and "Yours"; D-81): up to six stickers in a tight cluster,
 * slightly overlapped and tilted, with a balanced layout for every count so small packs fill the well too.
 */
export const CARD_LAYOUTS: readonly PackLayout[] = [
  { height: 76, maxWidth: 124, spots: [{ at: [50, 50], rotate: -4 }] },
  {
    height: 62,
    maxWidth: 96,
    spots: [
      { at: [34, 40], rotate: -6 },
      { at: [66, 62], rotate: 5 },
    ],
  },
  {
    height: 54,
    maxWidth: 84,
    spots: [
      { at: [30, 32], rotate: -5 },
      { at: [70, 38], rotate: 6 },
      { at: [48, 72], rotate: -2 },
    ],
  },
  {
    height: 50,
    maxWidth: 74,
    spots: [
      { at: [29, 30], rotate: -5 },
      { at: [71, 34], rotate: 5 },
      { at: [31, 70], rotate: 4 },
      { at: [69, 72], rotate: -4 },
    ],
  },
  {
    height: 46,
    maxWidth: 60,
    spots: [
      { at: [20, 30], rotate: -6 },
      { at: [50, 26], rotate: 4 },
      { at: [80, 32], rotate: -3 },
      { at: [35, 72], rotate: 5 },
      { at: [66, 72], rotate: -4 },
    ],
  },
  {
    height: 44,
    maxWidth: 58,
    spots: [
      { at: [19, 30], rotate: -6 },
      { at: [50, 25], rotate: 4 },
      { at: [81, 31], rotate: -3 },
      { at: [21, 72], rotate: 5 },
      { at: [51, 75], rotate: -4 },
      { at: [80, 70], rotate: 6 },
    ],
  },
];

/** The pack page's cover (PackPreview; D-81): up to five of the pack's stickers, large, on the pack's color. */
export const COVER_LAYOUTS: readonly PackLayout[] = [
  { height: 140, maxWidth: 260, spots: [{ at: [50, 50], rotate: -4 }] },
  {
    height: 110,
    maxWidth: 180,
    spots: [
      { at: [34, 40], rotate: -6 },
      { at: [66, 64], rotate: 5 },
    ],
  },
  {
    height: 96,
    maxWidth: 160,
    spots: [
      { at: [28, 32], rotate: -6 },
      { at: [72, 38], rotate: 5 },
      { at: [50, 72], rotate: -2 },
    ],
  },
  {
    height: 88,
    maxWidth: 150,
    spots: [
      { at: [28, 30], rotate: -5 },
      { at: [72, 32], rotate: 5 },
      { at: [30, 72], rotate: 4 },
      { at: [70, 72], rotate: -4 },
    ],
  },
  {
    height: 84,
    maxWidth: 120,
    spots: [
      { at: [20, 32], rotate: -6 },
      { at: [50, 26], rotate: 4 },
      { at: [80, 34], rotate: -3 },
      { at: [35, 74], rotate: 5 },
      { at: [66, 72], rotate: -4 },
    ],
  },
];

/** The three spots on the seasonal banner's right side. */
export const BANNER_LAYOUTS: readonly PackLayout[] = [
  {
    height: stickerShop.bannerSampleHeight,
    spots: [
      { place: { right: 10, top: 14 }, rotate: 8 },
      { place: { right: 24, top: 58 }, rotate: -6 },
      { place: { right: 8, bottom: 10 }, rotate: 4 },
    ],
  },
];

const styles = StyleSheet.create({
  sample: { position: 'absolute' },
});
