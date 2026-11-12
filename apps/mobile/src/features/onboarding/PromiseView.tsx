import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import { HOLD_MS } from './useHold';

// The wordmark pre-coloured brand green (from splash-logo.png), so no runtime tint is needed.
const logo = require('../../../assets/brand/wordmark.png');
const LOGO_ASPECT = 1200 / 496;
const RING_STROKE = 6;
const RADIUS = (sizes.holdRing - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type PromiseViewProps = {
  insets: EdgeInsets;
  /** "Dale" */
  name: string;
  /** Today, formatted: "Nov 10, 2026". */
  date: string;
  holding: boolean;
  busy: boolean;
  failed: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  /** Screen readers: a double tap promises without holding. */
  onConfirm: () => void;
  onSkip: () => void;
  onBack?: () => void;
};

/** The Pickld Promise (FR-ONB-07): hold 1.5 s while the ring fills; Skip moves on. */
export function PromiseView({
  insets,
  name,
  date,
  holding,
  busy,
  failed,
  onPressIn,
  onPressOut,
  onConfirm,
  onSkip,
  onBack,
}: PromiseViewProps) {
  const { t } = useTranslation();
  const points = t('setup.promise.points', { returnObjects: true }) as unknown as string[];
  // The ring shows how long is left, so it animates even with Reduce Motion on (it isn't decoration).
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(holding || busy ? 1 : 0, {
      duration: holding ? HOLD_MS : 200,
      reduceMotion: ReduceMotion.Never,
    });
  }, [holding, busy, progress]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progress.value) }));

  return (
    <View style={styles.screen} testID="promise-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        {onBack ? (
          <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBack} testID="promise-back" />
        ) : (
          <View style={styles.backSpace} />
        )}
        <View style={styles.heading}>
          <Image
            source={logo}
            style={styles.logo}
            contentFit="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('setup.promise.logo')}
          />
          <Text accessibilityRole="header" style={[textStyle('onboardTitle'), styles.center, { color: colors.ink }]}>
            {t('setup.promise.title')}
          </Text>
          <Text style={[textStyle('body'), styles.center, { color: colors.inkSoft }]}>{t('setup.promise.body')}</Text>
        </View>
        <Card style={styles.card} testID="promise-card">
          {points.map((point) => (
            <View key={point} style={styles.point}>
              <Icon name="check" color="brand" size={22} />
              <Text style={[textStyle('body', '500'), styles.pointText]}>{point}</Text>
            </View>
          ))}
          <View style={styles.rule} />
          <View style={styles.signed}>
            <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>
              {t('setup.promise.signed', { name })}
            </Text>
            <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>{date}</Text>
          </View>
        </Card>
        {failed ? (
          <Text
            accessibilityRole="alert"
            style={[textStyle('bodySmall', '600'), styles.center, { color: colors.danger }]}
          >
            {t('setup.promise.failed')}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <View style={styles.holdArea}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('setup.promise.hold')}
            accessibilityHint={t('setup.promise.holdHint')}
            accessibilityState={{ busy, disabled: busy }}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && onConfirm()}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={busy}
            style={styles.ringBox}
            testID="promise-hold"
          >
            <Svg width={sizes.holdRing} height={sizes.holdRing} style={StyleSheet.absoluteFill}>
              <Circle
                cx={sizes.holdRing / 2}
                cy={sizes.holdRing / 2}
                r={RADIUS}
                stroke={colors.border}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={sizes.holdRing / 2}
                cy={sizes.holdRing / 2}
                r={RADIUS}
                stroke={colors.brand}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                animatedProps={ring}
                fill="none"
                rotation={-90}
                origin={`${sizes.holdRing / 2}, ${sizes.holdRing / 2}`}
              />
            </Svg>
            <View style={styles.holdButton}>
              <Icon name="fingerprint" color="surface" size={30} />
            </View>
          </Pressable>
          <Text style={[textStyle('body', '700'), { color: colors.ink }]}>
            {busy ? t('setup.promise.saved') : t('setup.promise.hold')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('setup.promise.skip')}
            onPress={onSkip}
            disabled={busy}
            hitSlop={hitSlopFor(undefined, 24)}
            style={styles.skip}
            testID="promise-skip"
          >
            <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{t('setup.promise.skip')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: space.xxl, gap: space.lg },
  backSpace: { height: sizes.roundButton },
  heading: { alignItems: 'center', gap: space.sm },
  logo: {
    width: sizes.promiseLogo,
    height: sizes.promiseLogo / LOGO_ASPECT,
  },
  center: { textAlign: 'center' },
  card: { gap: space.md, padding: space.xl, transform: [{ rotate: '-1deg' }] },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pointText: { flex: 1, color: colors.ink, lineHeight: 24 },
  rule: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginTop: space.xs },
  signed: { flexDirection: 'row', justifyContent: 'space-between' },
  spacer: { flex: 1, minHeight: space.lg },
  holdArea: { alignItems: 'center', gap: space.md },
  ringBox: { width: sizes.holdRing, height: sizes.holdRing, alignItems: 'center', justifyContent: 'center' },
  holdButton: {
    width: sizes.holdButton,
    height: sizes.holdButton,
    borderRadius: sizes.holdButton / 2,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: { alignItems: 'center', paddingVertical: space.xs },
});
