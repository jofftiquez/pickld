import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { TextField } from '@/components/TextField';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { onboardingPhotos, type OnboardingPhoto } from './photos';
import { ProviderButton } from './ProviderButton';

export type AuthMode = 'signUp' | 'signIn';

/** The four fanned photos above each form: tilt and how far each sits below the top. */
const FAN: Record<AuthMode, { photo: OnboardingPhoto; rotate: string; top: number }[]> = {
  signUp: [
    { photo: 'morning', rotate: '-6deg', top: 16 },
    { photo: 'ootd', rotate: '4deg', top: 0 },
    { photo: 'food', rotate: '-2deg', top: 16 },
    { photo: 'whoamiwith', rotate: '7deg', top: 2 },
  ],
  signIn: [
    { photo: 'whereami', rotate: '-6deg', top: 16 },
    { photo: 'selfie', rotate: '4deg', top: 0 },
    { photo: 'afternoon', rotate: '-2deg', top: 16 },
    { photo: 'evening', rotate: '7deg', top: 2 },
  ],
};

export type AuthViewProps = {
  mode: AuthMode;
  insets: EdgeInsets;
  email: string;
  onChangeEmail: (email: string) => void;
  /** A sign-in is in flight: buttons are disabled. */
  busy: boolean;
  /** Translated error under the email field. */
  error: string | null;
  onBack: () => void;
  onProvider: (provider: 'apple' | 'google') => void;
  onSubmitEmail: () => void;
  /** Sign up ↔ Sign in. */
  onSwitchMode: () => void;
  onLegal: (page: 'terms' | 'privacy') => void;
};

/** Sign up and Sign in (FR-ACC-01, FR-ACC-02, FR-PRV-04): Apple, Google, or a 6-digit email code. */
export function AuthView({
  mode,
  insets,
  email,
  onChangeEmail,
  busy,
  error,
  onBack,
  onProvider,
  onSubmitEmail,
  onSwitchMode,
  onLegal,
}: AuthViewProps) {
  const { t } = useTranslation();
  const k = mode === 'signUp' ? 'auth.signUp' : 'auth.signIn';
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID={mode === 'signUp' ? 'sign-up-screen' : 'sign-in-screen'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <RoundIconButton icon="back" accessibilityLabel={t('auth.back')} onPress={onBack} testID="auth-back" />
        <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {FAN[mode].map((f, i) => (
            <Image
              key={f.photo}
              source={onboardingPhotos[f.photo]}
              contentFit="cover"
              accessible={false}
              style={[styles.fanPhoto, { marginTop: f.top, transform: [{ rotate: f.rotate }], zIndex: i % 2 }]}
            />
          ))}
        </View>
        <Text
          maxFontSizeMultiplier={maxTextScale.title}
          accessibilityRole="header"
          style={[textStyle('onboardTitle'), { color: colors.ink }]}
        >
          {t(`${k}.title`)}
        </Text>
        <Text style={[textStyle('body'), styles.body]}>{t(`${k}.body`)}</Text>
        <View style={styles.providers}>
          <ProviderButton
            provider="apple"
            label={t(`${k}.apple`)}
            showMark={mode === 'signUp'}
            disabled={busy}
            onPress={() => onProvider('apple')}
            testID="auth-apple"
          />
          <ProviderButton
            provider="google"
            label={t(`${k}.google`)}
            showMark={mode === 'signUp'}
            disabled={busy}
            onPress={() => onProvider('google')}
            testID="auth-google"
          />
        </View>
        <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.rule} />
          <Text style={[textStyle('bodyMedium'), { color: colors.muted }]}>{t('auth.or')}</Text>
          <View style={styles.rule} />
        </View>
        <TextField
          label={t('auth.email')}
          value={email}
          onChangeText={onChangeEmail}
          placeholder={t('auth.emailPlaceholder')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          autoCorrect={false}
          // Send from the keyboard: at large text the button can sit under it.
          returnKeyType="send"
          onSubmitEditing={() => {
            if (!busy && email.trim().length > 0) onSubmitEmail();
          }}
          testID="auth-email"
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={[textStyle('caption'), styles.error]}>
            {error}
          </Text>
        ) : mode === 'signIn' ? (
          <Text style={[textStyle('caption'), styles.hint]}>{t('auth.signIn.hint')}</Text>
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton
          label={mode === 'signUp' ? t('auth.signUp.email') : t('auth.signIn.send')}
          onPress={onSubmitEmail}
          disabled={busy || email.trim().length === 0}
          testID="auth-submit"
        />
        {mode === 'signUp' ? (
          <View style={styles.footer}>
            <Text style={[textStyle('caption'), styles.footerText]}>
              {t('auth.signUp.haveAccount')}{' '}
              <Text accessibilityRole="link" onPress={onSwitchMode} style={styles.link} testID="auth-switch">
                {t('auth.signUp.signIn')}
              </Text>
            </Text>
            <Text style={[textStyle('caption'), styles.footerText]}>
              {t('auth.signUp.agree')}{' '}
              <Text accessibilityRole="link" onPress={() => onLegal('terms')} style={styles.link} testID="auth-terms">
                {t('auth.signUp.terms')}
              </Text>{' '}
              {t('auth.signUp.and')}{' '}
              <Text
                accessibilityRole="link"
                onPress={() => onLegal('privacy')}
                style={styles.link}
                testID="auth-privacy"
              >
                {t('auth.signUp.privacy')}
              </Text>
              .
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('auth.signIn.newHere')}
            onPress={onSwitchMode}
            hitSlop={hitSlopFor(undefined, 24)}
            style={styles.switch}
            testID="auth-switch"
          >
            <Text style={[textStyle('bodyMedium', '700'), styles.link]}>{t('auth.signIn.newHere')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: space.xxl, gap: space.lg },
  fan: { flexDirection: 'row', justifyContent: 'center', marginTop: space.sm, marginBottom: space.xs },
  fanPhoto: {
    width: sizes.authPhoto,
    aspectRatio: 3 / 4,
    marginHorizontal: -space.xs,
    borderRadius: radius.jarTile,
    borderWidth: sizes.photoFrame,
    borderColor: colors.surface,
    backgroundColor: colors.photoPlaceholder,
  },
  body: { color: colors.inkSoft, marginTop: -space.xs },
  providers: { gap: space.md, marginTop: space.xs },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border },
  hint: { color: colors.muted, marginTop: -space.sm },
  error: { color: colors.danger, marginTop: -space.sm },
  spacer: { flex: 1, minHeight: space.lg },
  footer: { alignItems: 'center', gap: space.xs },
  footerText: { color: colors.muted, textAlign: 'center' },
  link: { color: colors.brandLink, textDecorationLine: 'underline' },
  switch: { alignItems: 'center', paddingVertical: space.sm },
});
