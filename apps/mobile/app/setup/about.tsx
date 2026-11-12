import { Redirect } from 'expo-router';

import { AboutScreen } from '@/features/onboarding/AboutScreen';
import { useAuthStore } from '@/lib/authStore';

// About you. New accounts land here after signing up (app/index.tsx).
export default function AboutRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <AboutScreen />;
}
