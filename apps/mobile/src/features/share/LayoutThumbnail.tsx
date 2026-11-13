import { Pressable, StyleSheet, View } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { colors, radius, sizes } from '@/theme/tokens';

import { canvasSize, type StoryFormat, type StoryLayout } from './storyLayout';

export type LayoutThumbnailProps = {
  layout: StoryLayout;
  format: StoryFormat;
  selected: boolean;
  /** "Layout: 2 by 2 grid". Already translated. */
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
};

const RING = 2; // the selected ring, as on the background swatches
const GAP = 2; // white space between the ring and the thumbnail

/**
 * A small schematic of a share card layout (D-62): the card's shape with a block where each photo goes,
 * drawn from the same rectangles as the card itself, so it can't drift from what is exported.
 */
export function LayoutThumbnail({
  layout,
  format,
  selected,
  accessibilityLabel,
  onPress,
  testID,
}: LayoutThumbnailProps) {
  const canvas = canvasSize(format);
  const height = sizes.shareLayoutThumb;
  const scale = height / canvas.height;
  const width = canvas.width * scale;
  const outer = { width: width + 2 * (RING + GAP), height: height + 2 * (RING + GAP) };
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      hitSlop={hitSlopFor(outer.width, outer.height)}
      style={[styles.ring, outer, selected && styles.ringSelected]}
      testID={testID}
    >
      <View style={[styles.frame, { width, height }]}>
        {layout.cells.map((cell, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              { left: cell.x * scale, top: cell.y * scale, width: cell.width * scale, height: cell.height * scale },
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    padding: GAP,
    borderWidth: RING,
    borderColor: 'transparent',
    borderRadius: radius.shareLayout + RING + GAP,
  },
  ringSelected: { borderColor: colors.ink },
  frame: {
    borderRadius: radius.shareLayout,
    backgroundColor: colors.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cell: { position: 'absolute', borderRadius: radius.shareLayoutCell, backgroundColor: colors.muted },
});
