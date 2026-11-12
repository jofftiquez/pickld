import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

// Where the app opens: Welcome when signed out, About you for an account without a profile yet (just signed
// up), Today for everyone else. The splash stays up while this is decided.
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

  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (hasProfile.isPending) return null;
  // Can't tell (offline): a session stored on this phone almost always belongs to a returning user.
  return <Redirect href={hasProfile.data === false ? '/setup/about' : '/(tabs)/today'} />;
}
