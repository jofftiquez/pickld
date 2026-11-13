// One day's jar for the selected-day card and Fill this jar (FR-DAY-02): the jar (id, zone) and its moments
// with thumbnail URLs, read as the owner so RLS decides, plus the offline queue so photos waiting to upload
// show in the card at once (rule 3). React Query, so the persisted cache keeps it readable offline.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { z } from 'zod';

import type { QueuedMoment, ServerMoment } from '@/features/jar/todayGrid';
import { todayQueryKeys } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { listQueue, subscribeQueue } from '@/lib/queue/store';
import { getSupabase } from '@/lib/supabase';

export type DayJar = {
  /** Null when the user has no jar for the date (Fill this jar creates it). */
  jar: { id: string; localDate: string; tz: string } | null;
  moments: ServerMoment[];
};

const photoUrlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

/** Thumbnail URLs from `fn:photo-urls` (as useToday does); a failure leaves the thumbnails on their placeholder. */
async function thumbUrls(momentIds: string[]): Promise<Map<string, string | null>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, m.thumb]));
}

async function fetchDayJar(userId: string, localDate: string): Promise<DayJar> {
  const supabase = getSupabase();
  const { data: jar, error } = await supabase
    .from('jars')
    .select('id, local_date, tz')
    .eq('user_id', userId)
    .eq('local_date', localDate)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!jar) return { jar: null, moments: [] };
  const { data: rows, error: momentsError } = await supabase
    .from('moments')
    .select('id, slot, status, visibility, is_backfilled, captured_at, added_at, replaces')
    .eq('jar_id', jar.id);
  if (momentsError) throw new Error(momentsError.message);
  const urls = await thumbUrls(rows.map((m) => m.id));
  return {
    jar: { id: jar.id, localDate: jar.local_date, tz: jar.tz },
    moments: rows.map((m) => ({ ...m, thumbUrl: urls.get(m.id) ?? null })),
  };
}

export const dayQueryKeys = {
  /** ['day', userId, 'YYYY-MM-DD'] */
  day: (userId: string, localDate: string) => ['day', userId, localDate] as const,
};

/** The jar for `localDate` (nothing is read while it is null) and the user's offline queue. */
export function useDayJar(localDate: string | null) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const day = useQuery({
    queryKey: dayQueryKeys.day(userId ?? '', localDate ?? ''),
    queryFn: () => fetchDayJar(userId ?? '', localDate ?? ''),
    enabled: userId !== null && localDate !== null,
  });
  const queue = useQuery({
    queryKey: todayQueryKeys.queue(userId ?? ''),
    queryFn: async (): Promise<QueuedMoment[]> => listQueue(userId ?? ''),
    enabled: userId !== null,
    networkMode: 'always',
    staleTime: 0,
  });

  // A queued photo that reaches the server leaves the queue: re-read the day so its thumbnail stays.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return;
    return subscribeQueue((change) => {
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      if (change === 'removed') void queryClient.invalidateQueries({ queryKey: ['day', userId] });
    });
  }, [queryClient, userId]);

  return {
    userId,
    /** Undefined while loading (or offline with nothing cached). */
    day: day.data,
    queue: queue.data ?? [],
  };
}
