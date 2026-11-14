import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { FeedJarCard } from '@/features/feed/FeedJarCard';
import type { FeedJar } from '@/features/feed/feedModel';
import { MomentFeedCard } from '@/features/moments/MomentFeedCard';
import type { FeedMoment } from '@/features/moments/momentsModel';
import { FollowButton } from '@/features/profile/FollowButton';
import type { AvatarUrls } from '@/lib/avatars';
import { useTabBarClearance } from '@/lib/tabBarClearance';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, explore as e, radius, sizes, space } from '@/theme/tokens';

import type { Explore, Person, Suggestion } from './explore';
import type { DiscoverTab } from './useDiscover';

export type DiscoverViewProps = {
  /** Suggested authors; undefined while loading. */
  data: Explore | undefined;
  failed?: boolean;
  insets: EdgeInsets;
  query: string;
  onQueryChange: (query: string) => void;
  /** Search results for the typed text; undefined while there's nothing to search or it's loading. */
  results: Person[] | undefined;
  searching: boolean;
  searchFailed?: boolean;
  busy?: boolean;
  tab: DiscoverTab;
  onTabChange: (tab: DiscoverTab) => void;
  /** The Moments list (D-102); undefined until loaded. */
  moments: FeedMoment[] | undefined;
  /** The Jars list (D-102); undefined until loaded. */
  jars: FeedJar[] | undefined;
  /** The shown list's first page is loading, or failed with nothing to show. */
  listLoading: boolean;
  listFailed: boolean;
  isRefreshing: boolean;
  isFetchingNextPage: boolean;
  viewerId: string | null;
  /** Signed avatars by author id; initials for anyone missing. */
  avatars?: AvatarUrls;
  now: Date;
  onRefresh: () => void;
  onEndReached: () => void;
  /** Loads Suggested authors again. */
  onRetry: () => void;
  /** Loads the shown list again. */
  onRetryList: () => void;
  onOpenProfile: (username: string) => void;
  onSetReading: (person: Person, reading: boolean) => void;
  /** Be a reader on a card. */
  onReadAuthor: (authorId: string) => void;
  /** A moment card opens its thread (D-94). */
  onOpenMoment: (moment: FeedMoment) => void;
  onToggleLike: (moment: FeedMoment) => void;
  onOpenJar: (jarId: string) => void;
};

type Item = { kind: 'moment'; moment: FeedMoment } | { kind: 'jar'; jar: FeedJar };

/**
 * Discover (D-100, FR-EXP-01 to FR-EXP-03): search people by name or @username and Suggested authors, then a
 * Moments | Jars switch listing Everyone moments and jars of people the viewer doesn't read yet, newest first,
 * with infinite scroll and pull to refresh (D-102). While there's text to search, the results replace the rest.
 */
export function DiscoverView({
  data,
  failed = false,
  insets,
  query,
  onQueryChange,
  results,
  searching,
  searchFailed = false,
  busy = false,
  tab,
  onTabChange,
  moments,
  jars,
  listLoading,
  listFailed,
  isRefreshing,
  isFetchingNextPage,
  viewerId,
  avatars = {},
  now,
  onRefresh,
  onEndReached,
  onRetry,
  onRetryList,
  onOpenProfile,
  onSetReading,
  onReadAuthor,
  onOpenMoment,
  onToggleLike,
  onOpenJar,
}: DiscoverViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // Discover is a tab (D-130): the list clears the tab bar like Today, Moments and Jars.
  const tabBarClearance = useTabBarClearance();
  // The moment card sits inside the screen padding and its own padding; the photo fills the rest.
  const photoWidth = Math.max(0, width - 2 * space.xl - 2 * space.md);
  const showingSearch = searching || results !== undefined || searchFailed;
  const items: Item[] = showingSearch
    ? []
    : tab === 'moments'
      ? (moments ?? []).map((moment) => ({ kind: 'moment', moment }))
      : (jars ?? []).map((jar) => ({ kind: 'jar', jar }));

  const header = (
    <View>
      <View style={styles.header}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('screenTitle'), styles.title]}
        >
          {t('explore.title')}
        </Text>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={20} strokeWidth={2} color="muted" />
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('explore.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          accessibilityLabel={t('explore.searchLabel')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[textStyle('body'), styles.searchInput]}
          testID="explore-search"
        />
      </View>

      {showingSearch ? (
        <SearchResults
          results={results}
          failed={searchFailed}
          busy={busy}
          onOpenProfile={onOpenProfile}
          onSetReading={onSetReading}
        />
      ) : (
        <>
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.section]}>
            {t('explore.suggested')}
          </Text>
          {data === undefined ? (
            <View style={styles.message}>
              {failed ? (
                <>
                  <Text style={[textStyle('body'), styles.center]}>{t('explore.failed')}</Text>
                  <SecondaryButton label={t('explore.retry')} onPress={onRetry} testID="explore-retry" />
                </>
              ) : (
                <ActivityIndicator color={colors.muted} accessibilityLabel={t('explore.loading')} />
              )}
            </View>
          ) : data.suggestions.length === 0 ? (
            <EmptyState
              compact
              illustration="readers"
              title={t('explore.suggestedEmptyTitle')}
              body={t('explore.suggestedEmpty')}
              testID="explore-suggested-empty"
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cards}
              testID="explore-suggested"
            >
              {data.suggestions.map((s) => (
                <AuthorCard
                  key={s.id}
                  person={s}
                  busy={busy}
                  onOpen={() => onOpenProfile(s.username)}
                  onRead={() => onSetReading(s, true)}
                />
              ))}
            </ScrollView>
          )}
          <View style={styles.tabs}>
            <SegmentedControl
              segments={[
                { key: 'moments', label: t('explore.tabMoments') },
                { key: 'jars', label: t('explore.tabJars') },
              ]}
              selected={tab}
              onSelect={onTabChange}
              accessibilityLabel={t('explore.tabs')}
              testID="discover-tabs"
            />
          </View>
        </>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: Math.max(insets.bottom, space.lg) + tabBarClearance,
      }}
      data={items}
      keyExtractor={(item) => (item.kind === 'moment' ? `m:${item.moment.moment_id}` : `j:${item.jar.jar_id}`)}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          {item.kind === 'moment' ? (
            <MomentFeedCard
              moment={item.moment}
              photoWidth={photoWidth}
              viewerId={viewerId}
              avatarUrl={avatars[item.moment.author_id] ?? null}
              onOpenJar={() => onOpenJar(item.moment.jar_id)}
              onToggleLike={() => onToggleLike(item.moment)}
              onOpenComments={() => onOpenMoment(item.moment)}
              onRead={() => onReadAuthor(item.moment.author_id)}
              readDisabled={busy}
            />
          ) : (
            <FeedJarCard
              jar={item.jar}
              now={now}
              avatarUrl={avatars[item.jar.author_id] ?? null}
              onPress={() => onOpenJar(item.jar.jar_id)}
              onRead={() => onReadAuthor(item.jar.author_id)}
              readDisabled={busy}
            />
          )}
        </View>
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={header}
      ListEmptyComponent={
        showingSearch ? undefined : listLoading ? (
          <ActivityIndicator
            color={colors.muted}
            style={styles.loading}
            accessibilityLabel={t('explore.listLoading')}
            testID="discover-loading"
          />
        ) : listFailed ? (
          <View style={styles.message}>
            <Text style={[textStyle('body'), styles.center]}>{t('explore.listFailed')}</Text>
            <SecondaryButton label={t('explore.retry')} onPress={onRetryList} testID="discover-retry" />
          </View>
        ) : (
          <EmptyState
            illustration="compass"
            title={t('explore.emptyTitle')}
            body={t('explore.emptyBody')}
            refreshable
            testID="discover-empty"
          />
        )
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
      // Cards hold full-width photos; a small window keeps scrolling smooth (NFR-PERF-02).
      initialNumToRender={3}
      windowSize={5}
      testID="explore"
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function AuthorCard({
  person,
  busy,
  onOpen,
  onRead,
}: {
  person: Suggestion;
  busy: boolean;
  onOpen: () => void;
  onRead: () => void;
}) {
  const { t } = useTranslation();
  const reason =
    person.reason.kind === 'fullToday'
      ? t('explore.reasonFull')
      : person.reason.kind === 'friends'
        ? t('explore.reasonFriends', { count: person.reason.count })
        : t('explore.reasonContact');
  return (
    <View style={styles.card} testID={`explore-author-${person.username}`}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('explore.authorLabel', { name: person.displayName, reason })}
        style={styles.cardPerson}
      >
        <Avatar name={person.displayName} uri={person.avatarUrl} size="lg" decorative />
        <Text style={[textStyle('cardTitle'), styles.cardName]} numberOfLines={1}>
          {person.displayName}
        </Text>
        <Text style={[textStyle('label', '500'), styles.cardReason]} numberOfLines={1}>
          {reason}
        </Text>
      </Pressable>
      <View style={styles.cardButton}>
        <FollowButton
          action="read"
          name={person.displayName}
          onPress={onRead}
          disabled={busy}
          testID={`explore-author-${person.username}-read`}
        />
      </View>
    </View>
  );
}

function SearchResults({
  results,
  failed,
  busy,
  onOpenProfile,
  onSetReading,
}: {
  results: Person[] | undefined;
  failed: boolean;
  busy: boolean;
  onOpenProfile: (username: string) => void;
  onSetReading: (person: Person, reading: boolean) => void;
}) {
  const { t } = useTranslation();
  if (failed) return <Text style={[textStyle('body'), styles.empty]}>{t('explore.searchFailed')}</Text>;
  if (results === undefined) {
    return (
      <View style={styles.message}>
        <ActivityIndicator color={colors.muted} accessibilityLabel={t('explore.searching')} />
      </View>
    );
  }
  if (results.length === 0) {
    return (
      <EmptyState
        illustration="search"
        title={t('explore.noResultsTitle')}
        body={t('explore.noResults')}
        testID="explore-no-results"
      />
    );
  }
  return (
    <View style={styles.results} testID="explore-results">
      {results.map((p, i) => (
        <View
          key={p.id}
          style={[styles.resultRow, i < results.length - 1 ? styles.divider : null]}
          testID={`explore-result-${p.username}`}
        >
          <Pressable
            onPress={() => onOpenProfile(p.username)}
            accessibilityRole="button"
            accessibilityLabel={t('readers.row', { name: p.displayName, username: p.username })}
            style={styles.resultPerson}
          >
            <Avatar name={p.displayName} uri={p.avatarUrl} size="header" decorative />
            <View style={styles.resultNames}>
              <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
                {p.displayName}
              </Text>
              <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
                {t('profile.username', { username: p.username })}
              </Text>
            </View>
          </Pressable>
          <FollowButton
            action={p.reading ? 'reading' : 'read'}
            name={p.displayName}
            onPress={() => onSetReading(p, !p.reading)}
            disabled={busy}
            testID={`explore-result-${p.username}-button`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Same title block as the Moments and Jars tabs, so the title doesn't jump when switching tabs.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.headerTop + sizes.roundButton + space.md,
    paddingHorizontal: space.xl,
    paddingTop: sizes.headerTop,
    paddingBottom: space.md,
  },
  title: { color: colors.ink, flexShrink: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    marginHorizontal: space.xl,
    minHeight: e.searchHeight,
    paddingHorizontal: space.md + 2,
    borderRadius: e.searchRadius,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, color: colors.ink, paddingVertical: space.sm },
  section: { color: colors.ink, paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.md },
  empty: { color: colors.muted, paddingHorizontal: space.xl, marginTop: space.md },
  cards: { gap: e.cardGap, paddingHorizontal: space.xl },
  card: {
    width: e.cardWidth,
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  cardPerson: { alignItems: 'center', gap: space.xs, alignSelf: 'stretch' },
  cardName: { color: colors.ink, marginTop: space.xs },
  cardReason: { color: colors.muted },
  cardButton: { alignItems: 'center' },
  tabs: { paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: space.md },
  cardWrap: { paddingHorizontal: space.xl },
  separator: { height: space.md },
  loading: { marginTop: space.xxl },
  message: { alignItems: 'center', gap: space.md, paddingTop: space.xl, paddingHorizontal: space.xl },
  center: { textAlign: 'center', color: colors.muted },
  results: { marginTop: space.md, marginHorizontal: space.xl },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  resultPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  resultNames: { flex: 1 },
});
