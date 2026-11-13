import * as Linking from 'expo-linking';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { AuthFlowError, CODE_LENGTH, emailSchema, resendSecondsLeft, sendEmailCode, verifyEmailCode } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';

import { CheckEmailView } from './CheckEmailView';

const paramsSchema = z.object({ email: emailSchema, mode: z.enum(['signUp', 'signIn']) });

/** Check your email. The emailed 6-digit code is checked at the 6th digit; the session then reaches
 * useAuthStore and the route guard (app/_layout.tsx) drops the signed-out screens and opens the app. */
export function CheckEmailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const params = paramsSchema.safeParse(useLocalSearchParams());
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  // When the code being typed was sent; tells an expired code from a wrong one (verifyEmailCode).
  const [codeSentAt, setCodeSentAt] = useState(() => Date.now());
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
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

  const onChangeCode = (next: string) => {
    setCode(next);
    setCodeError(null);
    if (next.length < CODE_LENGTH || verifying) return;
    setVerifying(true);
    verifyEmailCode(email, next, codeSentAt).then(
      // Signed in: keep the field locked until the route guard moves on.
      () => undefined,
      (e: unknown) => {
        setVerifying(false);
        setCode('');
        setCodeError(t(`auth.errors.${e instanceof AuthFlowError ? e.kind : 'failed'}`));
      },
    );
  };

  return (
    <CheckEmailView
      insets={insets}
      email={email}
      code={code}
      onChangeCode={onChangeCode}
      verifying={verifying}
      codeError={codeError}
      secondsLeft={secondsLeft}
      notice={notice}
      onBack={back}
      onOpenMail={() => void Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:')}
      onResend={() => {
        setNotice(null);
        setCodeError(null);
        setCode('');
        const restart = Date.now();
        setSentAt(restart);
        setNow(restart);
        sendEmailCode(email, mode).then(
          () => {
            // A new code replaces the old one and has its own 10 minutes.
            setCodeSentAt(restart);
            setNotice(t('auth.checkEmail.resent'));
          },
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
