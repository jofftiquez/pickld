import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { lidColors, motion, radius } from '@/theme/tokens';

type Piece = {
  /** Resting place as a share of the screen (the designs' 390 × 844 frame). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Round dot, or a strip with slightly rounded ends. */
  round: boolean;
  rotate: number;
  color: keyof typeof lidColors;
};

// The eight pieces of FullJar and StickerUnlock.
const PIECES: readonly Piece[] = [
  { x: 60 / 390, y: 170 / 844, width: 10, height: 10, round: true, rotate: 0, color: 'pickle' },
  { x: 310 / 390, y: 150 / 844, width: 8, height: 4, round: false, rotate: 20, color: 'mango' },
  { x: 90 / 390, y: 300 / 844, width: 7, height: 3, round: false, rotate: -15, color: 'ube' },
  { x: 300 / 390, y: 320 / 844, width: 11, height: 11, round: true, rotate: 0, color: 'sunset' },
  { x: 50 / 390, y: 560 / 844, width: 8, height: 8, round: true, rotate: 0, color: 'sky' },
  { x: 330 / 390, y: 560 / 844, width: 9, height: 4, round: false, rotate: 35, color: 'pickle' },
  { x: 200 / 390, y: 130 / 844, width: 7, height: 7, round: true, rotate: 0, color: 'sunset' },
  { x: 170 / 390, y: 600 / 844, width: 8, height: 4, round: false, rotate: -30, color: 'mango' },
];

// Each piece drops this far onto its resting place and turns a little on the way.
const DROP = 160;
const SPIN = 180;
const STAGGER = 60;

function ConfettiPiece({ piece, index }: { piece: Piece; index: number }) {
  const fall = useSharedValue(0);
  useEffect(() => {
    fall.value = withDelay(
      index * STAGGER,
      withTiming(1, { duration: motion.confettiFall, easing: Easing.out(Easing.cubic) }),
    );
  }, [fall, index]);
  const style = useAnimatedStyle(() => ({
    opacity: fall.value,
    transform: [{ translateY: -DROP * (1 - fall.value) }, { rotate: `${piece.rotate - SPIN * (1 - fall.value)}deg` }],
  }));
  return (
    <Animated.View
      testID="confetti-piece"
      style={[
        styles.piece,
        {
          left: `${piece.x * 100}%`,
          top: `${piece.y * 100}%`,
          width: piece.width,
          height: piece.height,
          borderRadius: piece.round ? piece.width / 2 : radius.confettiStrip,
          backgroundColor: lidColors[piece.color],
        },
        style,
      ]}
    />
  );
}

/** Falling confetti behind a celebration (FullJar, StickerUnlock). Not rendered with Reduce Motion (NFR-A11Y-02). */
export function Confetti() {
  return (
    <View
      testID="confetti"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {PIECES.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute' },
});
