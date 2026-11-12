import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AuthFlowError, emailSchema, resendSecondsLeft, sendEmailLink } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';

import { CheckEmailView } from './CheckEmailView';

const paramsSchema = z.object({ email: emailSchema, mode: z.enum(['signUp', 'signIn']) });

/** Check your email. The link opens pickld://auth/callback, which signs this phone in. */
export function CheckEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const params = paramsSchema.safeParse(useLocalSearchParams());
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const secondsLeft = resendSecondsLeft(sentAt, now);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  if (status === 'signedIn') return <Redirect href="/" />;
  if (!params.success) return <Redirect href="/sign-up" />;
  const { email, mode } = params.data;

  const back = () => (router.canGoBack() ? router.back() : router.replace(mode === 'signUp' ? '/sign-up' : '/sign-in'));

  return (
    <CheckEmailView
      insets={insets}
      email={email}
      secondsLeft={secondsLeft}
      notice={notice}
      onBack={back}
      onOpenMail={() => void Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:')}
      onResend={() => {
        setNotice(null);
        const restart = Date.now();
        setSentAt(restart);
        setNow(restart);
        sendEmailLink(email, mode).then(
          () => setNotice(t('auth.checkEmail.resent')),
          (e: unknown) => {
            setNotice(t(`auth.errors.${e instanceof AuthFlowError ? e.kind : 'failed'}`));
            setSentAt(0);
          },
        );
      }}
      onDifferentEmail={back}
    />
  );
}
