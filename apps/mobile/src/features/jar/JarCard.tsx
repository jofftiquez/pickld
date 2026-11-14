import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAX_LAYERS } from '@/components/JarGraphic';
import { PillButton } from '@/components/PillButton';
import type { Visibility } from '@/features/publish/publishJar';
import { PRESSED_OPACITY } from '@/components/BaseButton';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { JarTapReaction } from './JarTapReaction';

export type JarCardProps = {
  count: number;
  /** Null while unknown (signed out or loading): the line then leaves the reader count out. */
  readerCount: number | null;
  lidColor?: string;
  /** First day, nothing captured yet: "Your first jar" (EmptyToday) instead of the count and Publish. */
  firstDay: boolean;
  /** Opens Publish review; null disables Publish (no jar yet). */
  onPublish: (() => void) | null;
  /** The jar is published (TodayPublished): who sees it replaces the readers line, "21 likes · Published
   * 10:10 PM" goes under it, and the Published chip replaces Publish. `time` is already formatted in the
   * phone's zone. */
  published?: { visibility: Visibility; likeCount: number; time: string } | null;
  /** The Published chip and the card's words: open the jar's visibility menu (FR-PUB-03). */
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
      ? t(`today.shared.${published.visibility}`)
      : readerCount === null
        ? t(pastDay ? 'day.inJar' : 'today.inTodaysJar')
        : t(pastDay ? 'day.inJarReaders' : 'today.inTodaysJarReaders', { count: readerCount });
  // Published: likes and the time go on their own line under who sees it, in the text column, instead of
  // a third line under the jar that said who sees it again. Two pieces, so at large sizes the time wraps
  // whole under the likes.
  const likes = published ? t('today.likesDot', { likes: t('today.likes', { count: published.likeCount }) }) : null;
  const publishedAt = published ? t('today.publishedAt', { time: published.time }) : null;
  const publishedLine = likes !== null && publishedAt !== null ? `${likes} ${publishedAt}` : null;
  const lines = (
    <>
      <Text style={[textStyle('jarCardTitle'), { color: colors.surface }]}>{title}</Text>
      <Text style={[textStyle(firstDay ? 'bodySmall' : 'label', '500'), { color: colors.onDarkMuted }]}>
        {subtitle}
      </Text>
      {likes !== null && publishedAt !== null ? (
        <View style={styles.publishedLine} testID="today-published-line">
          <Text style={[textStyle('label', '500'), { color: colors.onDarkMuted }]}>{likes}</Text>
          <Text style={[textStyle('label', '500'), { color: colors.onDarkMuted }]}>{publishedAt}</Text>
        </View>
      ) : null}
    </>
  );
  const pill = firstDay ? null : published ? (
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
  );
  return (
    <View style={styles.card} testID={firstDay ? 'jar-card-first-day' : 'jar-card'}>
      {/* Large text: the jar sits above the words and the pill under them, so the words get the card's
          full width and never break mid-word or run past the card (NFR-A11Y-02). */}
      <View style={large ? styles.stack : styles.row}>
        {/* Tap the jar for a little reaction (D-131); the words and Publish keep their own taps. */}
        <JarTapReaction count={count} published={published !== null} lidColor={lidColor} closeLid={closeLid} />
        {published ? (
          // The words open the visibility menu too (FR-PUB-03), like the Published chip.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[title, subtitle, publishedLine].join(', ')}
            accessibilityHint={t('today.publishedHint')}
            onPress={() => onOpenVisibility?.()}
            style={({ pressed }) => [
              large ? styles.textStacked : styles.text,
              pressed ? { opacity: PRESSED_OPACITY } : null,
            ]}
            testID="today-published-text"
          >
            {lines}
          </Pressable>
        ) : (
          <View accessible style={large ? styles.textStacked : styles.text}>
            {lines}
          </View>
        )}
        {large ? null : pill}
      </View>
      {large && pill ? <View style={styles.pillBelow}>{pill}</View> : null}
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
  stack: { alignItems: 'flex-start', gap: space.md },
  textStacked: { alignSelf: 'stretch', gap: space.xs },
  pillBelow: { alignSelf: 'flex-start', marginTop: space.md },
  publishedLine: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xs },
});
