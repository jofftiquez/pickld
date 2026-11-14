// Data for Memories (M6-06; FR-DAY-03): On this day, last month's recap and this year so far, from the owner-only
// RPCs in 0030, with photo URLs from fn:photo-urls. React Query, so the persisted cache keeps it readable offline.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { fetchMomentRenders } from '@/features/moment/momentRenders';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { monthRecapRow, onThisDayRow, previousMonth, yearsBetween, yearSummaryRow, type Memories } from './memories';

const photoUrlsResponse = z.object({
  data: z.object({
    moments: z.array(z.object({ id: z.string(), full: z.string().nullable(), thumb: z.string().nullable() })),
  }),
});

/** Signed URLs from `fn:photo-urls`; a failure leaves the photos on their placeholder. */
async function photoUrls(momentIds: string[]): Promise<Map<string, { full: string | null; thumb: string | null }>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, { full: m.full, thumb: m.thumb }]));
}

export async function fetchMemories(today: string): Promise<Memories> {
  const supabase = getSupabase();
  const month = previousMonth(today);
  const year = Number(today.slice(0, 4));
  const [days, recap, summary] = await Promise.all([
    supabase.rpc('memories_on_this_day', { today }),
    supabase.rpc('memories_month_recap', { month: `${month}-01` }),
    supabase.rpc('memories_year_summary', { year }),
  ]);
  const error = days.error ?? recap.error ?? summary.error;
  if (error) throw new Error(error.message);
  // The newest earlier year is the memory shown.
  const day = z.array(onThisDayRow).parse(days.data)[0] ?? null;
  const r = z.array(monthRecapRow).parse(recap.data)[0];
  const y = z.array(yearSummaryRow).parse(summary.data)[0];
  if (!r || !y) throw new Error('memories: empty summary');

  const ids = [...(day?.cover_moment_id ? [day.cover_moment_id] : []), ...r.strip.map((p) => p.moment_id)];
  // The photos' edits (D-96), read as the owner; a failed read leaves them plain.
  const [urls, renders] = await Promise.all([photoUrls(ids), fetchMomentRenders(ids)]);
  return {
    onThisDay: day
      ? {
          jarId: day.jar_id,
          localDate: day.local_date,
          momentCount: day.moment_count,
          yearsAgo: yearsBetween(day.local_date, today),
          coverMomentId: day.cover_moment_id,
          photoUrl: day.cover_moment_id ? (urls.get(day.cover_moment_id)?.full ?? null) : null,
          photoRender: day.cover_moment_id ? (renders.get(day.cover_moment_id) ?? null) : null,
        }
      : null,
    recap: {
      month,
      momentCount: r.moment_count,
      fullDays: r.full_days,
      topSlot: r.top_slot,
      photos: r.strip.map((p) => ({
        momentId: p.moment_id,
        jarId: p.jar_id,
        slot: p.slot,
        thumbUrl: urls.get(p.moment_id)?.thumb ?? null,
        render: renders.get(p.moment_id) ?? null,
      })),
    },
    year: { year, jarsFilled: y.jars_filled, fullDays: y.full_days, momentCount: y.moment_count },
  };
}

export function useMemories(today: string) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['memories', userId ?? '', today] as const,
    queryFn: () => fetchMemories(today),
    enabled: userId !== null,
  });
}
