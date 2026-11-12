import { Redirect } from 'expo-router';

import { DayScreen } from '@/features/onboarding/DayScreen';
import { useAuthStore } from '@/lib/authStore';

// Your day: setup step 2 (FR-ONB-02).
export default function DayRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <DayScreen />;
}
