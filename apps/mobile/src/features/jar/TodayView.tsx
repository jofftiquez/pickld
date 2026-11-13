import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MomentTile } from '@/components/MomentTile';
import { MomentCover } from '@/features/moment/MomentCover';
import { opensPreview } from '@/features/moment/momentPreview';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { formatShortDate, formatTime } from '@/lib/format';
import { currentSlot } from '@/lib/jars';
import { textStyle } from '@/theme/text';
import { colors, sizes, space, type Slot } from '@/theme/tokens';

import type { Visibility } from '@/features/publish/publishJar';

import { DayHeader } from './DayHeader';
import { JarCard } from './JarCard';
import { OfflineBanner } from './OfflineBanner';
import { TodayHeader } from './TodayHeader';
import { greetingFor, momentCount, type GridTile } from './todayGrid';

export type TodayViewProps = {
  now: Date;
  /** The phone's IANA zone: date, greeting and capture times are shown in it. */
  tz: string;
  tiles: readonly GridTile[];
  /** The user has no jar yet (null while unknown). */
  hasAnyJar: boolean | null;
  displayName: string | null;
  avatarUrl: string | null;
  readerCount: number | null;
  lidColor?: string;
  /** Safe-area insets; the bottom one is where the floating tab bar sits. */
  insets: { top: number; bottom: number };
  /** Offline banner count from `offlineBannerCount`; null hides the banner. */
  offlineCount?: number | null;
  onCapture: (slot: Slot) => void;
  /** Today's calendar button; left out on the day page. */
  onOpenMyDays?: () => void;
  /** Opens the Stickers page from the header's stickers button (D-61); left out on the day page. */
  onOpenStickers?: () => void;
  /** Opens My profile from the header avatar. */
  onOpenProfile?: () => void;
  /** Retry on a failed tile, with the tile's queue item id. */
  onRetry?: (queueId: number) => void;
  /** Zone tag in the header ("Tokyo time") on a jar that started in a new zone (FR-JAR-05). */
  zoneTag?: string | null;
  /** The Time zone banner, shown under the header. */
  zoneBanner?: ReactNode;
  /** The suspension notice (FR-SAF-06), shown first under the header. */
  suspension?: ReactNode;
  /** A checking or removed server moment: opens /moment/[id] (M2-21). */
  onOpenMoment?: (momentId: string) => void;
  /** A live moment, or a queued photo that is waiting or failed: opens the moment preview (QA item 3, D-54). */
  onOpenPreview?: (tile: GridTile) => void;
  /** Opens Publish review (M3-01); null or missing disables the jar card's Publish. */
  onPublish?: (() => void) | null;
  /** A published jar (M3-02, TodayPublished): the card's Published chip, likes and "Published 10:10 PM · Readers". */
  published?: { visibility: Visibility; publishedAt: string; likeCount: number } | null;
  /** The Published chip and line: open the jar's visibility menu. */
  onOpenVisibility?: () => void;
  /**
   * A past day instead of today: the day page (D-55, FR-DAY-02; app/day/[date].tsx). The header shows that
   * date and Back instead of the greeting, nothing is the Now tile, and the page sits above the tab bar.
   */
  day?: { date: string; onBack: () => void } | null;
};

/** Today (design: Main; first day: EmptyToday), or a past day's page (Day). Presentational; app/(tabs)/today.tsx
 * and app/day/[date].tsx load the data. */
export function TodayView({
  now,
  tz,
  tiles,
  hasAnyJar,
  displayName,
  avatarUrl,
  readerCount,
  lidColor,
  insets,
  offlineCount = null,
  onCapture,
  onOpenMyDays,
  onOpenStickers,
  onOpenProfile,
  onRetry,
  zoneTag = null,
  zoneBanner = null,
  suspension = null,
  onOpenMoment,
  onOpenPreview,
  onPublish = null,
  published = null,
  onOpenVisibility,
  day = null,
}: TodayViewProps) {
  const { t } = useTranslation();
  const count = momentCount(tiles);
  const rows: GridTile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  // Content scrolls under the floating tab bar; this keeps the last row clear of it. The day page is a stack
  // screen without the tab bar.
  const bottomPadding = Math.max(insets.bottom, space.lg) + (day ? 0 : sizes.tabBar + space.lg);
  const missing = tiles.some((tile) => tile.state === 'empty');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + sizes.headerTop, paddingBottom: bottomPadding },
      ]}
      testID={day ? 'day-scroll' : 'today-scroll'}
    >
      {day ? (
        <DayHeader date={day.date} onBack={day.onBack} />
      ) : (
        <TodayHeader
          date={formatShortDate(now, tz)}
          greeting={greetingFor(currentSlot(now, tz))}
          displayName={displayName}
          avatarUrl={avatarUrl}
          onOpenMyDays={onOpenMyDays}
          onOpenStickers={onOpenStickers}
          onOpenProfile={onOpenProfile}
          zoneTag={zoneTag}
        />
      )}
      {suspension ? <View style={styles.banner}>{suspension}</View> : null}
      {zoneBanner ? <View style={suspension ? styles.cardUnderBanner : styles.banner}>{zoneBanner}</View> : null}
      {offlineCount !== null ? (
        <View style={suspension || zoneBanner ? styles.cardUnderBanner : styles.banner}>
          <OfflineBanner count={offlineCount} />
        </View>
      ) : null}
      <View style={suspension || offlineCount !== null || zoneBanner ? styles.cardUnderBanner : styles.card}>
        <JarCard
          count={count}
          readerCount={readerCount}
          lidColor={lidColor}
          firstDay={!day && hasAnyJar === false && count === 0}
          pastDay={day !== null}
          onPublish={onPublish}
          published={
            published
              ? {
                  visibility: published.visibility,
                  likeCount: published.likeCount,
                  time: formatTime(new Date(published.publishedAt), tz),
                }
              : null
          }
          onOpenVisibility={onOpenVisibility}
        />
      </View>
      <View accessibilityLabel={day ? t('day.grid') : t('today.grid')} style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0]?.slot} style={styles.gridRow}>
            {row.map((tile) => {
              const capturable = tile.state === 'empty' || tile.state === 'now';
              const { queueId, momentId } = tile;
              const openable = tile.state === 'checking' || tile.state === 'removed';
              return (
                <View key={tile.slot} style={styles.cell}>
                  <MomentTile
                    slot={tile.slot}
                    state={tile.state}
                    uri={tile.uri}
                    photoView={
                      tile.uri !== null && hasVisibleEdits(tile.edits) ? (
                        <MomentCover
                          uri={tile.uri}
                          edits={tile.edits}
                          stamp={tile.stamp}
                          accessible={false}
                          testID={`tile-${tile.slot}-moment`}
                        />
                      ) : undefined
                    }
                    time={tile.time ? formatTime(new Date(tile.time), tz) : undefined}
                    visibility={tile.visibility}
                    addedLater={tile.addedLater}
                    onPress={
                      capturable
                        ? () => onCapture(tile.slot)
                        : openable && momentId !== null && onOpenMoment
                          ? () => onOpenMoment(momentId)
                          : opensPreview(tile) && onOpenPreview
                            ? () => onOpenPreview(tile)
                            : undefined
                    }
                    accessibilityHint={opensPreview(tile) && onOpenPreview ? t('preview.openHint') : undefined}
                    onRetry={tile.canRetry && queueId !== null && onRetry ? () => onRetry(queueId) : undefined}
                    testID={`tile-${tile.slot}`}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {day && missing ? (
        <Text style={[textStyle('bodySmall'), styles.note]} testID="day-added-later-note">
          {t('day.addedLaterNote')}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl },
  card: { marginTop: sizes.cardPadding },
  banner: { marginTop: sizes.cardPadding },
  cardUnderBanner: { marginTop: sizes.bannerGap },
  grid: { marginTop: space.lg, gap: space.md },
  gridRow: { flexDirection: 'row', gap: space.md },
  cell: { flex: 1 },
  note: { marginTop: space.lg, color: colors.muted },
});
