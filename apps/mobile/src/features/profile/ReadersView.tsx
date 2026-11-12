import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { FollowRow } from './FollowRow';
import { compactCount, type ProfileRow } from './profileModel';
import type { FollowList, FollowListRow } from './useFollowList';

export type ReadersViewProps = {
  /** Whose lists these are; undefined while loading, null when the profile isn't available. */
  profile: ProfileRow | null | undefined;
  viewerId: string | null;
  list: FollowList;
  onSelectList: (list: FollowList) => void;
  query: string;
  onChangeQuery: (query: string) => void;
  /** Undefined while the first load runs. */
  rows: FollowListRow[] | undefined;
  failed?: boolean;
  /** A follow request is in flight. */
  busy?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onToggleReading: (row: FollowListRow) => void;
  onRemoveReader: (row: FollowListRow) => void;
  onRetry: () => void;
  locale?: string;
};

/**
 * Readers & authors (Readers; FR-SOC-09, FR-SOC-07): the person's username, a switch between their readers
 * and authors with counts, a search field and a card of rows with Read / Read back / Reading. On your own
 * Readers list, long press a row to remove that reader.
 */
export function ReadersView({
  profile,
  viewerId,
  list,
  onSelectList,
  query,
  onChangeQuery,
  rows,
  failed = false,
  busy = false,
  insets,
  onBack,
  onOpenProfile,
  onToggleReading,
  onRemoveReader,
  onRetry,
  locale = deviceLocale(),
}: ReadersViewProps) {
  const { t } = useTranslation();
  const [removing, setRemoving] = useState<FollowListRow | null>(null);
  const isOwner = profile?.id === viewerId;
  const countLabel = (n: number) => {
    const c = compactCount(n, locale);
    return c.thousands ? t('profile.thousands', { value: c.value }) : c.value;
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="readers-screen">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('readers.back')} onPress={onBack} testID="readers-back" />
        <Text
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.title, { color: colors.ink }]}
          numberOfLines={1}
          testID="readers-title"
        >
          {profile?.username ?? ''}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      {profile === null ? (
        <View style={styles.message}>
          <Text style={[textStyle('body'), styles.centerText, { color: colors.muted }]} testID="readers-unavailable">
            {t('profile.unavailableTitle')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <SegmentedControl
            segments={[
              {
                key: 'readers',
                label: profile
                  ? t('readers.readersTab', { count: profile.reader_count, value: countLabel(profile.reader_count) })
                  : t('profile.readers'),
              },
              {
                key: 'authors',
                label: profile
                  ? t('readers.authorsTab', { count: profile.author_count, value: countLabel(profile.author_count) })
                  : t('profile.authors'),
              },
            ]}
            selected={list}
            onSelect={onSelectList}
            accessibilityLabel={t('readers.lists')}
            testID="readers-tabs"
          />
          <View style={styles.search}>
            <Icon name="search" color="muted" size={18} />
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder={list === 'readers' ? t('readers.searchReaders') : t('readers.searchAuthors')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={list === 'readers' ? t('readers.searchReaders') : t('readers.searchAuthors')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              style={[textStyle('body'), styles.searchInput]}
              testID="readers-search"
            />
          </View>
          {rows === undefined && failed ? (
            <View style={styles.message}>
              <Text style={[textStyle('body'), styles.centerText, { color: colors.muted }]}>{t('readers.failed')}</Text>
              <SecondaryButton label={t('profile.retry')} onPress={onRetry} testID="readers-retry" />
            </View>
          ) : rows === undefined ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} testID="readers-loading" />
          ) : rows.length === 0 ? (
            <Text style={[textStyle('body'), styles.centerText, styles.empty]} testID="readers-empty">
              {query.trim() !== ''
                ? t('readers.noMatch')
                : list === 'readers'
                  ? t('readers.noReaders')
                  : t('readers.noAuthors')}
            </Text>
          ) : (
            <View style={styles.card} testID={`readers-list-${list}`}>
              {rows.map((row, i) => (
                <FollowRow
                  key={row.id}
                  row={row}
                  isViewer={row.id === viewerId}
                  divider={i < rows.length - 1}
                  onOpen={() => onOpenProfile(row.username)}
                  onToggleReading={() => onToggleReading(row)}
                  onRemove={isOwner && list === 'readers' ? () => setRemoving(row) : undefined}
                  disabled={busy}
                />
              ))}
            </View>
          )}
          {isOwner && list === 'readers' && rows !== undefined && rows.length > 0 ? (
            <Text style={[textStyle('label', '500'), styles.centerText, { color: colors.muted }]}>
              {t('readers.removeTip')}
            </Text>
          ) : null}
        </ScrollView>
      )}
      <Dialog
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={t('readers.removeTitle', { name: removing?.display_name ?? '' })}
        message={t('readers.removeMessage')}
        testID="readers-remove-dialog"
      >
        <DangerButton
          label={t('readers.remove')}
          onPress={() => {
            if (removing) onRemoveReader(removing);
            setRemoving(null);
          }}
          testID="readers-remove-confirm"
        />
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  title: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.md },
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
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md + 2,
    ...shadow.card,
  },
  message: { gap: space.md, alignItems: 'center', paddingVertical: space.xxl },
  centerText: { textAlign: 'center' },
  empty: { color: colors.muted, paddingVertical: space.xxl },
  loading: { paddingVertical: space.xxl },
});
