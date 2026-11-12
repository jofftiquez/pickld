import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

// Dev builds only: `pickld://dev/sign-out` signs this phone out, so Maestro can start the signed-out flows
// (Welcome, Sign up, Sign in). Release builds redirect away and change nothing.
export default function DevSignOutRoute() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (__DEV__) void getSupabase().auth.signOut({ scope: 'local' });
  }, []);
  if (!__DEV__ || status === 'signedOut') return <Redirect href="/" />;
  return null;
}
