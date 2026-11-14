import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, lidColors, radius } from '@/theme/tokens';

import { BURST_DURATION_MS, BURST_PIECES, burstFrame, makeBurstPieces, type BurstPiece } from './confettiPhysics';

type Props = { piece: BurstPiece; clock: SharedValue<number>; width: number; height: number };

function BurstPieceView({ piece, clock, width, height }: Props) {
  // Only transform and opacity change per frame (no layout), all worked out on the UI thread.
  const style = useAnimatedStyle(() => {
    const frame = burstFrame(piece, clock.value, width, height);
    return {
      opacity: frame.opacity,
      transform: [
        { translateX: frame.x - piece.width / 2 },
        { translateY: frame.y - piece.height / 2 },
        { rotate: `${frame.rotate}deg` },
        { scaleY: frame.flip },
      ],
    };
  });
  const glint = useAnimatedStyle(() => ({ opacity: burstFrame(piece, clock.value, width, height).glint }));
  const rounding = piece.shape === 'dot' ? piece.width / 2 : radius.confettiStrip;
  return (
    <Animated.View
      testID="confetti-piece"
      style={[
        styles.piece,
        {
          width: piece.width,
          height: piece.height,
          borderRadius: rounding,
          backgroundColor: lidColors[piece.color],
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.glint, { borderRadius: rounding }, glint]} />
    </Animated.View>
  );
}

// Each burst gets its own scatter; the same mount always gets the same one.
let bursts = 0;

/**
 * Confetti thrown up and out of the jar card after Publish (D-132, D-133): it slows in the air, then floats down
 * like light paper, each piece at its own pace, zigzagging as it tumbles, and fades. Decorative, so screen readers skip it; the caller leaves it out with Reduce Motion.
 */
export function ConfettiBurst() {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() => makeBurstPieces(BURST_PIECES, ++bursts));
  // One clock in seconds for every piece.
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = withTiming(BURST_DURATION_MS / 1000, { duration: BURST_DURATION_MS, easing: Easing.linear });
  }, [clock]);
  return (
    <View
      testID="confetti"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {pieces.map((piece, i) => (
        <BurstPieceView key={i} piece={piece} clock={clock} width={width} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  glint: { backgroundColor: colors.confettiGlint },
});
