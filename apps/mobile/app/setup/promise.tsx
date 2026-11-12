import { Redirect } from 'expo-router';

import { PromiseScreen } from '@/features/onboarding/PromiseScreen';
import { useAuthStore } from '@/lib/authStore';

// The Pickld Promise: the last setup step (FR-ONB-07).
export default function Route() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <PromiseScreen />;
}
