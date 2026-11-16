import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { stickerArtSize } from '@/features/edit/stickers/remoteStickerArt';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, photo, radius, shadow, space, stickerTool } from '@/theme/tokens';

import { PackArt, type PackLayout } from './PackArt';

export type StickerPackTileProps = {
  slug: string;
  name: string;
  /** The pack's stickers in catalog order; the tile shows the first one or two. */
  stickers: readonly { asset: string; label: string }[];
  onPress: () => void;
  testID?: string;
};

// One sticker sits a little above the middle; two picture stickers lean apart, clear of the folded corner.
const LAYOUTS: readonly PackLayout[] = [
  { height: 64, maxWidth: 88, spots: [{ at: [50, 40], rotate: -6 }] },
  {
    height: 56,
    maxWidth: 64,
    spots: [
      { at: [32, 28], rotate: -10 },
      { at: [66, 50], rotate: 9 },
    ],
  },
];

/** Word art (wider than it is tall) reads best alone; picture stickers come in a pair. */
function samplesFor(stickers: StickerPackTileProps['stickers']) {
  const first = stickers[0];
  if (!first) return [];
  const art = stickerArtSize(first.asset);
  const wide = art !== undefined && art.width / art.height > 1.4;
  return stickers.slice(0, wide ? 1 : 2);
}

/**
 * The card's outline: a rounded rectangle with the top-right corner cut on the diagonal, inset by half the
 * white edge so the stroke's outer side lands on the tile's bounds.
 */
function facePath(w: number, h: number): string {
  const { edge, fold } = stickerTool.packTile;
  const a = edge / 2;
  const r = radius.tile - a;
  return [
    `M ${a + r} ${a}`,
    `L ${w - fold} ${a}`,
    `L ${w - a} ${fold}`,
    `L ${w - a} ${h - a - r}`,
    `A ${r} ${r} 0 0 1 ${w - a - r} ${h - a}`,
    `L ${a + r} ${h - a}`,
    `A ${r} ${r} 0 0 1 ${a} ${h - a - r}`,
    `L ${a} ${a + r}`,
    `A ${r} ${r} 0 0 1 ${a + r} ${a}`,
    'Z',
  ].join(' ');
}

/** The corner folded over: the triangle under the cut, its inner corner rounded. */
function flapPath(w: number, dx = 0, dy = 0): string {
  const { fold, foldRadius: fr } = stickerTool.packTile;
  const x = w - fold + dx;
  return `M ${x} ${dy} L ${w + dx} ${fold + dy} L ${x + fr} ${fold + dy} A ${fr} ${fr} 0 0 1 ${x} ${fold - fr + dy} Z`;
}

/**
 * The 9th tile on Today: a sticker pack from the shop, drawn as a sticker. The pack's own tint sits inside a
 * white die-cut edge, the card tilts a little, and its top-right corner folds over. It ends the 3×3 grid so
 * the last row is full, and opens the pack's page.
 */
export function StickerPackTile({ slug, name, stickers, onPress, testID = 'today-pack-tile' }: StickerPackTileProps) {
  const { t } = useTranslation();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pressed, setPressed] = useState(false);
  const tint = stickerTool.packTint[slug] ?? stickerTool.packTile.tint;
  const { edge, foldLight, foldMid, foldDark, foldShadow } = stickerTool.packTile;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('today.packTile.label', { name })}
      accessibilityHint={t('today.packTile.hint')}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      testID={testID}
      style={[styles.tile, pressed ? { opacity: PRESSED_OPACITY } : null]}
    >
      {/* The shadow lives on the drawing alone (iOS shades by its alpha), so the text casts none. */}
      <View style={[StyleSheet.absoluteFill, shadow.tile]} pointerEvents="none">
        {size ? (
          <Svg width={size.w} height={size.h} accessible={false} testID={`${testID}-card`}>
            <Defs>
              <LinearGradient id="packFold" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor={foldLight} />
                <Stop offset="0.45" stopColor={foldMid} />
                <Stop offset="1" stopColor={foldDark} />
              </LinearGradient>
            </Defs>
            <Path
              d={facePath(size.w, size.h)}
              fill={tint}
              stroke={colors.surface}
              strokeWidth={edge}
              strokeLinejoin="round"
            />
            <Path d={flapPath(size.w, -1, 1)} fill={foldShadow} />
            <Path d={flapPath(size.w)} fill="url(#packFold)" testID={`${testID}-fold`} />
          </Svg>
        ) : null}
      </View>
      <View style={styles.content} pointerEvents="none">
        <PackArt samples={samplesFor(stickers)} layouts={LAYOUTS} testID={`${testID}-art`} />
        <Text
          maxFontSizeMultiplier={maxTextScale.tile}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[textStyle('bodySmall', '700'), { color: colors.ink }]}
        >
          {name}
        </Text>
        <Text
          maxFontSizeMultiplier={maxTextScale.tile}
          numberOfLines={1}
          style={[textStyle('label', '700'), { color: colors.brandLink }]}
        >
          {t('today.packTile.seePack')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { aspectRatio: photo.aspect, transform: [{ rotate: `${stickerTool.packTile.tilt}deg` }] },
  content: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    margin: stickerTool.packTile.edge,
    padding: space.sm,
    justifyContent: 'flex-end',
  },
});
