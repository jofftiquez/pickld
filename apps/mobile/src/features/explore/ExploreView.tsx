import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { FollowButton } from '@/features/profile/FollowButton';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, explore as e, radius, space } from '@/theme/tokens';

import type { Explore, FullJar, Person, Suggestion } from './explore';

export type ExploreViewProps = {
  /** Undefined while loading. */
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
  onBack: () => void;
  onRetry: () => void;
  onOpenProfile: (username: string) => void;
  onSetReading: (person: Person, reading: boolean) => void;
  onOpenJar: (jarId: string) => void;
};

/**
 * Explore (FR-EXP-01, FR-EXP-02): search people by name or @username, Suggested authors with Read, and a grid of
 * Everyone jars filled today. While there's text to search, the results replace the two sections.
 */
export function ExploreView({
  data,
  failed = false,
  insets,
  query,
  onQueryChange,
  results,
  searching,
  searchFailed = false,
  busy = false,
  onBack,
  onRetry,
  onOpenProfile,
  onSetReading,
  onOpenJar,
}: ExploreViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * space.xl - (e.gridColumns - 1) * e.gridGap) / e.gridColumns;
  const showingSearch = searching || results !== undefined || searchFailed;

  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) + space.lg }}
      testID="explore"
    >
      <View style={styles.header}>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('screenTitle'), styles.title]}
        >
          {t('explore.title')}
        </Text>
        <RoundIconButton icon="back" accessibilityLabel={t('explore.back')} onPress={onBack} testID="explore-back" />
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
      ) : data === undefined ? (
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
      ) : (
        <>
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.section]}>
            {t('explore.suggested')}
          </Text>
          {data.suggestions.length === 0 ? (
            <Text style={[textStyle('bodySmall'), styles.empty]}>{t('explore.suggestedEmpty')}</Text>
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

          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.section]}>
            {t('explore.fullJars')}
          </Text>
          {data.fullJars.length === 0 ? (
            <Text style={[textStyle('bodySmall'), styles.empty]}>{t('explore.fullJarsEmpty')}</Text>
          ) : (
            <View style={styles.grid} testID="explore-full-jars">
              {data.fullJars.map((jar) => (
                <JarTile key={jar.jarId} jar={jar} width={tileWidth} onOpen={() => onOpenJar(jar.jarId)} />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
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

function JarTile({ jar, width, onOpen }: { jar: FullJar; width: number; onOpen: () => void }) {
  const { t } = useTranslation();
  const name = jar.displayName.split(/\s+/)[0] ?? jar.displayName;
  return (
    <Pressable
      onPress={onOpen}
      style={[styles.tile, { width }]}
      accessibilityRole="button"
      accessibilityLabel={t('explore.jarLabel', { name: jar.displayName })}
      testID={`explore-jar-${jar.jarId}`}
    >
      {jar.coverUrl ? (
        <Image source={{ uri: jar.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.tileName}>
        <Text style={[textStyle('label', '700'), { color: colors.surface }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </Pressable>
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
    return <Text style={[textStyle('body'), styles.empty]}>{t('explore.noResults')}</Text>;
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: e.gridGap, paddingHorizontal: space.xl },
  tile: {
    aspectRatio: 3 / 4,
    borderRadius: e.tileRadius,
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
    justifyContent: 'flex-end',
    padding: space.sm,
  },
  tileName: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.badge,
  },
  message: { alignItems: 'center', gap: space.md, paddingTop: space.xl, paddingHorizontal: space.xl },
  center: { textAlign: 'center', color: colors.muted },
  results: { marginTop: space.md, marginHorizontal: space.xl },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  resultPerson: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  resultNames: { flex: 1 },
});
