// Data for Not published (My jars): the owner's unpublished past days from the last week, with cover
// thumbnails, and Keep to myself. React Query, so the persisted cache keeps the list readable offline.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { phoneTimeZone } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { localDateIn } from '@/lib/jars';
import { getSupabase } from '@/lib/supabase';

import { keepJars, pickUnpublished, unpublishedFrom, type UnpublishedJar } from './unpublishedJars';
import { coverUrls } from './useMonthJars';

async function fetchUnpublished(userId: string): Promise<UnpublishedJar[]> {
  const now = new Date();
  const today = localDateIn(now, phoneTimeZone());
  const { data, error } = await getSupabase()
    .from('jars')
    .select('id, local_date, tz, ends_at, moment_count, resolved_cover_id')
    .eq('user_id', userId)
    .is('published_at', null)
    .is('kept_at', null)
    .gt('moment_count', 0)
    .gte('local_date', unpublishedFrom(today))
    .order('local_date', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = pickUnpublished(data, now, today);
  const urls = await coverUrls(rows.flatMap((r) => (r.resolved_cover_id ? [r.resolved_cover_id] : [])));
  return rows.map((r) => ({
    id: r.id,
    localDate: r.local_date,
    momentCount: r.moment_count,
    coverMomentId: r.resolved_cover_id,
    coverUrl: r.resolved_cover_id ? (urls.get(r.resolved_cover_id) ?? null) : null,
  }));
}

export const unpublishedQueryKeys = {
  /** ['unpublished', userId] */
  list: (userId: string) => ['unpublished', userId] as const,
};

export function useUnpublishedJars() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const key = unpublishedQueryKeys.list(userId ?? '');
  const list = useQuery({
    queryKey: key,
    queryFn: () => fetchUnpublished(userId ?? ''),
    enabled: userId !== null,
  });
  // The kept days leave the list at once; it waits for a connection and re-reads once the server has them.
  const keep = useMutation({
    mutationFn: (jarIds: readonly string[]) => keepJars(getSupabase(), jarIds),
    onMutate: async (jarIds) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<UnpublishedJar[]>(key);
      queryClient.setQueryData<UnpublishedJar[]>(key, (jars) => jars?.filter((jar) => !jarIds.includes(jar.id)));
      return { before };
    },
    onError: (_error, _jarIds, context) => {
      queryClient.setQueryData(key, context?.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return {
    userId,
    /** Undefined while loading (or offline with nothing cached). */
    jars: list.data,
    keep: (jarIds: readonly string[]) => keep.mutate(jarIds),
    /** The last Keep to myself didn't reach the server; the days are back in the list. */
    keepFailed: keep.isError,
  };
}
