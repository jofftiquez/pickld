import { useQueryClient } from '@tanstack/react-query';

import { jarPageQueryKeys } from '@/features/jar/useJarPage';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';

import { setJarCover } from './momentActions';

/**
 * Set as cover (D-56), shared by Moment options and the preview's action bar (D-98): sets the jar's cover,
 * refreshes every screen that shows or badges it, and says so. Throws a MomentOptionError on failure.
 */
export function useSetJarCover(userId: string) {
  const queryClient = useQueryClient();
  return async (jarId: string, momentId: string): Promise<void> => {
    await setJarCover(getSupabase(), jarId, momentId);
    void queryClient.invalidateQueries({ queryKey: jarPageQueryKeys.jar(userId, jarId) });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    // Today's and the day page's grids badge the cover (D-98).
    void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
    void queryClient.invalidateQueries({ queryKey: ['day', userId] });
    showToast('coverSet');
  };
}
