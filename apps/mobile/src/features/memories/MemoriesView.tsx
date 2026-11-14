import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { MomentThumb } from '@/features/moment/MomentThumb';
import { momentRender } from '@/features/moment/momentRenders';
import { deviceLocale, formatDate } from '@/lib/format';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, memories as m, radius, space } from '@/theme/tokens';

import type { Memories, RecapPhoto } from './memories';

const MOMENTS_PER_JAR = 8;

export type MemoriesViewProps = {
  /** Undefined while loading. */
  data: Memories | undefined;
  failed?: boolean;
  insets: EdgeInsets;
  locale?: string;
  onBack: () => void;
  onRetry: () => void;
  onOpenJar: (jarId: string) => void;
  onOpenPhoto: (photo: RecapPhoto) => void;
  onYear: () => void;
};

/** A calendar date (YYYY-MM-DD) as a Date at noon UTC, so formatting in UTC keeps its own day. */
const atNoon = (localDate: string) => new Date(`${localDate}T12:00:00Z`);

/**
 * Memories (FR-DAY-03): an On this day card from the newest earlier year, last month's recap (moments, full days,
 * top tag, a strip of five photos and Play) and the year so far.
 */
export function MemoriesView({
  data,
  failed = false,
  insets,
  locale = deviceLocale(),
  onBack,
  onRetry,
  onOpenJar,
  onOpenPhoto,
  onYear,
}: MemoriesViewProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }}
      testID="memories"
    >
      <View style={styles.header}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('screenTitle'), styles.title]}
        >
          {t('memories.title')}
        </Text>
        <RoundIconButton icon="back" accessibilityLabel={t('memories.back')} onPress={onBack} testID="memories-back" />
      </View>

      <View style={styles.content}>
        {data === undefined ? (
          <View style={styles.message}>
            {failed ? (
              <>
                <Text style={[textStyle('body'), styles.center]}>{t('memories.failed')}</Text>
                <SecondaryButton label={t('memories.retry')} onPress={onRetry} testID="memories-retry" />
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.muted} />
                <Text style={[textStyle('body'), styles.center]}>{t('memories.loading')}</Text>
              </>
            )}
          </View>
        ) : (
          <>
            {data.onThisDay ? <OnThisDayCard memory={data.onThisDay} locale={locale} onOpen={onOpenJar} /> : null}
            <RecapCard recap={data.recap} locale={locale} onOpenPhoto={onOpenPhoto} />
            <Pressable
              onPress={onYear}
              accessibilityRole="button"
              accessibilityLabel={`${t('memories.yearTitle', { year: data.year.year })}. ${t('memories.yearBody', { count: data.year.jarsFilled })}`}
              testID="memories-year"
            >
              <Card style={styles.yearRow}>
                <View style={styles.yearIcon}>
                  <Icon name="sparkle" size={22} strokeWidth={2} color="brandText" />
                </View>
                <View style={styles.rowText}>
                  <Text style={[textStyle('body', '700'), { color: colors.ink }]}>
                    {t('memories.yearTitle', { year: data.year.year })}
                  </Text>
                  <Text style={[textStyle('label', '500'), { color: colors.muted }]}>
                    {t('memories.yearBody', { count: data.year.jarsFilled })}
                  </Text>
                </View>
                <Icon name="chevronRight" size={20} strokeWidth={2} color="chevron" />
              </Card>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function OnThisDayCard({
  memory,
  locale,
  onOpen,
}: {
  memory: NonNullable<Memories['onThisDay']>;
  locale: string;
  onOpen: (jarId: string) => void;
}) {
  const { t } = useTranslation();
  const day = atNoon(memory.localDate);
  const date = formatDate(day, 'UTC', locale);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(day);
  const title = t('memories.dayTitle', { weekday });
  const ago = t('memories.yearsAgo', { count: memory.yearsAgo });
  const moments = t('memories.dayMoments', { count: memory.momentCount, total: MOMENTS_PER_JAR });
  const cover = momentRender(memory.photoRender);
  return (
    <Pressable
      onPress={() => onOpen(memory.jarId)}
      style={styles.hero}
      accessibilityRole="button"
      accessibilityLabel={t('memories.onThisDayLabel', { title, date: `${date}, ${ago}`, moments })}
      testID="memories-on-this-day"
    >
      <MomentThumb
        uri={memory.photoUrl}
        edits={cover?.edits}
        stamp={cover?.stamp}
        testID="memories-on-this-day-photo"
      />
      <LinearGradient
        colors={[colors.photoFadeClear, colors.photoFade]}
        pointerEvents="none"
        style={[styles.heroFade, { height: `${m.heroFade * 100}%` }]}
      />
      <View style={styles.heroChip}>
        <Text style={[textStyle('label', '700'), { color: colors.ink }]}>{t('memories.onThisDay')}</Text>
      </View>
      <View style={styles.heroText}>
        <Text style={[textStyle('bodySmall', '600'), { color: colors.onPhotoMuted }]}>
          {t('memories.dateAgo', { date, ago })}
        </Text>
        <Text style={[textStyle('profileName'), { color: colors.surface }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[textStyle('bodySmall'), { color: colors.onPhotoMuted }]}>{moments}</Text>
      </View>
    </Pressable>
  );
}

function RecapCard({
  recap,
  locale,
  onOpenPhoto,
}: {
  recap: Memories['recap'];
  locale: string;
  onOpenPhoto: (photo: RecapPhoto) => void;
}) {
  const { t } = useTranslation();
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(atNoon(`${recap.month}-15`));
  const empty = recap.momentCount === 0;
  const parts = [
    t('memories.recapMoments', { count: recap.momentCount }),
    t('memories.recapFull', { count: recap.fullDays }),
    ...(recap.topSlot ? [t('memories.recapTag', { tag: t(`slots.${recap.topSlot}`) })] : []),
  ];
  const first = recap.photos[0];
  return (
    <Card testID="memories-recap">
      <View style={styles.recapHead}>
        <View style={styles.rowText}>
          <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('memories.recapTitle', { month })}</Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]}>
            {empty ? t('memories.recapEmpty', { month }) : parts.join(' · ')}
          </Text>
        </View>
        {first ? (
          <PillButton
            label={t('memories.play')}
            accessibilityLabel={t('memories.playLabel', { month })}
            onPress={() => onOpenPhoto(first)}
            testID="memories-play"
          />
        ) : null}
      </View>
      {recap.photos.length > 0 ? (
        <View style={styles.strip}>
          {recap.photos.map((photo) => (
            <Pressable
              key={photo.momentId}
              onPress={() => onOpenPhoto(photo)}
              style={styles.stripCell}
              accessibilityRole="button"
              accessibilityLabel={t('memories.photoLabel', { slot: t(`slots.${photo.slot}`) })}
              testID={`memories-photo-${photo.momentId}`}
            >
              <RecapThumb photo={photo} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** A recap photo with its edits when it has any (D-96). */
function RecapThumb({ photo }: { photo: RecapPhoto }) {
  const render = momentRender(photo.render);
  return (
    <MomentThumb
      uri={photo.thumbUrl}
      edits={render?.edits}
      stamp={render?.stamp}
      testID={`memories-photo-${photo.momentId}-photo`}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  title: { color: colors.ink, flexShrink: 1 },
  content: { paddingHorizontal: space.xl, gap: space.md },
  hero: {
    height: m.heroHeight,
    borderRadius: m.heroRadius,
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
  },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroChip: {
    position: 'absolute',
    top: space.md + 2,
    left: space.md + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md - 2,
    paddingVertical: space.xs,
  },
  heroText: { position: 'absolute', left: space.lg + 2, right: space.lg + 2, bottom: space.lg, gap: 3 },
  recapHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowText: { flex: 1, gap: 2 },
  strip: { flexDirection: 'row', gap: m.stripGap, marginTop: space.md },
  stripCell: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: radius.thumb,
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
  },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  yearIcon: {
    width: m.yearIcon,
    height: m.yearIcon,
    borderRadius: m.yearIconRadius,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { gap: space.md, paddingVertical: space.xxl, alignItems: 'center' },
  center: { textAlign: 'center', color: colors.muted },
});
