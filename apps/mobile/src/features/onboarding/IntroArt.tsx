import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { JarGraphic } from '@/components/JarGraphic';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, slots, space } from '@/theme/tokens';

import { onboardingPhotos, type OnboardingPhoto } from './photos';

const GRID_GAP = space.sm + 2;

/** Slots drawn as filled on Intro1, as in the design. */
const FILLED = new Set(['whereami', 'ootd', 'selfie', 'morning']);

/** Intro1: the eight slots, half filled. */
function Slots() {
  const { t } = useTranslation();
  // Sized from the window: Yoga drops aspectRatio on percentage-width tiles in a wrapping row.
  const tileWidth = (useWindowDimensions().width - 2 * space.xxl - 3 * GRID_GAP) / 4;
  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const filled = FILLED.has(slot);
        return (
          <View
            key={slot}
            style={[
              styles.tile,
              { width: tileWidth, height: (tileWidth * 4) / 3 },
              filled ? styles.tileFilled : styles.tileEmpty,
            ]}
          >
            {/* An overlay, so the dashed border doesn't shrink the label's room as a real border would. */}
            {filled ? null : <View style={styles.tileDash} />}
            <Icon name={slot} color={filled ? 'brand' : 'ink'} size={20} />
            <Text style={[textStyle('caption'), { color: filled ? colors.surface : colors.ink }]} numberOfLines={1}>
              {t(`slots.${slot}`)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const AROUND: { photo: OnboardingPhoto; left: number; top: number; rotate: string }[] = [
  { photo: 'morning', left: 6, top: 24, rotate: '-10deg' },
  { photo: 'ootd', left: 236, top: 10, rotate: '8deg' },
  { photo: 'selfie', left: 0, top: 212, rotate: '7deg' },
  { photo: 'busy', left: 240, top: 220, rotate: '-6deg' },
];

/** Intro2: a jar five moments full, with photos around it. */
function Jar() {
  const { t } = useTranslation();
  return (
    <View style={styles.jarStage}>
      <View style={styles.halo} />
      <View style={styles.jarCenter}>
        <JarGraphic count={5} size={sizes.introJar} decorative />
      </View>
      {AROUND.map((p) => (
        <Image
          key={p.photo}
          source={onboardingPhotos[p.photo]}
          style={[styles.framed, { left: p.left, top: p.top, transform: [{ rotate: p.rotate }] }]}
          contentFit="cover"
          accessible={false}
        />
      ))}
      <View style={styles.countPill}>
        <Text style={[textStyle('bodySmall', '800'), { color: colors.brandText }]}>{t('intro.2.count')}</Text>
      </View>
    </View>
  );
}

/** Intro3: a real selfie with a sticker and a bubble, and the three promises. */
function Real() {
  const { t } = useTranslation();
  return (
    <View style={styles.realRow}>
      <View style={styles.hero}>
        <Image source={onboardingPhotos.selfie} style={styles.heroPhoto} contentFit="cover" accessible={false} />
        <View style={styles.sticker}>
          <Text style={[textStyle('bodySmall', '800'), { color: colors.ink }]}>{t('intro.3.sticker')}</Text>
        </View>
        <View style={styles.bubble}>
          <Text style={[textStyle('label', '700'), { color: colors.ink }]}>{t('intro.3.bubble')}</Text>
        </View>
      </View>
      <View style={styles.promises}>
        {(['noFilters', 'private', 'youPick'] as const).map((k) => (
          <View key={k} style={styles.promise}>
            <View style={styles.check}>
              <Icon name="check" color="brandText" size={14} strokeWidth={2.6} />
            </View>
            <Text style={[textStyle('bodyMedium', '600'), styles.promiseText]}>{t(`intro.3.${k}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The illustration for How it works page 1, 2 or 3. Decorative: the title and body say the same. */
export function IntroArt({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={styles.area} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {step === 1 ? <Slots /> : step === 2 ? <Jar /> : <Real />}
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: sizes.introArt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, width: '100%' },
  tile: {
    borderRadius: radius.introTile,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    ...shadow.card,
  },
  tileFilled: { backgroundColor: colors.ink },
  tileEmpty: { backgroundColor: colors.surface },
  tileDash: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.introTile,
    borderWidth: sizes.tileBorder,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
  },
  jarStage: { width: 320, height: 340 },
  halo: {
    position: 'absolute',
    left: 65,
    top: 51,
    width: 190,
    height: 238,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  jarCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  framed: {
    position: 'absolute',
    width: sizes.introPhoto,
    aspectRatio: 3 / 4,
    borderRadius: radius.thumbLg,
    borderWidth: sizes.photoFrame,
    borderColor: colors.surface,
    backgroundColor: colors.photoPlaceholder,
  },
  countPill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.xs + 2,
    ...shadow.tile,
  },
  realRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg + 2 },
  hero: { width: sizes.introHero, transform: [{ rotate: '-3deg' }] },
  heroPhoto: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.introHero,
    backgroundColor: colors.photoPlaceholder,
  },
  sticker: {
    position: 'absolute',
    left: -14,
    bottom: 26,
    backgroundColor: colors.brand,
    borderRadius: radius.thumb,
    paddingHorizontal: space.sm + 3,
    paddingVertical: space.xs + 2,
    transform: [{ rotate: '-6deg' }],
    ...shadow.tile,
  },
  bubble: {
    position: 'absolute',
    right: -10,
    top: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.thumbLg,
    borderBottomLeftRadius: space.xs,
    paddingHorizontal: space.sm + 2,
    paddingVertical: space.xs + 2,
    ...shadow.tile,
  },
  promises: { width: 150, gap: space.md },
  promise: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  check: {
    width: sizes.introCheck,
    height: sizes.introCheck,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promiseText: { flex: 1, color: colors.ink },
});
