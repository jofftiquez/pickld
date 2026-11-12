import { Redirect } from 'expo-router';

import { PeopleScreen } from '@/features/onboarding/PeopleScreen';
import { useAuthStore } from '@/lib/authStore';

// Your people: setup step 3 (FR-ONB-03).
export default function Route() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <PeopleScreen />;
}
