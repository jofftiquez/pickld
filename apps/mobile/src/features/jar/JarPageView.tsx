import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BaseButton } from '@/components/BaseButton';
import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { deviceLocale } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { buildJarPage, isLiked, type JarMoment, type JarPageData, type LikeTarget } from './jarPage';
import { CommentsButton } from './CommentsButton';
import { LikeButton } from './LikeButton';
import { JarTile } from './JarTile';
import { jarTitle } from './shareJar';

export type JarPageViewProps = {
  /** Undefined while loading; null when the jar isn't available to this viewer. */
  data: JarPageData | null | undefined;
  /** The request failed and nothing is cached. */
  failed?: boolean;
  /** The author's signed avatar (D-93); initials without it. */
  authorAvatarUrl?: string | null;
  insets: EdgeInsets;
  onBack: () => void;
  /** Likes or unlikes the jar (FR-SOC-05). */
  onToggleLike?: (target: LikeTarget) => void;
  /** Opens the jar's Comments. */
  onOpenComments?: () => void;
  /** Opens Moment detail for a moment on the page. */
  onOpenMoment?: (momentId: string) => void;
  /** Opens the author's profile from their avatar. */
  onOpenAuthor?: () => void;
  /** Opens the share card; only offered on the viewer's own jar (D-83). */
  onShare: () => void;
  /** More options on someone else's jar: Report (M3-21). Not shown to the owner. */
  onMore?: () => void;
  onRetry: () => void;
  locale?: string;
};

const GRID_COLUMNS = 2;
const GRID_GAP = space.md;

function formatJarDate(localDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

/**
 * One person's jar for one day (Story; FR-SOC-03, FR-JAR-06): a plain header with Back, the author, the day,
 * the count and the Full jar tag, then every shown moment in the same 2 by 4 grid as Today, in slot order,
 * whole at 3:4, the cover badged "Cover" (D-97, D-98), and a floating bar with likes, comments and, on the
 * viewer's own jar, Share jar (D-83).
 */
export function JarPageView({
  data,
  failed = false,
  authorAvatarUrl = null,
  insets,
  onBack,
  onToggleLike,
  onOpenComments,
  onOpenMoment,
  onOpenAuthor,
  onShare,
  onMore,
  onRetry,
  locale = deviceLocale(),
}: JarPageViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  if (!data) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]} testID="jar-page">
        <View style={[styles.topBar, { top: insets.top + space.md }]}>
          <RoundIconButton icon="back" accessibilityLabel={t('jarPage.back')} onPress={onBack} testID="jar-back" />
        </View>
        {data === undefined && !failed ? (
          <ActivityIndicator color={colors.muted} testID="jar-loading" />
        ) : (
          <View style={styles.message}>
            <Text
              accessibilityRole="header"
              style={[textStyle('sectionTitle'), styles.centerText, { color: colors.ink }]}
            >
              {failed ? t('jarPage.failed') : t('jarPage.unavailableTitle')}
            </Text>
            {failed ? (
              <SecondaryButton label={t('jarPage.retry')} onPress={onRetry} testID="jar-retry" />
            ) : (
              <Text style={[textStyle('body'), styles.centerText, { color: colors.muted }]} testID="jar-unavailable">
                {t('jarPage.unavailableBody')}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  const page = buildJarPage(data);
  const { jar, author } = data;
  const title = jarTitle(data, t, locale);
  const subtitle = t('jarPage.subtitle', {
    date: formatJarDate(jar.local_date, locale),
    count: page.count,
    max: MAX_LAYERS,
  });
  const stampOf = (m: JarMoment) => ({ capturedAt: new Date(m.captured_at ?? m.added_at), tz: jar.tz });
  const coverId = page.cover?.id ?? null;
  // The same 2 by 4 grid as Today (D-97): two columns, Today's padding and gaps, 3:4 tiles.
  const tileWidth = (width - 2 * space.xl - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
  const barHeight = sizes.minTap + 2 * space.sm + space.lg;
  const avatar = (
    <Avatar name={author.display_name} uri={authorAvatarUrl} size="header" decorative testID="jar-avatar" />
  );
  const name = (
    <Text style={[textStyle('bodyMedium', '700'), styles.name]} numberOfLines={1}>
      {author.display_name}
    </Text>
  );

  return (
    <View style={styles.screen} testID="jar-page">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: barHeight + insets.bottom + space.lg,
        }}
      >
        <View style={styles.header} testID="jar-header">
          <View style={styles.headerRow}>
            <RoundIconButton icon="back" accessibilityLabel={t('jarPage.back')} onPress={onBack} testID="jar-back" />
            {onMore && !page.isOwner ? (
              <RoundIconButton icon="more" accessibilityLabel={t('report.more')} onPress={onMore} testID="jar-more" />
            ) : null}
          </View>
          <View style={styles.authorRow}>
            {onOpenAuthor ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={author.display_name}
                accessibilityHint={t('jarPage.openAuthorHint')}
                hitSlop={hitSlopFor(undefined, sizes.avatarHeader)}
                onPress={onOpenAuthor}
                style={styles.author}
                testID="jar-author"
              >
                {avatar}
                {name}
              </Pressable>
            ) : (
              <View style={styles.author}>
                {avatar}
                {name}
              </View>
            )}
            {page.isFull ? (
              <View style={styles.fullTag} testID="jar-full-tag">
                <JarGraphic count={MAX_LAYERS} size={sizes.countJar} decorative />
                <Text style={[textStyle('caption'), { color: colors.ink }]}>{t('jarPage.fullJar')}</Text>
              </View>
            ) : null}
          </View>
          <View>
            <Text accessibilityRole="header" style={[textStyle('sectionTitle'), { color: colors.ink }]}>
              {title}
            </Text>
            <Text style={[textStyle('label', '500'), { color: colors.muted }]} testID="jar-subtitle">
              {subtitle}
            </Text>
          </View>
        </View>

        <View accessibilityLabel={t('jarPage.grid')} style={styles.grid}>
          {page.moments.map((m) => (
            <JarTile
              key={m.id}
              moment={m}
              width={tileWidth}
              stamp={stampOf(m)}
              isCover={m.id === coverId}
              onPress={onOpenMoment ? () => onOpenMoment(m.id) : undefined}
              accessibilityHint={page.isOwner ? t('preview.openHint') : undefined}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bar, { bottom: insets.bottom + space.lg }]} testID="jar-bar">
        <LikeButton
          count={jar.like_count}
          liked={isLiked(data, { kind: 'jar' })}
          height={sizes.minTap}
          onPress={() => onToggleLike?.({ kind: 'jar' })}
          testID="jar-likes"
        />
        <CommentsButton
          count={jar.comment_count}
          height={sizes.minTap}
          onPress={() => onOpenComments?.()}
          testID="jar-comments"
        />
        <View style={styles.flex} />
        {/* Only the owner shares their jar (D-83). */}
        {page.isOwner ? (
          <BaseButton
            label={t('jarPage.share')}
            accessibilityHint={t('jarPage.shareHint')}
            icon="share"
            onPress={onShare}
            testID="jar-share"
            tone={{
              background: 'brand',
              text: 'surface',
              height: sizes.minTap,
              textVariant: 'bodyMedium',
              textWeight: '800',
              paddingHorizontal: space.lg + 2,
              stretch: false,
              icon: { size: 16, strokeWidth: 2.4 },
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  message: { gap: space.md, paddingHorizontal: space.xxl, alignItems: 'center' },
  centerText: { textAlign: 'center' },
  flex: { flex: 1 },
  topBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  header: { paddingHorizontal: space.xl, gap: space.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  name: { flexShrink: 1, color: colors.ink },
  fullTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: sizes.pillPaddingY,
    paddingLeft: space.xs + 1,
    paddingRight: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: space.xl,
    marginTop: space.lg,
  },
  bar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm + 2,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadow.floating,
  },
});
