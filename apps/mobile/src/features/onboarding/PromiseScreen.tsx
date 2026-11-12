import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMe, phoneTimeZone, todayQueryKeys } from '@/features/jar/useToday';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { formatDate } from '@/lib/format';
import { getSupabase } from '@/lib/supabase';

import { PromiseView } from './PromiseView';
import { saveSetupStep } from './setupFlow';
import { useHold } from './useHold';

/**
 * The Pickld Promise, the last setup step. A full hold saves onboarding_answers.promise_accepted_at;
 * Skip saves nothing. Both end setup, so the Promise is never asked again on this account's phone.
 */
export function PromiseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => fetchMe(userId ?? ''),
    enabled: !!userId,
  });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const finish = async () => {
    if (!userId) return;
    track('signup_step_completed', { step: 'promise' });
    await saveSetupStep(userId, null);
    router.replace('/');
  };

  const accept = async (): Promise<boolean> => {
    if (!userId) return false;
    setBusy(true);
    setFailed(false);
    const { error } = await getSupabase()
      .from('onboarding_answers')
      .upsert({ user_id: userId, promise_accepted_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) {
      setBusy(false);
      setFailed(true);
      return false;
    }
    await finish();
    return true;
  };
  const hold = useHold(accept);

  return (
    <PromiseView
      insets={insets}
      name={me.data?.displayName.split(' ')[0] ?? ''}
      date={formatDate(new Date(), phoneTimeZone())}
      holding={hold.holding}
      busy={busy}
      failed={failed}
      onPressIn={hold.press}
      onPressOut={hold.release}
      onConfirm={hold.confirm}
      onSkip={() => void finish()}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
