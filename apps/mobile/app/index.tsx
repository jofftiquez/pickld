import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { readSetupStep, type SetupRoute } from '@/features/onboarding/setupFlow';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

// Where the app opens: Welcome when signed out, About you for an account without a profile yet (just signed
// up), the setup step left unfinished on this phone, Today for everyone else. The splash stays up while this is decided.
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const hasProfile = useQuery({
    queryKey: ['hasProfile', userId],
    enabled: userId !== undefined,
    // Offline it fails fast instead of waiting for a connection; see below.
    networkMode: 'always',
    retry: 1,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profiles').select('id').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  });

  // Setup started on this phone and not finished: resume at the recorded step (FR-ONB-09). Read from storage
  // each time, not through the persisted query cache, which could still hold a step setup has since left.
  const [setupStep, setSetupStep] = useState<{ userId: string; step: SetupRoute | null } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    readSetupStep(userId).then(
      (step) => active && setSetupStep({ userId, step }),
      () => active && setSetupStep({ userId, step: null }),
    );
    return () => {
      active = false;
    };
  }, [userId]);

  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (hasProfile.isPending || !setupStep || setupStep.userId !== userId) return null;
  if (hasProfile.data === false) return <Redirect href="/setup/about" />;
  if (setupStep.step) return <Redirect href={setupStep.step} />;
  // Can't tell (offline): a session stored on this phone almost always belongs to a returning user.
  return <Redirect href="/(tabs)/today" />;
}
