// A profile's Together page (0177): moments others tagged this person in and agreed to show here, read as the
// viewer through together_page, so the database decides which ones they may see. Thumbnails come from
// fn:photo-urls, which checks each moment again.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import { thumbUrls } from './useProfile';

const togetherPageRow = z.object({
  moment_id: z.string(),
  jar_id: z.string(),
  author_id: z.string(),
  author_username: z.string(),
  author_name: z.string(),
  slot: z.enum(['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening']),
  local_date: z.string(),
  tz: z.string(),
  captured_at: z.string().nullable(),
  added_at: z.string(),
  edits: z.unknown(),
});

export type TogetherMoment = z.infer<typeof togetherPageRow> & { thumbUrl: string | null };

export async function fetchTogetherPage(userId: string): Promise<TogetherMoment[]> {
  const { data, error } = await getSupabase().rpc('together_page', { p_user: userId });
  if (error) throw new Error(error.message);
  const rows = z.array(togetherPageRow).parse(data);
  const urls = await thumbUrls(rows.map((r) => r.moment_id));
  return rows.map((r) => ({ ...r, thumbUrl: urls.get(r.moment_id) ?? null }));
}

/** The Together page of the profile `userId`; waits until the profile is known. */
export function useTogetherPage(userId: string | null) {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const query = useQuery({
    queryKey: ['together', userId ?? '', viewerId ?? ''],
    queryFn: () => fetchTogetherPage(userId ?? ''),
    enabled: viewerId !== null && userId !== null,
  });
  return {
    viewerId,
    data: query.data,
    failed: query.isError && query.data === undefined,
    refresh: async () => {
      await query.refetch();
    },
  };
}
