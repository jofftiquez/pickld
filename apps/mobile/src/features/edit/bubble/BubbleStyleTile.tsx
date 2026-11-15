import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { textStyle } from '@/theme/text';
import { bubble, colors, space } from '@/theme/tokens';

import type { BubbleShape } from '../edits';
import { cloudGeometry } from './bubbleLayout';

export type BubbleStyleTileProps = {
  shape: BubbleShape;
  /** Already translated, e.g. "Speech". */
  label: string;
  selected: boolean;
  accessibilityHint: string;
  onPress: () => void;
  /** Two-column layout with large text, four columns otherwise. */
  wide: boolean;
  testID?: string;
};

const previews: Record<Exclude<BubbleShape, 'thought'>, ViewStyle> = {
  speech: { borderRadius: bubble.previewRadius, borderBottomLeftRadius: bubble.previewTailRadius },
  shout: { borderRadius: bubble.shoutRadius, transform: [{ skewX: bubble.shoutSkew }] },
  whisper: {
    borderRadius: bubble.previewRadius,
    borderWidth: bubble.whisperBorder,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    backgroundColor: 'transparent',
  },
};

// Thought's preview is a small cloud, drawn from the same geometry as the bubble on the photo.
const previewCloudHeight = (bubble.referenceWidth * bubble.previewHeight) / bubble.previewWidth;
const previewCloud = cloudGeometry(previewCloudHeight);

function CloudPreview() {
  const { core, puffs } = previewCloud;
  return (
    <Svg
      width={bubble.previewWidth}
      height={bubble.previewHeight}
      viewBox={`0 0 ${bubble.referenceWidth} ${previewCloudHeight}`}
      testID="bubble-preview-cloud"
    >
      <Rect x={core.x} y={core.y} width={core.width} height={core.height} fill={colors.subtle} />
      {puffs.map((p, i) => (
        <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={colors.subtle} />
      ))}
    </Svg>
  );
}

/** One bubble style choice: a small preview of the shape over its name (Bubble). */
export function BubbleStyleTile({
  shape,
  label,
  selected,
  accessibilityHint,
  onPress,
  wide,
  testID,
}: BubbleStyleTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      style={[styles.tile, wide ? styles.wide : styles.narrow, selected ? styles.selected : styles.unselected]}
    >
      {shape === 'thought' ? <CloudPreview /> : <View style={[styles.preview, previews[shape]]} />}
      <Text style={[textStyle('label'), styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 72 px tall, as designed; grows with large text instead of clipping.
  tile: {
    minHeight: bubble.styleTile,
    borderRadius: bubble.styleTileRadius,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
  },
  narrow: { flexBasis: 0, flexGrow: 1 },
  wide: { flexBasis: '45%', flexGrow: 1 },
  selected: { borderWidth: bubble.styleTileBorderSelected, borderColor: colors.ink },
  // The 1 px border is padded by 1 px so choosing a style doesn't shift the tile's contents.
  unselected: { borderWidth: 1, borderColor: colors.border, padding: 1 },
  preview: { width: bubble.previewWidth, height: bubble.previewHeight, backgroundColor: colors.subtle },
  label: { color: colors.ink, textAlign: 'center' },
});
