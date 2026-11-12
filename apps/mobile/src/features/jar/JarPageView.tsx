import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BaseButton } from '@/components/BaseButton';
import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { parseEdits } from '@/features/edit/edits';
import { MomentCover } from '@/features/moment/MomentCover';
import { deviceLocale, formatTime } from '@/lib/format';
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
  insets: EdgeInsets;
  onBack: () => void;
  /** Likes or unlikes the jar (FR-SOC-05). */
  onToggleLike?: (target: LikeTarget) => void;
  /** Opens the jar's Comments. */
  onOpenComments?: () => void;
  /** Opens Moment detail for a moment on the page. */
  onOpenMoment?: (momentId: string) => void;
  onShare: () => void;
  onRetry: () => void;
  locale?: string;
};

const GRID_COLUMNS = 3;
const GRID_GAP = space.sm;
const GRID_PADDING = space.lg;

function formatJarDate(localDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

/**
 * One person's jar for one day (Story; FR-SOC-03, FR-JAR-06): cover with author, date, count and Full jar
 * tag, the cover's caption, a 3-column grid of the other moments with "Added later" badges ending in the
 * count tile, and a floating bar with likes, comments and Share jar.
 */
export function JarPageView({
  data,
  failed = false,
  insets,
  onBack,
  onToggleLike,
  onOpenComments,
  onOpenMoment,
  onShare,
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
  const timeOf = (m: JarMoment) => formatTime(new Date(m.captured_at ?? m.added_at), jar.tz, locale);
  const stampOf = (m: JarMoment) => ({ capturedAt: new Date(m.captured_at ?? m.added_at), tz: jar.tz });
  const cover = page.cover;
  const coverCaption = cover?.caption?.trim() ? cover.caption.trim() : null;
  const tileWidth = (width - 2 * GRID_PADDING - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
  const barHeight = sizes.minTap + 2 * space.sm + space.lg;

  return (
    <View style={styles.screen} testID="jar-page">
      <ScrollView contentContainerStyle={{ paddingBottom: barHeight + insets.bottom + space.lg }}>
        <View style={[styles.cover, { height: sizes.jarCover + insets.top }]}>
          {cover ? (
            <MomentCover
              uri={cover.fullUrl ?? cover.thumbUrl}
              edits={parseEdits(cover.edits)}
              stamp={stampOf(cover)}
              accessible={false}
              testID="jar-cover-photo"
            />
          ) : null}
          <LinearGradient
            colors={[colors.coverFadeTop, colors.photoFadeClear, colors.coverFadeBottom]}
            locations={[0, 0.4, 1]}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          {cover ? (
            <Pressable
              accessibilityRole={onOpenMoment ? 'button' : 'image'}
              accessibilityLabel={t(cover.is_backfilled ? 'jarPage.coverAddedLater' : 'jarPage.cover', {
                slot: t(`slots.${cover.slot}`),
              })}
              accessibilityHint={onOpenMoment ? t('jarPage.openMomentHint') : undefined}
              disabled={!onOpenMoment}
              onPress={() => onOpenMoment?.(cover.id)}
              style={StyleSheet.absoluteFill}
              testID="jar-cover"
            />
          ) : null}
          <View style={styles.coverFooter}>
            <Avatar name={author.display_name} uri={null} size="header" ring decorative />
            <View style={styles.coverTitles}>
              <Text
                accessibilityRole="header"
                style={[textStyle('sectionTitle'), { color: colors.surface }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                style={[textStyle('label', '500'), { color: colors.coverSubtitle }]}
                numberOfLines={1}
                testID="jar-subtitle"
              >
                {subtitle}
              </Text>
            </View>
            {page.isFull ? (
              <View style={styles.fullTag} testID="jar-full-tag">
                <JarGraphic count={MAX_LAYERS} size={sizes.countJar} decorative />
                <Text style={[textStyle('caption'), { color: colors.ink }]}>{t('jarPage.fullJar')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {cover && coverCaption ? (
          <Text style={[textStyle('bodyMedium', '400'), styles.highlight]} testID="jar-highlight">
            {t(cover.is_backfilled ? 'jarPage.highlightAddedLater' : 'jarPage.highlight', {
              caption: coverCaption,
              slot: t(`slots.${cover.slot}`),
              time: timeOf(cover),
            })}
          </Text>
        ) : (
          <View style={styles.highlightSpacer} />
        )}

        <View style={styles.grid}>
          {page.grid.map((m) => (
            <JarTile
              key={m.id}
              moment={m}
              width={tileWidth}
              stamp={stampOf(m)}
              onPress={onOpenMoment ? () => onOpenMoment(m.id) : undefined}
            />
          ))}
          <View
            accessible
            accessibilityLabel={t('jarPage.countA11y', { count: page.count, max: MAX_LAYERS })}
            style={[styles.countTile, { width: tileWidth }]}
            testID="jar-count-tile"
          >
            <Text style={[textStyle('countTile'), { color: colors.surface }]}>
              {t('jarPage.count', { count: page.count, max: MAX_LAYERS })}
            </Text>
            <Text style={[textStyle('caption', '500'), { color: colors.onDarkMuted }]}>{t('jarPage.countLabel')}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + space.lg }]} pointerEvents="box-none">
        <RoundIconButton
          icon="back"
          variant="glass"
          accessibilityLabel={t('jarPage.back')}
          onPress={onBack}
          testID="jar-back"
        />
        {/* TODO(M3-21, #82): More options → Report on someone else's jar. */}
      </View>

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
  cover: { overflow: 'hidden', backgroundColor: colors.photoPlaceholder },
  topBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coverFooter: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
  },
  coverTitles: { flex: 1 },
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
  highlight: {
    marginTop: space.md + 2,
    marginBottom: space.sm + 2,
    marginHorizontal: space.xl,
    color: colors.inkSoft,
    lineHeight: 20,
  },
  highlightSpacer: { height: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingHorizontal: GRID_PADDING },
  countTile: {
    minHeight: sizes.jarTile,
    borderRadius: radius.jarTile,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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
