import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { JarGraphic } from '@/components/JarGraphic';
import { tapHaptic } from '@/lib/haptics';
import { motion, sizes } from '@/theme/tokens';

import { jarReaction, type JarReaction } from './jarReaction';

export type JarTapReactionProps = {
  count: number;
  published: boolean;
  lidColor?: string;
  closeLid?: boolean;
};

// The jar easter egg (D-131): the jar on Today and a day page reacts to a tap, more the fuller it is. Every
// reaction is under ~0.8 s and lands back at rest; a tap mid-reaction restarts it. The jar sits beside the
// card's words and Publish, never over them, so their taps are untouched.
const BOUNCE = { damping: 7, stiffness: 260, mass: 0.7 };
const SETTLE = { damping: 12, stiffness: 300, mass: 0.7 };
const OVERLAY_ICON = 16;

const timing = (to: number, duration: number) => withTiming(to, { duration, easing: Easing.inOut(Easing.quad) });

type Motion = {
  lift: SharedValue<number>;
  tilt: SharedValue<number>;
  stretchX: SharedValue<number>;
  stretchY: SharedValue<number>;
};

// Writes one reaction into the jar's shared values. Distances are in px at the card's 52 px jar.
function play({ mood, variant, strength: s }: JarReaction, { lift, tilt, stretchX, stretchY }: Motion) {
  switch (mood) {
    case 'empty':
      // Nothing inside yet: a shiver, or a slow lean side to side as if looking for something.
      tilt.value =
        variant === 0
          ? withSequence(timing(-6 * s, 50), timing(6 * s, 70), timing(-5 * s, 70), timing(4 * s, 70), timing(0, 60))
          : withSequence(timing(-10 * s, 180), timing(8 * s, 220), withSpring(0, SETTLE));
      return;
    case 'few':
      // A few moments: a small hop, or two little ones.
      lift.value =
        variant === 0
          ? withSequence(timing(-8 * s, 140), withSpring(0, BOUNCE))
          : withSequence(timing(-6 * s, 110), timing(0, 110), timing(-4 * s, 90), withSpring(0, BOUNCE));
      return;
    case 'half':
      // Half full: a squash-and-stretch jiggle, the second variant with a wobble too.
      stretchX.value = withSequence(timing(1 + 0.12 * s, 90), timing(1 - 0.08 * s, 110), withSpring(1, BOUNCE));
      stretchY.value = withSequence(timing(1 - 0.1 * s, 90), timing(1 + 0.08 * s, 110), withSpring(1, BOUNCE));
      if (variant === 1) tilt.value = withSequence(timing(5 * s, 100), timing(-5 * s, 120), withSpring(0, SETTLE));
      return;
    case 'nearlyFull':
      // Nearly full: a big bounce with a flip of the hips, landing with a squash.
      lift.value = withSequence(timing(-14 * s, 170), timing(0, 150), withSpring(0, BOUNCE));
      tilt.value = withSequence(timing((variant === 0 ? 8 : -8) * s, 170), timing(0, 150));
      stretchY.value = withSequence(timing(1.06, 170), timing(0.88, 150), withSpring(1, BOUNCE));
      stretchX.value = withSequence(timing(0.96, 170), timing(1.1, 150), withSpring(1, BOUNCE));
      return;
    case 'full':
      // 8 of 8: a proud jump, or a double jump with a little shimmy, while the lid pops and sparkles fly.
      lift.value =
        variant === 0
          ? withSequence(timing(-12 * s, 180), withSpring(0, BOUNCE))
          : withSequence(timing(-10 * s, 150), timing(0, 120), timing(-8 * s, 130), withSpring(0, BOUNCE));
      if (variant === 1) tilt.value = withSequence(timing(-4, 150), timing(4, 250), withSpring(0, SETTLE));
      return;
    case 'published':
      // Published: the lid rattles, the jar sways happily and a heart floats up.
      tilt.value = withSequence(timing(-6 * s, 140), timing(6 * s, 180), withSpring(0, SETTLE));
      lift.value = variant === 0 ? withSequence(timing(-4 * s, 140), withSpring(0, BOUNCE)) : timing(0, 0);
      return;
  }
}

/** The jar on the Today and day page jar card, tappable for a little reaction. */
export function JarTapReaction({ count, published, lidColor, closeLid }: JarTapReactionProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const taps = useRef(0);
  const [burst, setBurst] = useState<{ id: number; reaction: JarReaction } | null>(null);
  const [lidHop, setLidHop] = useState(0);
  const lift = useSharedValue(0);
  const tilt = useSharedValue(0);
  const stretchX = useSharedValue(1);
  const stretchY = useSharedValue(1);
  const dim = useSharedValue(1);

  const onPress = () => {
    const reaction = jarReaction(count, published, taps.current);
    taps.current += 1;
    tapHaptic();
    if (reaction.lidHop) setLidHop((n) => n + 1);
    if (reaction.overlay) setBurst({ id: taps.current, reaction });
    if (reduceMotion) {
      // Reduce Motion: a soft blink in place, no movement (NFR-A11Y-02).
      // Reanimated skips System-mode animations under Reduce Motion, so the fade opts out to still play.
      dim.value = withSequence(
        withTiming(0.55, { duration: motion.fast, reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: motion.base, reduceMotion: ReduceMotion.Never }),
      );
      return;
    }
    play(reaction, { lift, tilt, stretchX, stretchY });
  };

  const jarStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
    transform: [
      { translateY: lift.value },
      { rotate: `${tilt.value}deg` },
      { scaleX: stretchX.value },
      { scaleY: stretchY.value },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('jar.tapLabel')}
      accessibilityHint={t('jar.tapHint')}
      onPress={onPress}
      testID="jar-tap"
    >
      <Animated.View style={[styles.jar, jarStyle]}>
        <JarGraphic count={count} lidColor={lidColor} onDark decorative closeLid={closeLid} lidHop={lidHop} />
      </Animated.View>
      {burst?.reaction.overlay ? (
        <Burst key={burst.id} kind={burst.reaction.overlay} variant={burst.reaction.variant} still={reduceMotion} />
      ) : null}
    </Pressable>
  );
}

// Offsets from the burst's start over the jar's shoulders. They stay short so the white heart and the sparkles
// fade out inside the dark card instead of over the light page above it.
const SPARKS = [
  { x: -24, y: -10 },
  { x: 0, y: -20 },
  { x: 24, y: -10 },
];
const HEART_RISE = -20;
// The heart rises beside the jar, over the dark card, not over the jar's green layers.
const HEART_SIDE = 30;
const BURST_TOP = 20;

/** Sparkles (full jar) or a heart (published) that rise from the lid and fade. With Reduce Motion they fade
 * in place without moving. Remounted per tap. */
function Burst({ kind, variant, still }: { kind: 'sparkle' | 'heart'; variant: 0 | 1; still: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    // A fade, so it plays under Reduce Motion too (Reanimated would otherwise skip straight to the end).
    progress.value = withTiming(1, {
      duration: kind === 'heart' ? 800 : 650,
      easing: Easing.out(Easing.quad),
      reduceMotion: ReduceMotion.Never,
    });
  }, [kind, progress]);
  const pieces = kind === 'heart' ? [{ x: (variant === 0 ? 1 : -1) * HEART_SIDE, y: HEART_RISE }] : SPARKS;
  return (
    <View
      pointerEvents="none"
      style={styles.burst}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((piece, i) => (
        <BurstPiece key={i} piece={piece} progress={progress} still={still} kind={kind} />
      ))}
    </View>
  );
}

function BurstPiece({
  piece,
  progress,
  still,
  kind,
}: {
  piece: { x: number; y: number };
  progress: SharedValue<number>;
  still: boolean;
  kind: 'sparkle' | 'heart';
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // In for the first quarter, out over the rest.
    const opacity = p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75;
    if (still) return { opacity };
    return {
      opacity,
      transform: [
        { translateX: piece.x * p },
        { translateY: piece.y * p },
        { scale: 0.5 + 0.6 * Math.min(1, p * 2) },
        { rotate: `${kind === 'sparkle' ? 90 * p : 0}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.piece, style]} testID={`jar-burst-${kind}`}>
      <Icon
        name={kind}
        color={kind === 'heart' ? 'surface' : 'brandLayer'}
        size={OVERLAY_ICON}
        filled={kind === 'heart'}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The jar wobbles around its base, like a jar set down on a table.
  jar: { transformOrigin: 'center bottom' },
  burst: {
    position: 'absolute',
    top: BURST_TOP,
    left: 0,
    width: sizes.jarCardGraphic,
    alignItems: 'center',
  },
  piece: { position: 'absolute', top: 0 },
});
