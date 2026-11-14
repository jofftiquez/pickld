import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackToTopButton } from '@/components/BackToTopButton';
import { EmptyState } from '@/components/EmptyState';
import { RoundIconButton } from '@/components/RoundIconButton';
import { FeedScrubber } from '@/features/scrubber/FeedScrubber';
import { dayOf, type TimelineScrubber } from '@/features/scrubber/scrubberModel';
import { useScrubberVisibility } from '@/features/scrubber/useScrubberVisibility';
import { useTopRowDay } from '@/features/scrubber/useTopRowDay';
import { maxTextScale, textStyle } from '@/theme/text';
import type { AvatarUrls } from '@/lib/avatars';
import { useTabBarClearance } from '@/lib/tabBarClearance';
import { useBackToTop, type BackToTopMode } from '@/lib/useBackToTop';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { FeedEmpty } from './FeedEmpty';
import { FeedJarCard } from './FeedJarCard';
import type { FeedAuthor, FeedJar } from './feedModel';
import { StoryAvatar } from './StoryAvatar';

export type FeedViewProps = {
  jars: FeedJar[] | undefined;
  authors: FeedAuthor[] | undefined;
  /** The signed-in user's display name, for the "You" avatar. */
  myName: string | null;
  /** The signed-in user's signed avatar. */
  myAvatarUrl?: string | null;
  /** Signed avatars by profile id (authors and card authors); initials for anyone missing. */
  avatars?: AvatarUrls;
  now: Date;
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
  onOpenJar?: (jarId: string) => void;
  /** Opens a profile from the avatar row; `null` is the viewer's own ("You"). */
  onOpenProfile?: (username: string | null) => void;
  onFindPeople: () => void;
  onInvite: () => void;
};

/** First name for an avatar label ("Mika Reyes" → "Mika"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The Jars tab (design: Feed): title and bell, followed authors' avatars, then published jars: theirs and
 * the user's own (D-53). Reading nobody, the user's own jars sit under a Find people card, and Jars, empty
 * shows only when there is nothing at all.
 */
export function FeedView({
  jars,
  authors,
  myName,
  myAvatarUrl = null,
  avatars = {},
  now,
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
  onOpenProfile,
  onFindPeople,
  onInvite,
}: FeedViewProps) {
  const { t } = useTranslation();
  // Content scrolls under the floating tab bar; this keeps the last card clear of it.
  const tabBarClearance = useTabBarClearance();
  const bottomPadding = Math.max(insets.bottom, space.lg) + tabBarClearance;
  // Jars, empty: only once we know the user reads nobody (FR-SOC-02), never while the authors load.
  const readsNobody = authors !== undefined && authors.length === 0;
  const hasJars = jars !== undefined && jars.length > 0;
  const { listRef, onScroll, scrollEventThrottle, showBackToTop, backToTop } = useBackToTop<FeedJar>(onBackToTop);
  const anchored = scrubber !== undefined && scrubber.anchorDay !== null;
  const rail = useScrubberVisibility(anchored);
  const timeZone = scrubber?.timeZone ?? 'UTC';
  const topRow = useTopRowDay(useCallback((row: FeedJar) => dayOf(row.feed_at, timeZone), [timeZone]));
  const { poke } = rail;
  const onListScroll: typeof onScroll = useCallback(
    (e) => {
      onScroll(e);
      poke();
    },
    [onScroll, poke],
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
          {t('jars.title')}
        </Text>
        <View style={styles.headerButtons}>
          <View>
            <RoundIconButton
              icon="bell"
              accessibilityLabel={hasUnread ? t('feed.notificationsUnread') : t('feed.notifications')}
              onPress={onOpenNotifications}
              testID="feed-notifications"
            />
            {hasUnread ? <View style={styles.dot} pointerEvents="none" testID="feed-notifications-dot" /> : null}
          </View>
        </View>
      </View>
      {readsNobody && hasJars ? (
        <View style={[styles.cardWrap, styles.findPeople]}>
          <FeedEmpty onFindPeople={onFindPeople} onInvite={onInvite} aboveOwnJars />
        </View>
      ) : null}
      {readsNobody ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stories}
          accessibilityLabel={t('feed.authors')}
          testID="feed-authors"
        >
          {myName ? (
            <StoryAvatar
              name={myName}
              label={t('feed.you')}
              uri={myAvatarUrl}
              isNew={false}
              accessibilityLabel={t('feed.you')}
              onPress={onOpenProfile ? () => onOpenProfile(null) : undefined}
              testID="feed-author-me"
            />
          ) : null}
          {authors?.map((a) => (
            <StoryAvatar
              key={a.author_id}
              name={a.display_name}
              label={firstName(a.display_name)}
              uri={avatars[a.author_id] ?? null}
              isNew={a.has_new}
              accessibilityLabel={a.has_new ? t('feed.authorNew', { name: a.display_name }) : a.display_name}
              onPress={onOpenProfile ? () => onOpenProfile(a.username) : undefined}
              testID={`feed-author-${a.username}`}
            />
          ))}
        </ScrollView>
      )}
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
        data={jars ?? []}
        keyExtractor={(jar) => jar.jar_id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <FeedJarCard
              jar={item}
              now={now}
              avatarUrl={avatars[item.author_id] ?? null}
              onPress={onOpenJar ? () => onOpenJar(item.jar_id) : undefined}
            />
          </View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          readsNobody && !isLoading ? (
            <View style={styles.cardWrap}>
              <FeedEmpty onFindPeople={onFindPeople} onInvite={onInvite} refreshable />
            </View>
          ) : isLoading ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} testID="feed-loading" />
          ) : authors !== undefined ? (
            // Reading people who haven't published a jar yet (D-87).
            <EmptyState
              illustration="jar"
              title={t('feed.quietTitle')}
              body={t('feed.quietBody')}
              action={{ label: t('feed.findMore'), onPress: onFindPeople, testID: 'feed-find-more' }}
              refreshable
              testID="feed-quiet"
            />
          ) : undefined
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={colors.muted} style={styles.loading} /> : undefined
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        onViewableItemsChanged={topRow.onViewable}
        onStartReached={onStartReached}
        onStartReachedThreshold={0.6}
        // Rows loaded above a jumped-to day keep that day where it is on screen.
        maintainVisibleContentPosition={anchored ? { minIndexForVisible: 0 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.muted}
            progressViewOffset={insets.top}
          />
        }
        // Cards are tall; a small window keeps scrolling smooth on older phones (NFR-PERF-02).
        initialNumToRender={4}
        windowSize={7}
        removeClippedSubviews
        testID="feed-list"
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
          testID="feed-scrubber"
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
  stories: { gap: space.md + 2, paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.md + 2 },
  cardWrap: { paddingHorizontal: space.xl },
  separator: { height: space.md },
  findPeople: { paddingBottom: space.md },
  loading: { marginTop: space.xxl },
  newer: { paddingTop: space.md },
});
