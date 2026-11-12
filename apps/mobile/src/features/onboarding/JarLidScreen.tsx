import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { lidColors } from '@/theme/tokens';

import { JarLidView, type LidName } from './JarLidView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

/** Pick your jar: saves profiles.lid_color (also changeable in Edit profile). */
export function JarLidScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [lid, setLid] = useState<LidName>('pickle');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const onContinue = async () => {
    if (!userId) return;
    setBusy(true);
    setFailed(false);
    try {
      const { error } = await getSupabase().from('profiles').update({ lid_color: lidColors[lid] }).eq('id', userId);
      if (error) throw error;
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      const next = nextSetupRoute('/setup/jar-lid');
      await saveSetupStep(userId, next);
      if (next) router.push(next);
      else router.replace('/');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <JarLidView
      insets={insets}
      lid={lid}
      busy={busy}
      failed={failed}
      onPick={setLid}
      onContinue={() => void onContinue()}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
