import { Redirect } from 'expo-router';

import { PermissionsScreen } from '@/features/onboarding/PermissionsScreen';
import { useAuthStore } from '@/lib/authStore';

// Permissions: setup step 5 (FR-ONB-05).
export default function Route() {
  const status = useAuthStore((s) => s.status);
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <PermissionsScreen />;
}
