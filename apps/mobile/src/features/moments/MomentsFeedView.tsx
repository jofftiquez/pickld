import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { RoundIconButton } from '@/components/RoundIconButton';
import { FeedEmpty } from '@/features/feed/FeedEmpty';
import type { FeedAuthor } from '@/features/feed/feedModel';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { MomentFeedCard } from './MomentFeedCard';
import type { FeedMoment } from './momentsModel';

export type MomentsFeedViewProps = {
  moments: FeedMoment[] | undefined;
  /** The authors the user reads (`feed_authors`): none means the Find people card (D-53). */
  authors: FeedAuthor[] | undefined;
  viewerId: string | null;
  insets: { top: number; bottom: number };
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  /** Unread notifications: shows the dot on the bell. */
  hasUnread: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  onOpenNotifications: () => void;
  onOpenMoment: (moment: FeedMoment) => void;
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
  insets,
  isLoading,
  isRefreshing,
  isFetchingNextPage,
  hasUnread,
  onRefresh,
  onEndReached,
  onOpenNotifications,
  onOpenMoment,
  onToggleLike,
  onOpenComments,
  onFindPeople,
  onInvite,
}: MomentsFeedViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // The card sits inside the screen padding and its own padding; the photo fills the rest.
  const photoWidth = Math.max(0, width - 2 * space.xl - 2 * space.md);
  const bottomPadding = Math.max(insets.bottom, space.lg) + sizes.tabBar + space.lg;
  const readsNobody = authors !== undefined && authors.length === 0;
  const hasMoments = moments !== undefined && moments.length > 0;

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          testID="screen-title"
          accessibilityRole="header"
          style={[textStyle('screenTitle'), { color: colors.ink }]}
        >
          {t('moments.title')}
        </Text>
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
      {readsNobody && hasMoments ? (
        <View style={[styles.cardWrap, styles.findPeople]}>
          <FeedEmpty onFindPeople={onFindPeople} onInvite={onInvite} aboveOwnJars timeline="moments" />
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomPadding }}
      data={moments ?? []}
      keyExtractor={(m) => m.moment_id}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <MomentFeedCard
            moment={item}
            photoWidth={photoWidth}
            viewerId={viewerId}
            onOpen={() => onOpenMoment(item)}
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
});
