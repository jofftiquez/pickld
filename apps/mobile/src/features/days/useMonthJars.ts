// Data for My days (FR-DAY-01): one month of the user's jars from `month_jars` (0009, owner-only) with
// cover thumbnail URLs, and the month of the first jar, which bounds "Previous month". Both are React
// Query queries, so the persisted cache (src/lib/queryClient.ts) keeps them readable offline (NFR-OFF-03).
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { monthJarRow, monthOf, type MonthJar } from './monthGrid';
import { rememberPlaceholders } from '@/lib/image/photoPlaceholders';

const photoUrlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

/** Cover URLs from `fn:photo-urls` (as useToday does); a failure leaves cells without a photo. */
async function coverUrls(momentIds: string[]): Promise<Map<string, string | null>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  rememberPlaceholders(data);
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, m.thumb]));
}

async function fetchMonthJars(month: string): Promise<MonthJar[]> {
  const { data, error } = await getSupabase().rpc('month_jars', { month: `${month}-01` });
  if (error) throw new Error(error.message);
  const rows = z.array(monthJarRow).parse(data);
  const urls = await coverUrls(rows.flatMap((r) => (r.cover_moment_id ? [r.cover_moment_id] : [])));
  return rows.map((r) => ({ ...r, coverUrl: r.cover_moment_id ? (urls.get(r.cover_moment_id) ?? null) : null }));
}

async function fetchFirstJarMonth(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('jars')
    .select('local_date')
    .eq('user_id', userId)
    .order('local_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? monthOf(data.local_date) : null;
}

export const daysQueryKeys = {
  /** ['month', userId, 'YYYY-MM'] */
  month: (userId: string, month: string) => ['month', userId, month] as const,
  firstJarMonth: (userId: string) => ['firstJarMonth', userId] as const,
};

export function useMonthJars(month: string) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const enabled = userId !== null;
  const jars = useQuery({
    queryKey: daysQueryKeys.month(userId ?? '', month),
    queryFn: () => fetchMonthJars(month),
    enabled,
  });
  const firstJarMonth = useQuery({
    queryKey: daysQueryKeys.firstJarMonth(userId ?? ''),
    queryFn: () => fetchFirstJarMonth(userId ?? ''),
    enabled,
  });
  return {
    userId,
    jars: jars.data,
    /** Undefined while unknown (loading, or offline with nothing cached). */
    firstJarMonth: firstJarMonth.data,
  };
}
