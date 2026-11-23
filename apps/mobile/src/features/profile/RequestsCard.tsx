import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PillButton } from '@/components/PillButton';
import type { AvatarUrls } from '@/lib/avatars';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import type { ReaderRequest } from './useReaderRequests';

export type RequestsCardProps = {
  requests: ReaderRequest[];
  /** Signed avatars by profile id; initials for anyone missing. */
  avatars: AvatarUrls;
  busy?: boolean;
  onOpenProfile: (username: string) => void;
  onAnswer: (request: ReaderRequest, approve: boolean) => void;
};

/** Requests (0176): people waiting to read you, newest first, each with Approve and Decline. Top of your Readers list. */
export function RequestsCard({ requests, avatars, busy, onOpenProfile, onAnswer }: RequestsCardProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  return (
    <View style={styles.card} testID="readers-requests">
      <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.title]}>
        {t('readers.requests', { count: requests.length })}
      </Text>
      {requests.map((r, i) => (
        <View
          key={r.id}
          style={[styles.row, large && styles.rowWrap, i < requests.length - 1 ? styles.divider : null]}
          testID={`request-row-${r.username}`}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('readers.row', { name: r.display_name, username: r.username })}
            accessibilityHint={t('readers.openHint')}
            onPress={() => onOpenProfile(r.username)}
            style={[styles.person, large && styles.personLarge]}
          >
            <Avatar name={r.display_name} uri={avatars[r.id] ?? null} size="header" decorative />
            <View style={styles.names}>
              <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
                {r.display_name}
              </Text>
              <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
                {t('profile.username', { username: r.username })}
              </Text>
            </View>
          </Pressable>
          <View style={styles.buttons}>
            <PillButton
              variant="subtle"
              label={t('readers.decline')}
              accessibilityLabel={t('readers.declineA11y', { name: r.display_name })}
              accessibilityHint={t('readers.declineHint')}
              onPress={() => onAnswer(r, false)}
              disabled={busy}
              testID={`request-row-${r.username}-decline`}
            />
            <PillButton
              label={t('readers.approve')}
              accessibilityLabel={t('readers.approveA11y', { name: r.display_name })}
              accessibilityHint={t('readers.approveHint')}
              onPress={() => onAnswer(r, true)}
              disabled={busy}
              testID={`request-row-${r.username}-approve`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.md + 2,
    ...shadow.card,
  },
  title: { color: colors.muted, paddingTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  // Large text: the buttons wrap below, so the name isn't cut to one letter (D-37).
  rowWrap: { flexWrap: 'wrap', rowGap: space.sm },
  personLarge: { flexBasis: '100%' },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: sizes.minTap },
  names: { flex: 1, gap: 1 },
  buttons: { flexDirection: 'row', gap: space.sm },
});
