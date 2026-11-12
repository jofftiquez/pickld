import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type CheckEmailViewProps = {
  insets: EdgeInsets;
  email: string;
  /** Seconds until Resend unlocks; 0 shows the Resend link. */
  secondsLeft: number;
  /** Translated note under the buttons (resent, or an error). */
  notice: string | null;
  onBack: () => void;
  onOpenMail: () => void;
  onResend: () => void;
  onDifferentEmail: () => void;
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Check your email (FR-ACC-01): where the link went, Open email app, a 60-second Resend, Use a different email. */
export function CheckEmailView({
  insets,
  email,
  secondsLeft,
  notice,
  onBack,
  onOpenMail,
  onResend,
  onDifferentEmail,
}: CheckEmailViewProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl }]}
      testID="check-email-screen"
    >
      <RoundIconButton icon="back" accessibilityLabel={t('auth.back')} onPress={onBack} testID="auth-back" />
      <View style={styles.middle}>
        <View style={styles.well}>
          <Icon name="mail" color="brandText" size={sizes.checkEmailIcon} strokeWidth={2.4} />
        </View>
        <Text accessibilityRole="header" style={[textStyle('onboardTitle'), styles.center, { color: colors.ink }]}>
          {t('auth.checkEmail.title')}
        </Text>
        <Text style={[textStyle('body'), styles.center, styles.body]} testID="check-email-to">
          {t('auth.checkEmail.sentTo')} <Text style={textStyle('body', '700')}>{email}</Text>
          {t('auth.checkEmail.tapIt')}
        </Text>
      </View>
      <PrimaryButton label={t('auth.checkEmail.openApp')} onPress={onOpenMail} testID="check-email-open" />
      {secondsLeft > 0 ? (
        <Text style={[textStyle('caption'), styles.center, styles.muted]} testID="check-email-timer">
          {t('auth.checkEmail.resendIn', { time: clock(secondsLeft) })}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('auth.checkEmail.resend')}
          onPress={onResend}
          hitSlop={hitSlopFor(undefined, 20)}
          testID="check-email-resend"
        >
          <Text style={[textStyle('caption', '700'), styles.center, styles.link]}>{t('auth.checkEmail.resend')}</Text>
        </Pressable>
      )}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={[textStyle('caption'), styles.center, styles.muted]}>
          {notice}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.checkEmail.different')}
        onPress={onDifferentEmail}
        hitSlop={hitSlopFor(undefined, 24)}
        style={styles.different}
        testID="check-email-different"
      >
        <Text style={[textStyle('bodyMedium', '700'), styles.center, styles.link]}>
          {t('auth.checkEmail.different')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xxl, gap: space.lg },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingBottom: sizes.checkEmailWell * 2,
  },
  well: {
    width: sizes.checkEmailWell,
    height: sizes.checkEmailWell,
    borderRadius: radius.card + space.sm,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  body: { color: colors.inkSoft, lineHeight: 23 },
  muted: { color: colors.muted },
  link: { color: colors.brandLink, textDecorationLine: 'underline' },
  different: { paddingVertical: space.xs },
});
