// The days on a timeline with how many rows each holds (`moments_feed_days`, `feed_days`; 0130), newest first, in
// the phone's zone: the scrubber's rail (FR-SOC-01). Same visibility as the timeline itself.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { phoneTimeZone } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { feedDayRow } from './scrubberModel';

export type TimelineKind = 'moments' | 'jars';

export const feedDaysQueryKeys = {
  days: (kind: TimelineKind, userId: string, tz: string) => ['feedDays', kind, userId, tz] as const,
};

export async function fetchFeedDays(kind: TimelineKind, tz: string) {
  const { data, error } = await getSupabase().rpc(kind === 'moments' ? 'moments_feed_days' : 'feed_days', {
    p_tz: tz,
  });
  if (error) throw new Error(error.message);
  return z.array(feedDayRow).parse(data);
}

export function useFeedDays(kind: TimelineKind) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const tz = phoneTimeZone();
  const days = useQuery({
    queryKey: feedDaysQueryKeys.days(kind, userId ?? '', tz),
    queryFn: () => fetchFeedDays(kind, tz),
    enabled: userId !== null,
  });
  return { days: days.data, tz, refetch: () => void days.refetch() };
}
