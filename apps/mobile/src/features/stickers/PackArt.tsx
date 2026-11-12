import { StyleSheet, View, type ViewStyle } from 'react-native';

import { stickerArtFor } from '@/features/edit/stickers/stickerArt';
import { StickerImage } from '@/features/edit/stickers/StickerImage';
import { stickerShop } from '@/theme/tokens';

export type PackArtProps = {
  samples: { asset: string; label: string }[];
  /** Where each sample sits, tilted as on the design (StickerShop). */
  layout: readonly { place: ViewStyle; rotate: number }[];
  height?: number;
};

/** Up to three of a pack's stickers scattered over its art well. Decorative: the card carries the name. */
export function PackArt({ samples, layout, height = stickerShop.sampleHeight }: PackArtProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false} importantForAccessibility="no">
      {samples.slice(0, layout.length).map((sample, i) => {
        const spot = layout[i];
        if (!spot) return null;
        const art = stickerArtFor(sample.asset);
        return (
          <View
            key={sample.asset}
            style={[styles.sample, spot.place, { transform: [{ rotate: `${spot.rotate}deg` }] }]}
          >
            <StickerImage
              asset={sample.asset}
              width={art ? (height * art.width) / art.height : height}
              height={height}
            />
          </View>
        );
      })}
    </View>
  );
}

/** The three spots on a card (StickerShop: "For you" and "Yours"). */
export const CARD_LAYOUT = [
  { place: { left: 10, top: 14 }, rotate: -5 },
  { place: { right: 8, top: 46 }, rotate: 5 },
  { place: { left: 16, bottom: 12 }, rotate: -2 },
] as const;

/** The three spots on the seasonal banner's right side. */
export const BANNER_LAYOUT = [
  { place: { right: 14, top: 20 }, rotate: 8 },
  { place: { right: 28, top: 66 }, rotate: -6 },
  { place: { right: 12, bottom: 16 }, rotate: 4 },
] as const;

const styles = StyleSheet.create({
  sample: { position: 'absolute' },
});
