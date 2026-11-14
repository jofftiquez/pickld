import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BackToTopButton } from '@/components/BackToTopButton';
import { EmptyState } from '@/components/EmptyState';
import { RoundIconButton } from '@/components/RoundIconButton';
import { FeedScrubber } from '@/features/scrubber/FeedScrubber';
import { dayOf, type TimelineScrubber } from '@/features/scrubber/scrubberModel';
import { useScrubberVisibility } from '@/features/scrubber/useScrubberVisibility';
import { useTopRowDay } from '@/features/scrubber/useTopRowDay';
import { FeedEmpty } from '@/features/feed/FeedEmpty';
import type { FeedAuthor } from '@/features/feed/feedModel';
import type { AvatarUrls } from '@/lib/avatars';
import { usePhotoPrefetch } from '@/lib/image/usePhotoPrefetch';
import { maxTextScale, textStyle } from '@/theme/text';
import { useTabBarClearance } from '@/lib/tabBarClearance';
import { useBackToTop, type BackToTopMode } from '@/lib/useBackToTop';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { MomentFeedCard } from './MomentFeedCard';
import { cardPhotoUrl, type FeedMoment } from './momentsModel';

export type MomentsFeedViewProps = {
  moments: FeedMoment[] | undefined;
  /** The authors the user reads (`feed_authors`): none means the Find people card (D-53). */
  authors: FeedAuthor[] | undefined;
  viewerId: string | null;
  /** Signed avatars by author id; initials for anyone missing. */
  avatars?: AvatarUrls;
  insets: { top: number; bottom: number };
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  /** Unread notifications: shows the dot on the bell. */
  hasUnread: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  /** The date scrubber on the right edge (FR-SOC-01); none without it. */
  scrubber?: TimelineScrubber;
  /** The list reached its top: a timeline the scrubber jumped into loads the rows above. */
  onStartReached?: () => void;
  isFetchingPreviousPage?: boolean;
  /** After the back-to-top button brings the list up: on `reload` the screen fetches the newest page again. */
  onBackToTop: (mode: BackToTopMode) => void;
  onOpenNotifications: () => void;
  /** Go to jar on a card (D-94). */
  onOpenJar: (moment: FeedMoment) => void;
  onToggleLike: (moment: FeedMoment) => void;
  onOpenComments: (moment: FeedMoment) => void;
  onFindPeople: () => void;
  onInvite: () => void;
};

/**
 * The Moments tab (design: MomentsFeed; FR-SOC-01): title and bell, then live moments the user may see from
 * the people they read and their own, newest first (D-53). Reading nobody, the user's own moments sit under a
 * Find people card, and the empty view shows only when there is nothing at all (FR-SOC-02), as on Jars.
 */
export function MomentsFeedView({
  moments,
  authors,
  viewerId,
  avatars = {},
  insets,
  isLoading,
  isRefreshing,
  isFetchingNextPage,
  hasUnread,
  onRefresh,
  onEndReached,
  scrubber,
  onStartReached,
  isFetchingPreviousPage = false,
  onBackToTop,
  onOpenNotifications,
  onOpenJar,
  onToggleLike,
  onOpenComments,
  onFindPeople,
  onInvite,
}: MomentsFeedViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // The card sits inside the screen padding and its own padding; the photo fills the rest.
  const photoWidth = Math.max(0, width - 2 * space.xl - 2 * space.md);
  const tabBarClearance = useTabBarClearance();
  const bottomPadding = Math.max(insets.bottom, space.lg) + tabBarClearance;
  const readsNobody = authors !== undefined && authors.length === 0;
  const hasMoments = moments !== undefined && moments.length > 0;

  const prefetch = usePhotoPrefetch(moments, cardPhotoUrl);
  const { listRef, onScroll, scrollEventThrottle, showBackToTop, backToTop } = useBackToTop<FeedMoment>(onBackToTop);
  const anchored = scrubber !== undefined && scrubber.anchorDay !== null;
  const rail = useScrubberVisibility(anchored);
  const timeZone = scrubber?.timeZone ?? 'UTC';
  const topRow = useTopRowDay(useCallback((row: FeedMoment) => dayOf(row.added_at, timeZone), [timeZone]));
  const { poke } = rail;
  const onListScroll: typeof onScroll = useCallback(
    (e) => {
      onScroll(e);
      poke();
    },
    [onScroll, poke],
  );
  // Both stable: FlatList refuses a new onViewableItemsChanged after mount.
  const { onViewable } = topRow;
  const onViewableItemsChanged: typeof prefetch = useCallback(
    (info) => {
      prefetch(info);
      onViewable(info);
    },
    [prefetch, onViewable],
  );

  const header = (
    <View>
      {isFetchingPreviousPage ? <ActivityIndicator color={colors.muted} style={styles.newer} /> : null}
      <View style={styles.titleRow}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          testID="screen-title"
          accessibilityRole="header"
          style={[textStyle('screenTitle'), { color: colors.ink }]}
        >
          {t('moments.title')}
        </Text>
        <View style={styles.headerButtons}>
          <View>
            <RoundIconButton
              icon="bell"
              accessibilityLabel={hasUnread ? t('feed.notificationsUnread') : t('feed.notifications')}
              onPress={onOpenNotifications}
              testID="moments-notifications"
            />
            {hasUnread ? <View style={styles.dot} pointerEvents="none" testID="moments-notifications-dot" /> : null}
          </View>
        </View>
      </View>
      {readsNobody && hasMoments ? (
        <View style={[styles.cardWrap, styles.findPeople]}>
          <FeedEmpty onFindPeople={onFindPeople} onInvite={onInvite} aboveOwnJars timeline="moments" />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        style={styles.screen}
        ref={listRef}
        onScroll={onListScroll}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomPadding }}
        data={moments ?? []}
        keyExtractor={(m) => m.moment_id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <MomentFeedCard
              moment={item}
              photoWidth={photoWidth}
              viewerId={viewerId}
              avatarUrl={avatars[item.author_id] ?? null}
              onOpenJar={() => onOpenJar(item)}
              onToggleLike={() => onToggleLike(item)}
              onOpenComments={() => onOpenComments(item)}
            />
          </View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          readsNobody && !isLoading ? (
            <View style={styles.cardWrap}>
              <FeedEmpty onFindPeople={onFindPeople} onInvite={onInvite} timeline="moments" refreshable />
            </View>
          ) : isLoading ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} testID="moments-loading" />
          ) : authors !== undefined ? (
            // Reading people who haven't added anything yet (D-87).
            <EmptyState
              illustration="moments"
              title={t('moments.quietTitle')}
              body={t('moments.quietBody')}
              action={{ label: t('feed.findMore'), onPress: onFindPeople, testID: 'moments-find-more' }}
              refreshable
              testID="moments-empty"
            />
          ) : undefined
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={colors.muted} style={styles.loading} /> : undefined
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        onStartReached={onStartReached}
        onStartReachedThreshold={0.6}
        // Rows loaded above a jumped-to day keep that day where it is on screen.
        maintainVisibleContentPosition={anchored ? { minIndexForVisible: 0 } : undefined}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.muted}
            progressViewOffset={insets.top}
          />
        }
        // Each card holds a full-width photo; a small window keeps scrolling smooth (NFR-PERF-02).
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
        accessibilityLabel={t('moments.list')}
        testID="moments-list"
      />
      {showBackToTop ? <BackToTopButton onPress={backToTop} bottom={bottomPadding} /> : null}
      {scrubber ? (
        <FeedScrubber
          days={scrubber.days}
          currentDay={topRow.day ?? scrubber.anchorDay}
          visible={rail.visible}
          top={insets.top + sizes.headerTop + sizes.roundButton + space.md}
          bottom={bottomPadding}
          onDragChange={rail.onDragChange}
          onJump={scrubber.onJump}
          testID="moments-scrubber"
        />
      ) : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: sizes.headerTop,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: sizes.notifyDot + 4,
    height: sizes.notifyDot + 4,
    borderRadius: radius.pill,
    backgroundColor: colors.notifyDot,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  cardWrap: { paddingHorizontal: space.xl },
  separator: { height: space.md },
  findPeople: { paddingBottom: space.md },
  loading: { marginTop: space.xxl },
  newer: { paddingTop: space.md },
});
