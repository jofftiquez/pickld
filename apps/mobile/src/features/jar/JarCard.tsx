import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { PillButton } from '@/components/PillButton';
import type { Visibility } from '@/features/publish/publishJar';
import { hitSlopFor } from '@/lib/hitSlop';
import { PRESSED_OPACITY } from '@/components/BaseButton';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type JarCardProps = {
  count: number;
  /** Null while unknown (signed out or loading): the line then leaves the reader count out. */
  readerCount: number | null;
  lidColor?: string;
  /** First day, nothing captured yet: "Your first jar" (EmptyToday) instead of the count and Publish. */
  firstDay: boolean;
  /** Opens Publish review; null disables Publish (no jar yet). */
  onPublish: (() => void) | null;
  /** The jar is published (TodayPublished): who sees it and its likes replace the readers line, the
   * Published chip replaces Publish, and "Published 10:10 PM · Readers" sits under them. `time` is
   * already formatted in the phone's zone. */
  published?: { visibility: Visibility; likeCount: number; time: string } | null;
  /** The Published chip and line: open the jar's visibility menu (FR-PUB-03). */
  onOpenVisibility?: () => void;
  /** A past day's jar on the day page (D-55): "in this jar" instead of "in today’s jar". */
  pastDay?: boolean;
  /** Just published (D-58): the jar's lid closes. */
  closeLid?: boolean;
};

/** The dark card above the grid: the jar filled to today's count, readers and Publish (Main, EmptyToday,
 * TodayPublished). */
export function JarCard({
  count,
  readerCount,
  lidColor,
  firstDay,
  onPublish,
  published = null,
  onOpenVisibility,
  pastDay = false,
  closeLid = false,
}: JarCardProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const title = firstDay ? t('today.firstJarTitle') : t('jar.moments', { count, total: MAX_LAYERS });
  const subtitle = firstDay
    ? t('today.firstJarBody')
    : published
      ? t('today.sharedLikes', {
          shared: t(`today.shared.${published.visibility}`),
          likes: t('today.likes', { count: published.likeCount }),
        })
      : readerCount === null
        ? t(pastDay ? 'day.inJar' : 'today.inTodaysJar')
        : t(pastDay ? 'day.inJarReaders' : 'today.inTodaysJarReaders', { count: readerCount });
  const publishedLine = published
    ? t('today.publishedLine', { time: published.time, visibility: t(`settings.visibility.${published.visibility}`) })
    : null;
  return (
    <View style={styles.card} testID={firstDay ? 'jar-card-first-day' : 'jar-card'}>
      <View style={[styles.row, large ? styles.rowWrap : null]}>
        <JarGraphic count={count} lidColor={lidColor} onDark decorative closeLid={closeLid} />
        <View accessible style={[styles.text, large ? styles.textLarge : null]}>
          <Text style={[textStyle('jarCardTitle'), { color: colors.surface }]}>{title}</Text>
          <Text style={[textStyle(firstDay ? 'bodySmall' : 'label', '500'), { color: colors.onDarkMuted }]}>
            {subtitle}
          </Text>
        </View>
        {firstDay ? null : published ? (
          <PillButton
            variant="onDark"
            icon="check"
            label={t('today.published')}
            accessibilityLabel={t('today.publishedLabel', { shared: t(`today.shared.${published.visibility}`) })}
            accessibilityHint={t('today.publishedHint')}
            onPress={() => onOpenVisibility?.()}
            testID="today-published"
          />
        ) : (
          <PillButton
            label={t('today.publish')}
            accessibilityHint={
              onPublish ? t(pastDay ? 'day.publishHint' : 'today.publishHint') : t('today.publishDisabledHint')
            }
            onPress={() => onPublish?.()}
            disabled={onPublish === null}
            testID="today-publish"
          />
        )}
      </View>
      {publishedLine !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={publishedLine}
          accessibilityHint={t('today.publishedHint')}
          onPress={() => onOpenVisibility?.()}
          hitSlop={hitSlopFor(undefined, LINE_HEIGHT)}
          style={({ pressed }) => [styles.line, pressed ? { opacity: PRESSED_OPACITY } : null]}
          testID="today-published-line"
        >
          <Text style={[textStyle('label', '600'), { color: colors.onDarkMuted }]}>{publishedLine}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// The published line's text height at the default size; hitSlop brings it to the 44 pt minimum.
const LINE_HEIGHT = 20;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: sizes.cardPadding,
    paddingRight: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: sizes.cardPadding },
  line: { alignSelf: 'flex-start', marginTop: space.md },
  text: { flex: 1, gap: space.xs },
  // Large text: Publish wraps below, so the count keeps the card's width instead of breaking mid-word.
  rowWrap: { flexWrap: 'wrap', rowGap: space.md },
  textLarge: { flexBasis: '60%' },
});
