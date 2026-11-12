import { Redirect, useGlobalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { completeSignIn } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

/** pickld://auth/callback?code=…: the email link (or a provider) coming back. Exchanges the code, then the
 * index sends a new account to About you and everyone else to Today. */
export function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const { code } = useGlobalSearchParams<{ code?: string }>();
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const failed = !code || exchangeFailed;

  useEffect(() => {
    if (code) completeSignIn(code).catch(() => setExchangeFailed(true));
  }, [code]);

  if (status === 'signedIn') return <Redirect href="/" />;
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom + space.xxl }]} testID="auth-callback">
      {failed ? (
        <>
          <Text accessibilityRole="alert" style={[textStyle('body'), styles.text]}>
            {t('auth.callback.failed')}
          </Text>
          <PrimaryButton label={t('auth.callback.tryAgain')} onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.brandText} />
          <Text style={[textStyle('body'), styles.text]}>{t('auth.callback.signingIn')}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space.xxl,
  },
  text: { color: colors.inkSoft, textAlign: 'center' },
});
