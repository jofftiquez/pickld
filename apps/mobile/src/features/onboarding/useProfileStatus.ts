import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

/** The signed-in account's profile status (active, waiting…), or null when it has no profile yet. */
export function useProfileStatus() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['profileStatus', userId],
    enabled: userId !== undefined,
    // Offline it fails fast instead of waiting for a connection.
    networkMode: 'always',
    retry: 1,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profiles').select('status').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data?.status ?? null;
    },
  });
}
