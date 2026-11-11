import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MomentTile } from '@/components/MomentTile';
import { MomentCover } from '@/features/moment/MomentCover';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { formatShortDate, formatTime } from '@/lib/format';
import { currentSlot } from '@/lib/jars';
import { colors, sizes, space, type Slot } from '@/theme/tokens';

import type { Visibility } from '@/features/publish/publishJar';

import { JarCard } from './JarCard';
import { OfflineBanner } from './OfflineBanner';
import { PublishedNote } from './PublishedNote';
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
  onOpenMyDays: () => void;
  /** Retry on a failed tile, with the tile's queue item id. */
  onRetry?: (queueId: number) => void;
  /** Zone tag in the header ("Tokyo time") on a jar that started in a new zone (FR-JAR-05). */
  zoneTag?: string | null;
  /** The Time zone banner, shown under the header. */
  zoneBanner?: ReactNode;
  /** A checking or removed server moment: opens /moment/[id] (M2-21). */
  onOpenMoment?: (momentId: string) => void;
  /** A live moment, or a queued photo that is waiting or failed: opens Moment options (M2-23). */
  onOpenOptions?: (tile: GridTile) => void;
  /** Opens Publish review (M3-01); null or missing disables the jar card's Publish. */
  onPublish?: (() => void) | null;
  /** A published jar (M3-02, TodayPublished): the Published note above the card, its chip and likes. */
  published?: { visibility: Visibility; publishedAt: string; likeCount: number } | null;
  /** The Published chip: opens the jar's visibility menu. */
  onOpenVisibility?: () => void;
};

/** Tiles that open Moment options: the owner's live moments and queued photos not uploading right now. */
export function hasOptions(tile: Pick<GridTile, 'state' | 'momentId' | 'queueId'>): boolean {
  if (tile.queueId !== null) return tile.state === 'waiting' || tile.state === 'failed';
  return tile.state === 'filled' && tile.momentId !== null;
}

/** Today (design: Main; first day: EmptyToday). Presentational; app/(tabs)/today.tsx loads the data. */
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
  onRetry,
  zoneTag = null,
  zoneBanner = null,
  onOpenMoment,
  onOpenOptions,
  onPublish = null,
  published = null,
  onOpenVisibility,
}: TodayViewProps) {
  const { t } = useTranslation();
  const count = momentCount(tiles);
  const rows: GridTile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  // Content scrolls under the floating tab bar; this keeps the last row clear of it.
  const bottomPadding = Math.max(insets.bottom, space.lg) + sizes.tabBar + space.lg;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + sizes.headerTop, paddingBottom: bottomPadding },
      ]}
      testID="today-scroll"
    >
      <TodayHeader
        date={formatShortDate(now, tz)}
        greeting={greetingFor(currentSlot(now, tz))}
        displayName={displayName}
        avatarUrl={avatarUrl}
        onOpenMyDays={onOpenMyDays}
        zoneTag={zoneTag}
      />
      {zoneBanner ? <View style={styles.banner}>{zoneBanner}</View> : null}
      {offlineCount !== null ? (
        <View style={zoneBanner ? styles.cardUnderBanner : styles.banner}>
          <OfflineBanner count={offlineCount} />
        </View>
      ) : null}
      {published ? (
        <View style={offlineCount !== null || zoneBanner ? styles.cardUnderBanner : styles.banner}>
          <PublishedNote time={formatTime(new Date(published.publishedAt), tz)} visibility={published.visibility} />
        </View>
      ) : null}
      <View style={offlineCount !== null || zoneBanner || published ? styles.cardUnderBanner : styles.card}>
        <JarCard
          count={count}
          readerCount={readerCount}
          lidColor={lidColor}
          firstDay={hasAnyJar === false && count === 0}
          onPublish={onPublish}
          published={published}
          onOpenVisibility={onOpenVisibility}
        />
      </View>
      <View accessibilityLabel={t('today.grid')} style={styles.grid}>
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
                    isPrivate={tile.isPrivate}
                    addedLater={tile.addedLater}
                    // TODO(M3-08): Moment detail on filled tiles, with Moment options under its More button.
                    onPress={
                      capturable
                        ? () => onCapture(tile.slot)
                        : openable && momentId !== null && onOpenMoment
                          ? () => onOpenMoment(momentId)
                          : hasOptions(tile) && onOpenOptions
                            ? () => onOpenOptions(tile)
                            : undefined
                    }
                    accessibilityHint={hasOptions(tile) && onOpenOptions ? t('momentOptions.openHint') : undefined}
                    onRetry={tile.canRetry && queueId !== null && onRetry ? () => onRetry(queueId) : undefined}
                    testID={`tile-${tile.slot}`}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
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
});
