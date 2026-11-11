import { LinearGradient } from 'expo-linear-gradient';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BaseButton } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { PhotoTile } from '@/components/PhotoTile';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { parseEdits } from '@/features/edit/edits';
import { MomentCover } from '@/features/moment/MomentCover';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { deviceLocale, formatTime, formatWeekday } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { buildJarPage, type JarMoment, type JarPageData } from './jarPage';

export type JarPageViewProps = {
  /** Undefined while loading; null when the jar isn't available to this viewer. */
  data: JarPageData | null | undefined;
  /** The request failed and nothing is cached. */
  failed?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onShare: () => void;
  onRetry: () => void;
  locale?: string;
};

const GRID_COLUMNS = 3;
const GRID_GAP = space.sm;
const GRID_PADDING = space.lg;

/** "Dale" from "Dale Santos": the cover reads "Dale's Sunday" (design: Story). */
function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

function formatJarDate(localDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

/** The jar page title, also used by the share message. */
export function jarTitle(data: Pick<JarPageData, 'jar' | 'author'>, t: TFunction, locale = deviceLocale()): string {
  return t('jarPage.title', {
    name: firstName(data.author.display_name),
    weekday: formatWeekday(data.jar.local_date, locale),
  });
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
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('jarPage.cover', { slot: t(`slots.${cover.slot}`) })}
              style={StyleSheet.absoluteFill}
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
            {t('jarPage.highlight', { caption: coverCaption, slot: t(`slots.${cover.slot}`), time: timeOf(cover) })}
          </Text>
        ) : (
          <View style={styles.highlightSpacer} />
        )}

        <View style={styles.grid}>
          {page.grid.map((m) => {
            const edits = parseEdits(m.edits);
            const slot = t(`slots.${m.slot}`);
            const labelKey = m.is_private
              ? m.is_backfilled
                ? 'jarPage.tilePrivateAddedLater'
                : 'jarPage.tilePrivate'
              : m.is_backfilled
                ? 'jarPage.tileAddedLater'
                : 'jarPage.tile';
            // TODO(M3-08, #69): a tap opens Moment detail.
            return (
              <View
                key={m.id}
                accessible
                accessibilityRole="image"
                accessibilityLabel={t(labelKey, { slot })}
                style={{ width: tileWidth }}
                testID={`jar-tile-${m.slot}`}
              >
                <PhotoTile
                  uri={m.thumbUrl}
                  photoView={
                    m.thumbUrl !== null && hasVisibleEdits(edits) ? (
                      <MomentCover uri={m.thumbUrl} edits={edits} stamp={stampOf(m)} accessible={false} />
                    ) : undefined
                  }
                  height={sizes.jarTile}
                  radius={radius.jarTile}
                  fadeHeight={sizes.jarTileFade}
                  label={slot}
                  labelVariant="caption"
                  topRight={
                    m.is_backfilled || m.is_private ? (
                      <>
                        {m.is_backfilled ? (
                          <View style={styles.badge} testID={`jar-tile-${m.slot}-added-later`}>
                            <Text style={[textStyle('caption'), { color: colors.surface }]} numberOfLines={1}>
                              {t('tile.addedLater')}
                            </Text>
                          </View>
                        ) : null}
                        {m.is_private ? (
                          <View style={styles.lock} testID={`jar-tile-${m.slot}-lock`}>
                            <Icon name="lock" color="surface" size={12} strokeWidth={2} />
                          </View>
                        ) : null}
                      </>
                    ) : null
                  }
                />
              </View>
            );
          })}
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
        {/* TODO(M3-09, #70): the like pill toggles the viewer's like. TODO(M3-11, #72): comments open Comments. */}
        <View
          accessible
          accessibilityLabel={t('jarPage.likes', { count: jar.like_count })}
          style={[styles.stat, { backgroundColor: colors.dangerTint }]}
          testID="jar-likes"
        >
          <Icon name="heart" color="likeText" size={16} strokeWidth={2.2} />
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.likeText }]}>{jar.like_count}</Text>
        </View>
        <View
          accessible
          accessibilityLabel={t('jarPage.comments', { count: jar.comment_count })}
          style={[styles.stat, { backgroundColor: colors.subtle }]}
          testID="jar-comments"
        >
          <Icon name="comment" color="ink" size={16} strokeWidth={2} />
          <Text style={[textStyle('bodyMedium', '600'), { color: colors.ink }]}>{jar.comment_count}</Text>
        </View>
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
  badge: {
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY - 1,
    paddingHorizontal: space.xs + 2,
    backgroundColor: colors.badge,
    flexShrink: 1,
  },
  lock: {
    width: sizes.lockBadge,
    height: sizes.lockBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: sizes.minTap,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
  },
});
