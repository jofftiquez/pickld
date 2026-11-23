import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { parseEdits } from '@/features/edit/edits';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import { ProfileGridTile } from './ProfileGridTile';
import type { ProfileRow } from './profileModel';
import type { TogetherMoment } from './useTogetherPage';

export type TogetherViewProps = {
  /** The profile; undefined while loading, null when it isn't available to the viewer. */
  profile: ProfileRow | null | undefined;
  viewerId: string | null;
  /** Undefined while loading. */
  moments: TogetherMoment[] | undefined;
  failed?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onOpenMoment: (momentId: string, jarId: string) => void;
  onRetry: () => void;
  locale?: string;
};

const GRID_COLUMNS = 3;
const GRID_GAP = space.sm - 2;
const GRID_PADDING = space.xl;

function formatTileDate(localDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

/**
 * A profile's Together page (0174): moments other people tagged this person in and agreed to show here, newest
 * first, as a 3-column grid like the profile's. Each tile names its author and opens the moment in their jar;
 * nothing here is in this person's own jars.
 */
export function TogetherView({
  profile,
  viewerId,
  moments,
  failed = false,
  insets,
  onBack,
  onOpenMoment,
  onRetry,
  locale = deviceLocale(),
}: TogetherViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * GRID_PADDING - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
  const isOwner = profile != null && profile.id === viewerId;
  const name = profile?.display_name ?? '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="together-screen">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('together.back')} onPress={onBack} testID="together-back" />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.title, { color: colors.ink }]}
          testID="together-title"
        >
          {t('together.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      {profile === null ? (
        <View style={styles.message}>
          <Text style={[textStyle('body'), styles.centerText, { color: colors.muted }]} testID="together-unavailable">
            {t('profile.unavailableTitle')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
          {profile ? (
            <Text style={[textStyle('bodySmall'), { color: colors.muted }]} testID="together-intro">
              {isOwner ? t('together.introMine') : t('together.introOther', { name })}
            </Text>
          ) : null}
          {failed ? (
            <View style={styles.message}>
              <Text style={[textStyle('body'), styles.centerText, { color: colors.muted }]}>
                {t('together.failed')}
              </Text>
              <SecondaryButton label={t('together.retry')} onPress={onRetry} testID="together-retry" />
            </View>
          ) : moments === undefined || profile === undefined ? (
            <ActivityIndicator color={colors.muted} style={styles.loading} testID="together-loading" />
          ) : moments.length === 0 ? (
            <EmptyState
              illustration="photo"
              title={t('together.emptyTitle')}
              body={isOwner ? t('together.emptyMine') : t('together.emptyOther', { name })}
              testID="together-empty"
            />
          ) : (
            <View style={styles.grid} testID="together-grid">
              {moments.map((m) => {
                const slot = t(`slots.${m.slot}`);
                const date = formatTileDate(m.local_date, locale);
                return (
                  <ProfileGridTile
                    key={m.moment_id}
                    uri={m.thumbUrl}
                    edits={parseEdits(m.edits)}
                    stamp={{ capturedAt: new Date(m.captured_at ?? m.added_at), tz: m.tz }}
                    width={tileWidth}
                    title={t('together.with', { username: m.author_username })}
                    detail={date}
                    accessibilityLabel={t('together.tile', { slot, name: m.author_name, date })}
                    accessibilityHint={t('together.openHint', { name: m.author_name })}
                    onPress={() => onOpenMoment(m.moment_id, m.jar_id)}
                    testID={`together-moment-${m.moment_id}`}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
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
  // Shrinks to fit one line at large text instead of pushing the back button off screen (D-37).
  title: { flex: 1, flexShrink: 1, textAlign: 'center' },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: GRID_PADDING, gap: space.md },
  message: { gap: space.md, alignItems: 'center', paddingHorizontal: space.xxl, paddingTop: space.xxl },
  centerText: { textAlign: 'center' },
  loading: { marginTop: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
});
