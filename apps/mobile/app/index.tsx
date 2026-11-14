import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { readSetupStep, type SetupRoute } from '@/features/onboarding/setupFlow';
import { useProfileStatus } from '@/features/onboarding/useProfileStatus';
import { useAuthStore } from '@/lib/authStore';

// Where the app opens: Welcome when signed out, About you for an account without a profile yet (just signed
// up), the setup step left unfinished on this phone, Waiting for an account still waiting for early access
// (INV-06), Today for everyone else. The splash stays up while this is decided.
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.session?.user.id);
  const profileStatus = useProfileStatus();

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
  if (profileStatus.isPending || !setupStep || setupStep.userId !== userId) return null;
  if (profileStatus.data === null) return <Redirect href="/setup/about" />;
  if (setupStep.step) return <Redirect href={setupStep.step} />;
  if (profileStatus.data === 'waiting') return <Redirect href="/waiting" />;
  // Can't tell (offline; the status query fails fast): a session stored on this phone almost always belongs to a returning user.
  return <Redirect href="/(tabs)/today" />;
}
