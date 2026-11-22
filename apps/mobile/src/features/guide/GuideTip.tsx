import { useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PillButton } from '@/components/PillButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { textStyle } from '@/theme/text';
import { colors, motion, radius, shadow, sizes, space } from '@/theme/tokens';

import type { GuideTipId } from './guideTips';
import type { GuideTipClose } from './useGuideTip';

export type GuideTipProps = {
  id: GuideTipId;
  /** Which side the arrow is on (toward the control the tip is about), and where along that side. */
  arrow: { side: 'top' | 'bottom'; align: 'start' | 'center' | 'end' };
  /** Discover's copy for accounts under 18, whose posts stay out of Discover. */
  minor?: boolean;
  onClose: (how: GuideTipClose) => void;
  tipRef?: RefObject<ComponentRef<typeof View> | null>;
};

/**
 * A first-time guide tip (FR-ONB-10): a small white card with an arrow, placed in the screen's own layout next
 * to the control it explains. It doesn't dim or cover the screen. Got it closes it; Turn off tips closes it and
 * every later tip. VoiceOver moves to it when it opens; it fades in, and appears at once with Reduce Motion.
 */
export function GuideTip({ id, arrow, minor = false, onClose, tipRef }: GuideTipProps) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const title = useRef<ComponentRef<typeof Text>>(null);

  useEffect(() => {
    const node = title.current;
    if (node) AccessibilityInfo.sendAccessibilityEvent(node, 'focus');
  }, []);

  const arrowStyle = [
    styles.arrow,
    arrow.side === 'top' ? styles.arrowTop : styles.arrowBottom,
    arrow.align === 'start' ? styles.arrowStart : arrow.align === 'end' ? styles.arrowEnd : styles.arrowCenter,
  ];
  return (
    <Animated.View
      ref={tipRef}
      entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}
      style={[styles.wrap, arrow.side === 'top' ? styles.wrapTop : styles.wrapBottom]}
      testID={`guide-tip-${id}`}
    >
      <View style={arrowStyle} />
      <View style={styles.card}>
        <Text ref={title} accessibilityRole="header" style={[textStyle('cardTitle', '800'), styles.title]}>
          {t(`guide.tips.${id}.title`)}
        </Text>
        <Text style={[textStyle('bodySmall'), styles.body]}>
          {minor && id === 'discover' ? t('guide.tips.discover.bodyMinor') : t(`guide.tips.${id}.body`)}
        </Text>
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('guide.turnOff')}
            accessibilityHint={t('guide.turnOffHint')}
            onPress={() => onClose('turn_off')}
            hitSlop={hitSlopFor(undefined, 24)}
            style={styles.turnOff}
            testID="guide-tip-off"
          >
            <Text style={[textStyle('bodySmall', '700'), styles.turnOffText]}>{t('guide.turnOff')}</Text>
          </Pressable>
          <PillButton label={t('guide.gotIt')} onPress={() => onClose('got_it')} testID="guide-tip-ok" />
        </View>
      </View>
    </Animated.View>
  );
}

const ARROW = 14;

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  wrapTop: { paddingTop: ARROW / 2 },
  wrapBottom: { paddingBottom: ARROW / 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.guideTip,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.xs,
    ...shadow.floating,
  },
  // A square turned 45° behind the card's edge, so half of it shows as the arrow.
  arrow: {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
  },
  arrowTop: { top: 0 },
  arrowBottom: { bottom: 0 },
  arrowStart: { left: space.xxl },
  arrowCenter: { left: '50%', marginLeft: -ARROW / 2 },
  arrowEnd: { right: space.xxl },
  title: { color: colors.ink },
  body: { color: colors.inkSoft, lineHeight: 19 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.xs,
    minHeight: sizes.minTap,
  },
  turnOff: { paddingVertical: space.xs },
  turnOffText: { color: colors.muted },
});
