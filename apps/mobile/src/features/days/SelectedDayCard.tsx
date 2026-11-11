import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { JarGraphic } from '@/components/JarGraphic';
import { PrimaryButton } from '@/components/PrimaryButton';
import { holdsSlot, momentCount, type GridTile } from '@/features/jar/todayGrid';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { MOMENTS_PER_JAR } from './monthGrid';

export type SelectedDayCardProps = {
  /** "YYYY-MM-DD" */
  date: string;
  /** The day's 8 slots: its server moments merged with queued photos (`buildTodayGrid`). */
  tiles: readonly GridTile[];
  /** Before today in the phone zone: only past days can be filled. */
  isPast: boolean;
  onFill: () => void;
  locale?: string;
};

function dateTitle(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** The selected day under the My days calendar (Calendar, FR-DAY-02): moments, missing slots, Fill this jar. */
export function SelectedDayCard({ date, tiles, isPast, onFill, locale = deviceLocale() }: SelectedDayCardProps) {
  const { t } = useTranslation();
  const title = dateTitle(date, locale);
  const filled = tiles.filter(holdsSlot);
  const missing = tiles.filter((tile) => !holdsSlot(tile)).map((tile) => tile.slot);
  const count = momentCount(tiles);
  const addedLater = filled.filter((tile) => tile.addedLater).length;
  const canFill = isPast && missing.length > 0;

  return (
    <View style={styles.card} accessibilityLabel={t('myDays.selected.label')} testID="selected-day-card">
      {/* TODO(M3-07, #68): "View jar" on the right of this row once /jar/[id] exists. */}
      <View style={styles.titles}>
        <View style={styles.titleRow}>
          <JarGraphic count={count} size={sizes.dayCardJar} decorative />
          <Text accessibilityRole="header" style={[styles.title, textStyle('cardTitle'), { color: colors.ink }]}>
            {title}
          </Text>
        </View>
        <Text style={[textStyle('bodySmall'), { color: colors.muted }]} testID="selected-day-count">
          {t('myDays.selected.count', { count, total: MOMENTS_PER_JAR })}
          {addedLater > 0 ? t('myDays.selected.addedLater', { count: addedLater }) : null}
        </Text>
      </View>

      <View style={styles.thumbs}>
        {filled.map((tile) => (
          <View
            key={tile.slot}
            accessible
            accessibilityRole="image"
            accessibilityLabel={
              tile.addedLater
                ? t('myDays.selected.thumbAddedLater', { slot: t(`slots.${tile.slot}`) })
                : t(`slots.${tile.slot}`)
            }
            style={[styles.thumb, styles.photo]}
            testID={`selected-day-thumb-${tile.slot}`}
          >
            {tile.uri ? (
              <Image source={{ uri: tile.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            ) : null}
          </View>
        ))}
        {missing.map((slot) => (
          <View
            key={slot}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.thumb, styles.empty]}
            testID="selected-day-empty"
          />
        ))}
      </View>

      {missing.length > 0 ? (
        <View
          accessible
          accessibilityLabel={t('myDays.selected.missing', {
            slots: missing.map((slot) => t(`slots.${slot}`)).join(', '),
          })}
          style={styles.chips}
          testID="selected-day-missing"
        >
          {missing.map((slot) => (
            <View key={slot} style={styles.chip} testID={`selected-day-missing-${slot}`}>
              <Text style={[textStyle('label'), { color: colors.inkSoft }]}>
                {t('myDays.selected.addSlot', { slot: t(`slots.${slot}`) })}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {canFill ? (
        <>
          <PrimaryButton
            label={t('myDays.selected.fill')}
            accessibilityHint={t('myDays.selected.fillHint', { date: title })}
            onPress={onFill}
            testID="fill-this-jar"
          />
          <Text style={[styles.note, textStyle('caption', '500'), { color: colors.muted }]}>
            {t('myDays.selected.fillNote')}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.md,
    marginHorizontal: space.lg,
    padding: sizes.cardPadding,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    gap: space.md,
    ...shadow.card,
  },
  titles: { gap: space.xs / 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flexShrink: 1 },
  // Eight equal squares in one row, 5 pt apart like the calendar cells.
  thumbs: { flexDirection: 'row', gap: sizes.dayGap },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: radius.thumb, overflow: 'hidden' },
  photo: { backgroundColor: colors.photoPlaceholder },
  empty: { borderWidth: sizes.tileBorder, borderStyle: 'dashed', borderColor: colors.dashed },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md - 1,
    backgroundColor: colors.subtle,
  },
  note: { textAlign: 'center', marginTop: -space.xs },
});
