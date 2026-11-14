import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, join, radius, space } from '@/theme/tokens';

/** The invite on Sign up: none yet, being checked, a friend's (with their name) or another kind of code. */
export type JoinCode =
  | { state: 'none'; error: 'notACode' | 'unavailable' | 'limited' | null }
  | { state: 'checking'; token: string }
  | { state: 'invited'; token: string; inviter: { displayName: string; avatar: string | null } }
  | { state: 'ready'; token: string };

export type JoinCodeCardProps = {
  code: JoinCode;
  onPaste: () => void;
  onScan: () => void;
};

/**
 * The invite card on Sign up (INV-06; designs: SignUpCode, SignUpInvite). Without a code it offers Paste and
 * Scan QR; with one it says whose it is. The code is used once About you is saved.
 */
export function JoinCodeCard({ code, onPaste, onScan }: JoinCodeCardProps) {
  const { t } = useTranslation();
  const largeText = useLargeText();

  if (code.state === 'none') {
    return (
      <View style={styles.card} testID="join-code-card">
        <View style={[styles.row, largeText && styles.stacked]}>
          <Text style={[textStyle('cardTitle'), styles.title]}>{t('join.haveCode')}</Text>
          <View style={styles.actions}>
            <PillButton
              variant="subtle"
              icon="paste"
              label={t('join.paste')}
              accessibilityLabel={t('join.pasteA11y')}
              onPress={onPaste}
              testID="join-paste"
            />
            <PillButton
              variant="subtle"
              icon="scan"
              label={t('join.scan')}
              accessibilityLabel={t('join.scanA11y')}
              onPress={onScan}
              testID="join-scan"
            />
          </View>
        </View>
        {code.error ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[textStyle('caption'), styles.error]}>
            {t(`join.${code.error}`)}
          </Text>
        ) : null}
      </View>
    );
  }

  const title =
    code.state === 'invited'
      ? t('join.invitedBy', { name: code.inviter.displayName })
      : code.state === 'ready'
        ? t('join.codeReady')
        : t('join.checking');
  const body =
    code.state === 'invited'
      ? t('join.invitedBody', { name: code.inviter.displayName })
      : code.state === 'ready'
        ? t('join.codeReadyBody')
        : null;
  return (
    <View
      style={styles.card}
      testID="join-code-card"
      accessible
      accessibilityLabel={[title, body, t('join.codeA11y', { code: code.token })].filter(Boolean).join('. ')}
    >
      <View style={[styles.row, largeText && styles.stacked]}>
        {code.state === 'invited' ? (
          <Avatar name={code.inviter.displayName} uri={code.inviter.avatar} size="header" decorative />
        ) : null}
        <View style={styles.text}>
          <Text style={[textStyle('cardTitle'), styles.title]}>{title}</Text>
          {body ? <Text style={[textStyle('bodySmall'), styles.body]}>{body}</Text> : null}
        </View>
        {code.state === 'checking' ? (
          <ActivityIndicator color={colors.muted} />
        ) : (
          <View style={styles.code}>
            <Icon name="check" color="brandLink" size={14} strokeWidth={2.6} />
            <Text style={[textStyle('bodyMedium', '800'), styles.codeText]}>{code.token}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: join.cardRadius,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.sm,
    ...join.cardShadow,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stacked: { flexDirection: 'column', alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginLeft: 'auto' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: colors.ink, flexShrink: 1 },
  body: { color: colors.muted },
  error: { color: colors.danger },
  code: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  codeText: { color: colors.brandLink, letterSpacing: join.codeSpacing },
});
