import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { JarGraphic } from '@/components/JarGraphic';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space, type } from '@/theme/tokens';

import { CelebrationReveal } from './CelebrationReveal';
import { milestoneKeys, type MilestoneKey } from './celebrations';
import { Confetti } from './Confetti';

// The Milestones pack art (0012: stickers/milestones/<name>.png), bundled so it shows offline.
const stickerArt: Record<MilestoneKey, number> = {
  first_full_jar: require('../../../../../assets/stickers/milestones/first-full-jar.png'),
  full_jars_7: require('../../../../../assets/stickers/milestones/full-jars-7.png'),
  jars_30: require('../../../../../assets/stickers/milestones/jars-30.png'),
  jars_100: require('../../../../../assets/stickers/milestones/jars-100.png'),
  one_year: require('../../../../../assets/stickers/milestones/one-year.png'),
};

// The milestone the screen suggests next ("Next up: 7 full jars"); none after a year.
const nextUp: Record<MilestoneKey, MilestoneKey | null> = {
  first_full_jar: 'full_jars_7',
  full_jars_7: 'jars_30',
  jars_30: 'jars_100',
  jars_100: 'one_year',
  one_year: null,
};

// The art is about 3:1 (753 × 252 for First full jar); contain keeps each one whole.
const ART_ASPECT = 3;

export type StickerUnlockedViewProps = {
  milestone: MilestoneKey;
  /** Milestones the user has earned, including this one, for "1 of 5 earned". */
  earned: number;
  /** Confetti, or only a fade with Reduce Motion (NFR-A11Y-02). */
  reduceMotion: boolean;
  insets: EdgeInsets;
  onClose: () => void;
};

/** Sticker unlocked (StickerUnlock; FR-STK-05): the milestone's sticker over a full jar, and progress. */
export function StickerUnlockedView({ milestone, earned, reduceMotion, insets, onClose }: StickerUnlockedViewProps) {
  const { t } = useTranslation();
  const name = t(`stickerUnlocked.names.${milestone}`);
  const total = milestoneKeys.length;
  const count = Math.max(1, Math.min(total, earned));
  const next = nextUp[milestone];
  const body = [
    t(`stickerUnlocked.leads.${milestone}`),
    t('stickerUnlocked.earnedLine', { name }),
    ...(next !== null ? [t('stickerUnlocked.nextUp', { name: t(`stickerUnlocked.names.${next}`) })] : []),
  ].join(' ');
  return (
    <View testID="sticker-unlocked" style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {reduceMotion ? null : <Confetti />}
      <View style={styles.header}>
        <RoundIconButton
          icon="close"
          accessibilityLabel={t('stickerUnlocked.close')}
          onPress={onClose}
          testID="sticker-unlocked-close"
        />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <CelebrationReveal reduceMotion={reduceMotion} style={styles.content}>
          <View style={styles.art}>
            <View style={styles.halo} />
            <JarGraphic count={8} size={sizes.unlockJar} decorative />
            <View style={styles.sticker}>
              <Image
                testID="sticker-unlocked-art"
                source={stickerArt[milestone]}
                contentFit="contain"
                accessible
                accessibilityRole="image"
                accessibilityLabel={t('stickerUnlocked.art', { name })}
                style={styles.stickerImage}
              />
            </View>
          </View>
          <Text style={[textStyle('eyebrow'), styles.eyebrow]}>{t('stickerUnlocked.eyebrow')}</Text>
          <Text
            maxFontSizeMultiplier={maxTextScale.title}
            accessibilityRole="header"
            style={[textStyle('unlockTitle'), styles.title]}
          >
            {t(`stickerUnlocked.titles.${milestone}`)}
          </Text>
          <Text style={[textStyle('body', '400'), styles.body]}>{body}</Text>
          <View style={styles.progressCard} accessible>
            <Text style={[textStyle('bodySmall', '700'), styles.progressLabel]}>{t('stickerUnlocked.milestones')}</Text>
            <Text style={[textStyle('label', '400'), { color: colors.muted }]}>
              {t('stickerUnlocked.progress', { count, total })}
            </Text>
            <View style={styles.track}>
              <View testID="milestone-progress" style={[styles.fill, { width: `${(count / total) * 100}%` }]} />
            </View>
          </View>
        </CelebrationReveal>
      </ScrollView>
      <View style={styles.actions}>
        {/* TODO(M2-15 Stickers tool, M4-11 Share jar card): the design's Use it now and Share my full jar. */}
        <PrimaryButton
          label={t('stickerUnlocked.done')}
          accessibilityHint={t('stickerUnlocked.doneHint')}
          onPress={onClose}
          testID="sticker-unlocked-done"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: space.xxl, paddingHorizontal: space.lg },
  scroll: { flexGrow: 1, paddingHorizontal: space.xxxl },
  content: { alignItems: 'center', gap: space.sm + 2 },
  art: {
    width: sizes.unlockArt,
    height: sizes.unlockArtHeight,
    marginTop: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    top: space.xl,
    bottom: space.xl,
    left: space.xl,
    right: space.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  sticker: { position: 'absolute', right: -space.xxl, top: space.xxxl, transform: [{ rotate: '10deg' }] },
  stickerImage: { width: sizes.unlockSticker, aspectRatio: ART_ASPECT },
  eyebrow: { color: colors.brandText, textTransform: 'uppercase' },
  title: { color: colors.ink, textAlign: 'center' },
  body: { color: colors.inkSoft, textAlign: 'center', lineHeight: Math.round(type.body.size * 1.5) },
  progressCard: {
    alignSelf: 'stretch',
    marginTop: space.sm - 2,
    backgroundColor: colors.surface,
    borderRadius: radius.milestoneCard,
    paddingVertical: space.md,
    paddingHorizontal: sizes.bannerPaddingX,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm + 2,
    ...shadow.card,
  },
  progressLabel: { color: colors.ink, flex: 1 },
  track: {
    width: sizes.progressBarWidth,
    height: sizes.progressBarHeight,
    borderRadius: radius.progressBar,
    backgroundColor: colors.segmentTrack,
    overflow: 'hidden',
  },
  fill: { height: sizes.progressBarHeight, backgroundColor: colors.brand },
  actions: { paddingHorizontal: space.xxxl, paddingTop: space.md, paddingBottom: space.xxxl },
});
