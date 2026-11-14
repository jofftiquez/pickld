import * as Clipboard from 'expo-clipboard';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/lib/analytics';
import { AuthFlowError, openLegal, sendEmailCode, signInWithProvider } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';
import { JoinCodeCard, type JoinCode } from '@/features/invite/JoinCodeCard';
import { fetchInvitePreview, inviteTokenFrom, usePendingInvite } from '@/features/invite/join';

import { AuthView, type AuthMode } from './AuthView';

/** Sign up's invite card state for a kept token: who invited, or why it can't be used (INV-06). */
export function useJoinCode(enabled: boolean) {
  const token = usePendingInvite((s) => s.token);
  const load = usePendingInvite((s) => s.load);
  const keep = usePendingInvite((s) => s.keep);
  const clear = usePendingInvite((s) => s.clear);
  const [checked, setChecked] = useState<{ token: string; code: JoinCode } | null>(null);
  const [error, setError] = useState<'notACode' | 'unavailable' | 'limited' | null>(null);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !token) return;
    let live = true;
    fetchInvitePreview(token)
      .then(async (p) => {
        if (!live) return;
        if (!p.ok) {
          setError(p.reason);
          await clear();
        } else {
          setChecked({
            token,
            code: p.inviter ? { state: 'invited', token, inviter: p.inviter } : { state: 'ready', token },
          });
        }
      })
      // Offline: keep the code; About you tries it once the account exists.
      .catch(() => live && setChecked({ token, code: { state: 'ready', token } }));
    return () => {
      live = false;
    };
  }, [enabled, token, clear]);

  const code: JoinCode = !token
    ? { state: 'none', error }
    : checked?.token === token
      ? checked.code
      : { state: 'checking', token };

  const paste = async () => {
    const found = inviteTokenFrom(await Clipboard.getStringAsync());
    setError(found ? null : 'notACode');
    if (found) await keep(found);
  };
  return { code, paste };
}

/** Sign up / Sign in routes. Once a session exists (Apple, Google, or the emailed code) the app's index decides
 * where to go: About you for a new account, Today otherwise. */
export function AuthScreen({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signUp = mode === 'signUp';
  const { code, paste } = useJoinCode(signUp);

  if (status === 'signedIn') return <Redirect href="/" />;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      // Sign up is done once a provider signed in or the email code went out.
      if (mode === 'signUp') track('signup_step_completed', { step: 'sign_up' });
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
          const sent = await sendEmailCode(email, mode);
          router.push({ pathname: '/check-email', params: { email: sent, mode } });
        })
      }
      onSwitchMode={() => router.replace(mode === 'signUp' ? '/sign-in' : '/sign-up')}
      onLegal={openLegal}
      showFan={!signUp || code.state === 'none'}
      codeCard={
        signUp ? (
          <JoinCodeCard code={code} onPaste={() => void paste()} onScan={() => router.push('/scan')} />
        ) : undefined
      }
    />
  );
}
