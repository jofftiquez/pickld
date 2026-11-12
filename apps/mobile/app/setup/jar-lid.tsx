import { Redirect } from 'expo-router';

import { JarLidScreen } from '@/features/onboarding/JarLidScreen';
import { useAuthStore } from '@/lib/authStore';

// Pick your jar: setup step 4 (FR-ONB-04).
export default function Route() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <JarLidScreen />;
}
