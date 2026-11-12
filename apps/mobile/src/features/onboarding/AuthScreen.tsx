import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFlowError, openLegal, sendEmailLink, signInWithProvider } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';

import { AuthView, type AuthMode } from './AuthView';

/** Sign up / Sign in routes. Once a session exists (Apple, Google, or the email link) the app's index decides
 * where to go: About you for a new account, Today otherwise. */
export function AuthScreen({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedIn') return <Redirect href="/" />;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      const kind = e instanceof AuthFlowError ? e.kind : 'failed';
      if (kind !== 'cancelled') setError(t(`auth.errors.${kind}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthView
      mode={mode}
      insets={insets}
      email={email}
      onChangeEmail={(v) => {
        setEmail(v);
        setError(null);
      }}
      busy={busy}
      error={error}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      onProvider={(provider) => void run(() => signInWithProvider(provider))}
      onSubmitEmail={() =>
        void run(async () => {
          const sent = await sendEmailLink(email, mode);
          router.push({ pathname: '/check-email', params: { email: sent, mode } });
        })
      }
      onSwitchMode={() => router.replace(mode === 'signUp' ? '/sign-in' : '/sign-up')}
      onLegal={openLegal}
    />
  );
}
