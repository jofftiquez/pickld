import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { bubble, colors, space } from '@/theme/tokens';

import type { BubbleTail } from '../edits';

export type BubbleTailButtonProps = {
  tail: BubbleTail;
  /** Already translated: names the current side and what a tap does. */
  accessibilityLabel: string;
  accessibilityHint: string;
  /** Already translated, e.g. "Flip". */
  label: string;
  onPress: () => void;
  testID?: string;
};

// A small speech bubble with its point on the left, in a 26 × 18 box; mirrored for the right.
const GLYPH = 'M5 1h16a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9l-6 3 1.5-3.4A4 4 0 0 1 1 11V5a4 4 0 0 1 4-4z';

/** Flips the bubble's tail to the other side: a pill with a bubble showing the current side, then "Flip". */
export function BubbleTailButton({
  tail,
  accessibilityLabel,
  accessibilityHint,
  label,
  onPress,
  testID,
}: BubbleTailButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      hitSlop={hitSlopFor(undefined, bubble.flipHeight)}
      testID={testID}
      style={styles.button}
    >
      <Svg
        width={bubble.flipGlyphWidth}
        height={bubble.flipGlyphHeight}
        viewBox={`0 0 ${bubble.flipGlyphWidth} ${bubble.flipGlyphHeight + 1}`}
        style={tail === 'right' ? styles.mirrored : null}
        testID={`${testID}-glyph-${tail}`}
      >
        <Path d={GLYPH} fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinejoin="round" />
      </Svg>
      <Text style={[textStyle('label'), styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Grows with large text; the 36 px pill gets a 44 px tap area from hitSlop.
  button: {
    minHeight: bubble.flipHeight,
    minWidth: bubble.flipHeight + space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: bubble.flipHeight / 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  mirrored: { transform: [{ scaleX: -1 }] },
  label: { color: colors.ink },
});
