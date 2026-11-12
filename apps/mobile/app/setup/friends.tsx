import { Redirect } from 'expo-router';

import { FindFriendsScreen } from '@/features/onboarding/FindFriendsScreen';
import { useAuthStore } from '@/lib/authStore';

// Find friends: setup step 6 (FR-ONB-06).
export default function Route() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <FindFriendsScreen />;
}
