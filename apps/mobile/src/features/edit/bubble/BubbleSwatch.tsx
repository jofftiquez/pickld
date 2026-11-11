import { Pressable, StyleSheet, View } from 'react-native';

import { hitSlopFor } from '@/lib/hitSlop';
import { bubble, bubbleColors, colors } from '@/theme/tokens';

import type { BubbleColor } from '../edits';

export type BubbleSwatchProps = {
  color: BubbleColor;
  /** Already translated, e.g. "Yellow". */
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

// The ring is always laid out (transparent until selected) so choosing a color doesn't shift the row.
const RING = bubble.swatch + 4 * bubble.swatchRing;

/** One bubble color: a 32 px circle with an ink ring when selected (Bubble). */
export function BubbleSwatch({ color, label, selected, onPress, testID }: BubbleSwatchProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={hitSlopFor(RING, RING)}
      testID={testID}
      style={[styles.ring, selected ? styles.ringSelected : null]}
    >
      <View style={[styles.swatch, { backgroundColor: bubbleColors[color].fill }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: bubble.swatchRing,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: { borderColor: colors.ink },
  swatch: {
    width: bubble.swatch,
    height: bubble.swatch,
    borderRadius: bubble.swatch / 2,
    borderWidth: 1,
    borderColor: bubble.swatchBorder,
  },
});
