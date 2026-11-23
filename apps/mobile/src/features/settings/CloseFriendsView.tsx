import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Toggle } from '@/components/Toggle';
import type { FollowListRow } from '@/features/profile/useFollowList';
import type { AvatarUrls } from '@/lib/avatars';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

export type CloseFriendsViewProps = {
  /** The caller's readers matching the search; undefined while the first load runs. */
  rows: FollowListRow[] | undefined;
  /** Who is on the list. */
  ids: ReadonlySet<string>;
  /** How many are on the list; undefined while unknown. */
  count: number | undefined;
  query: string;
  onChangeQuery: (query: string) => void;
  avatars?: AvatarUrls;
  failed?: boolean;
  failedSave?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onToggle: (row: FollowListRow, on: boolean) => void;
  onRetry: () => void;
};

/** Close friends (0179): the caller's readers, each with a switch for the list. No design of its own (Blocked's layout). */
export function CloseFriendsView({
  rows,
  ids,
  count,
  query,
  onChangeQuery,
  avatars = {},
  failed = false,
  failedSave = false,
  insets,
  onBack,
  onToggle,
  onRetry,
}: CloseFriendsViewProps) {
  const { t } = useTranslation();
  const searching = query.trim() !== '';
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="close-friends-screen">
      <View style={styles.header}>
        <RoundIconButton
          icon="back"
          accessibilityLabel={t('closeFriends.back')}
          onPress={onBack}
          testID="close-friends-back"
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
        >
          {t('closeFriends.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <Text style={[textStyle('bodySmall'), styles.intro]}>{t('closeFriends.intro')}</Text>
        {count !== undefined ? (
          <Text style={[textStyle('bodySmall', '700'), styles.count]} testID="close-friends-count">
            {t('closeFriends.count', { count })}
          </Text>
        ) : null}
        <View style={styles.search}>
          <Icon name="search" color="muted" size={18} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder={t('closeFriends.search')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('closeFriends.search')}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[textStyle('body'), styles.searchInput]}
            testID="close-friends-search"
          />
        </View>
        {failedSave ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), styles.error]}>
            {t('closeFriends.failedSave')}
          </Text>
        ) : null}
        {rows === undefined && failed ? (
          <View style={styles.message}>
            <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('closeFriends.failed')}</Text>
            <SecondaryButton label={t('closeFriends.retry')} onPress={onRetry} testID="close-friends-retry" />
          </View>
        ) : rows === undefined ? (
          <ActivityIndicator color={colors.muted} style={styles.message} testID="close-friends-loading" />
        ) : rows.length === 0 ? (
          <EmptyState
            illustration={searching ? 'search' : 'star'}
            title={t(searching ? 'closeFriends.noMatchTitle' : 'closeFriends.emptyTitle')}
            body={t(searching ? 'closeFriends.noMatch' : 'closeFriends.empty')}
            testID="close-friends-empty"
          />
        ) : (
          <View style={styles.card} testID="close-friends-list">
            {rows.map((row, i) => {
              const on = ids.has(row.id);
              return (
                <View
                  key={row.id}
                  style={[styles.row, i < rows.length - 1 ? styles.divider : null]}
                  testID={`close-friends-row-${row.username}`}
                >
                  <Avatar name={row.display_name} uri={avatars[row.id] ?? null} size="header" decorative />
                  <View style={styles.names}>
                    <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
                      {row.display_name}
                    </Text>
                    <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
                      @{row.username}
                    </Text>
                  </View>
                  <Toggle
                    value={on}
                    onValueChange={(next) => onToggle(row, next)}
                    accessibilityLabel={t('closeFriends.toggleA11y', { name: row.display_name })}
                    testID={`close-friends-toggle-${row.username}`}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTitle: { flexShrink: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.sm + 2 },
  intro: { color: colors.inkSoft, marginHorizontal: space.xs, lineHeight: 19 },
  count: { color: colors.ink, marginHorizontal: space.xs, marginTop: space.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: sizes.searchField,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md + 2,
    ...shadow.card,
  },
  searchInput: { flex: 1, color: colors.ink, paddingVertical: 0 },
  error: { color: colors.danger, marginHorizontal: space.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: sizes.cardPadding,
    paddingVertical: space.xs,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  names: { flex: 1, gap: 1 },
  message: { marginTop: space.xxl, gap: space.md },
  center: { textAlign: 'center' },
});
