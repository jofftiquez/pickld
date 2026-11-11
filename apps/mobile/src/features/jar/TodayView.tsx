import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { MomentTile } from '@/components/MomentTile';
import { formatShortDate, formatTime } from '@/lib/format';
import { currentSlot } from '@/lib/jars';
import { colors, sizes, space, type Slot } from '@/theme/tokens';

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
  onOpenMyDays: () => void;
  /** Retry on a failed tile, with the tile's queue item id. */
  onRetry?: (queueId: number) => void;
};

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
      />
      {offlineCount !== null ? (
        <View style={styles.banner}>
          <OfflineBanner count={offlineCount} />
        </View>
      ) : null}
      <View style={offlineCount !== null ? styles.cardUnderBanner : styles.card}>
        <JarCard
          count={count}
          readerCount={readerCount}
          lidColor={lidColor}
          firstDay={hasAnyJar === false && count === 0}
        />
      </View>
      <View accessibilityLabel={t('today.grid')} style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0]?.slot} style={styles.gridRow}>
            {row.map((tile) => {
              const capturable = tile.state === 'empty' || tile.state === 'now';
              const { queueId } = tile;
              return (
                <View key={tile.slot} style={styles.cell}>
                  <MomentTile
                    slot={tile.slot}
                    state={tile.state}
                    uri={tile.uri}
                    time={tile.time ? formatTime(new Date(tile.time), tz) : undefined}
                    isPrivate={tile.isPrivate}
                    addedLater={tile.addedLater}
                    // TODO(M3-08): Moment detail on filled tiles.
                    onPress={capturable ? () => onCapture(tile.slot) : undefined}
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
