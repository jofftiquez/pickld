import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PillButton } from '@/components/PillButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import type { BlockedAccount } from './block';

export type BlockedViewProps = {
  /** Undefined while the first load runs. */
  rows: BlockedAccount[] | undefined;
  failed?: boolean;
  busy?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onUnblock: (row: BlockedAccount) => void;
  onRetry: () => void;
  locale?: string;
};

/** Blocked accounts (Blocked; FR-PUB-06): who you blocked and when, each with Unblock. */
export function BlockedView({
  rows,
  failed = false,
  busy = false,
  insets,
  onBack,
  onUnblock,
  onRetry,
  locale = deviceLocale(),
}: BlockedViewProps) {
  const { t } = useTranslation();
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(iso));
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="blocked-screen">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('blocked.back')} onPress={onBack} testID="blocked-back" />
        <Text accessibilityRole="header" style={[textStyle('cropTitle'), { color: colors.ink }]}>
          {t('blocked.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <Text style={[textStyle('bodySmall'), styles.intro]}>{t('blocked.intro')}</Text>
        {rows === undefined && failed ? (
          <View style={styles.message}>
            <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('blocked.failed')}</Text>
            <SecondaryButton label={t('blocked.retry')} onPress={onRetry} testID="blocked-retry" />
          </View>
        ) : rows === undefined ? (
          <ActivityIndicator color={colors.muted} style={styles.message} testID="blocked-loading" />
        ) : rows.length === 0 ? (
          <Text
            style={[textStyle('body'), styles.center, styles.message, { color: colors.muted }]}
            testID="blocked-empty"
          >
            {t('blocked.empty')}
          </Text>
        ) : (
          <View style={styles.card} testID="blocked-list">
            {rows.map((row, i) => (
              <View
                key={row.id}
                style={[styles.row, i < rows.length - 1 ? styles.divider : null]}
                testID={`blocked-row-${row.username}`}
              >
                <Avatar name={row.display_name} size="header" decorative />
                <View style={styles.names}>
                  <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
                    {row.display_name}
                  </Text>
                  <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
                    {t('blocked.since', { username: row.username, date: date(row.blocked_at) })}
                  </Text>
                </View>
                <PillButton
                  variant="subtle"
                  label={t('blocked.unblock')}
                  accessibilityLabel={t('blocked.unblockA11y', { name: row.display_name })}
                  onPress={() => onUnblock(row)}
                  disabled={busy}
                  testID={`blocked-unblock-${row.username}`}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.sm + 2 },
  intro: { color: colors.inkSoft, marginHorizontal: space.xs, lineHeight: 19 },
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
