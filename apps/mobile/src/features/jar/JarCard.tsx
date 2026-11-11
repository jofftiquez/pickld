import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { PillButton } from '@/components/PillButton';
import type { Visibility } from '@/features/publish/publishJar';
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
  /** The jar is published (TodayPublished): who sees it and its likes replace the readers line, and the
   * Published chip replaces Publish. */
  published?: { visibility: Visibility; likeCount: number } | null;
  /** The Published chip: opens the jar's visibility menu (FR-PUB-03). */
  onOpenVisibility?: () => void;
};

/** The dark card above the grid: the jar filled to today's count, readers and Publish (Main, EmptyToday). */
export function JarCard({
  count,
  readerCount,
  lidColor,
  firstDay,
  onPublish,
  published = null,
  onOpenVisibility,
}: JarCardProps) {
  const { t } = useTranslation();
  const title = firstDay ? t('today.firstJarTitle') : t('jar.moments', { count, total: MAX_LAYERS });
  const subtitle = firstDay
    ? t('today.firstJarBody')
    : published
      ? t('today.sharedLikes', {
          shared: t(`today.shared.${published.visibility}`),
          likes: t('today.likes', { count: published.likeCount }),
        })
      : readerCount === null
        ? t('today.inTodaysJar')
        : t('today.inTodaysJarReaders', { count: readerCount });
  return (
    <View style={styles.card} testID={firstDay ? 'jar-card-first-day' : 'jar-card'}>
      <View style={styles.row}>
        <JarGraphic count={count} lidColor={lidColor} onDark decorative />
        <View accessible style={styles.text}>
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
            accessibilityHint={onPublish ? t('today.publishHint') : t('today.publishDisabledHint')}
            onPress={() => onPublish?.()}
            disabled={onPublish === null}
            testID="today-publish"
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    padding: sizes.cardPadding,
    paddingRight: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: sizes.cardPadding },
  text: { flex: 1, gap: space.xs },
});
