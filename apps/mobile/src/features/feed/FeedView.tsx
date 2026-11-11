import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundIconButton } from '@/components/RoundIconButton';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { FeedJarCard } from './FeedJarCard';
import type { FeedAuthor, FeedJar } from './feedModel';
import { StoryAvatar } from './StoryAvatar';

export type FeedViewProps = {
  jars: FeedJar[] | undefined;
  authors: FeedAuthor[] | undefined;
  /** The signed-in user's display name, for the "You" avatar. */
  myName: string | null;
  now: Date;
  insets: { top: number; bottom: number };
  isLoading: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  /** Unread notifications: shows the dot on the bell. */
  hasUnread: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  onOpenNotifications: () => void;
  onOpenJar?: (jarId: string) => void;
};

/** First name for an avatar label ("Mika Reyes" → "Mika"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The Jars tab (design: Feed): title and bell, followed authors' avatars, then their published jars. */
export function FeedView({
  jars,
  authors,
  myName,
  now,
  insets,
  isLoading,
  isRefreshing,
  isFetchingNextPage,
  hasUnread,
  onRefresh,
  onEndReached,
  onOpenNotifications,
  onOpenJar,
}: FeedViewProps) {
  const { t } = useTranslation();
  // Content scrolls under the floating tab bar; this keeps the last card clear of it.
  const bottomPadding = Math.max(insets.bottom, space.lg) + sizes.tabBar + space.lg;

  const header = (
    <View>
      <View style={styles.titleRow}>
        <Text
          testID="screen-title"
          accessibilityRole="header"
          style={[textStyle('screenTitle'), { color: colors.ink }]}
        >
          {t('jars.title')}
        </Text>
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
            uri={null}
            isNew={false}
            accessibilityLabel={t('feed.you')}
            testID="feed-author-me"
          />
        ) : null}
        {authors?.map((a) => (
          <StoryAvatar
            key={a.author_id}
            name={a.display_name}
            label={firstName(a.display_name)}
            uri={null}
            isNew={a.has_new}
            accessibilityLabel={a.has_new ? t('feed.authorNew', { name: a.display_name }) : a.display_name}
            testID={`feed-author-${a.username}`}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomPadding }}
      data={jars ?? []}
      keyExtractor={(jar) => jar.jar_id}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <FeedJarCard jar={item} now={now} onPress={onOpenJar ? () => onOpenJar(item.jar_id) : undefined} />
        </View>
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isLoading ? <ActivityIndicator color={colors.muted} style={styles.loading} testID="feed-loading" /> : undefined
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
      // Cards are tall; a small window keeps scrolling smooth on older phones (NFR-PERF-02).
      initialNumToRender={4}
      windowSize={7}
      removeClippedSubviews
      testID="feed-list"
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
  stories: { gap: space.md + 2, paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.md + 2 },
  cardWrap: { paddingHorizontal: space.xl },
  separator: { height: space.md },
  loading: { marginTop: space.xxl },
});
