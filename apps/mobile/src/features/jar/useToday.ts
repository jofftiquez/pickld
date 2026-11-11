// Data for the Today screen (FR-JAR-01): the open jar and its moments from Supabase, the signed-in
// profile, and the offline queue. Everything is read as the user, so RLS decides what comes back.
import { useQuery } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { findOpenJar, localDateIn } from '@/lib/jars';
import { listQueue } from '@/lib/queue/store';
import { getSupabase } from '@/lib/supabase';

import type { QueuedMoment, ServerMoment } from './todayGrid';

/** The phone's IANA zone (rule 7). */
export function phoneTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? 'UTC';
}

export type TodayJar = {
  /** False on the user's first day (no jar yet): the screen shows "Your first jar". */
  hasAnyJar: boolean;
  /** The open jar (travel rule), or null until the first moment of the day creates it. */
  jar: { id: string; localDate: string; tz: string } | null;
  moments: ServerMoment[];
};

export type Me = { displayName: string; avatarUrl: string | null; readerCount: number; lidColor: string };

const photoUrlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

/** Thumbnail URLs from `fn:photo-urls`; a failure leaves tiles on their placeholder instead of failing the screen. */
async function thumbUrls(momentIds: string[]): Promise<Map<string, string | null>> {
  if (momentIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', { body: { momentIds } });
  const parsed = photoUrlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map(parsed.data.data.moments.map((m) => [m.id, m.thumb]));
}

// A jar stays open until its own midnight (or server `ends_at`), so the open one is among the latest few.
const RECENT_JARS = 3;

async function fetchTodayJar(userId: string, now: Date): Promise<TodayJar> {
  const supabase = getSupabase();
  const { data: jars, error } = await supabase
    .from('jars')
    .select('id, local_date, tz, ends_at')
    .eq('user_id', userId)
    .order('local_date', { ascending: false })
    .limit(RECENT_JARS);
  if (error) throw new Error(error.message);
  const open = findOpenJar(jars, now);
  if (!open) return { hasAnyJar: jars.length > 0, jar: null, moments: [] };

  const { data: rows, error: momentsError } = await supabase
    .from('moments')
    .select('id, slot, status, is_private, is_backfilled, captured_at, added_at')
    .eq('jar_id', open.id);
  if (momentsError) throw new Error(momentsError.message);
  const urls = await thumbUrls(rows.filter((m) => m.status !== 'removed').map((m) => m.id));
  return {
    hasAnyJar: true,
    jar: { id: open.id, localDate: open.local_date, tz: open.tz },
    moments: rows.map((m) => ({ ...m, thumbUrl: urls.get(m.id) ?? null })),
  };
}

async function fetchMe(userId: string): Promise<Me> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_path, reader_count, lid_color')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  // TODO(M3-13): avatar photo URLs; until then the avatar shows initials.
  return { displayName: data.display_name, avatarUrl: null, readerCount: data.reader_count, lidColor: data.lid_color };
}

export const todayQueryKeys = {
  /** AGENTS.md: ['jar', userId, localDate], with today's date in the phone zone. */
  jar: (userId: string, localDate: string) => ['jar', userId, localDate] as const,
  me: (userId: string) => ['me', userId] as const,
  queue: (userId: string) => ['queue', userId] as const,
};

export function useToday(now: Date) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const localDate = localDateIn(now, phoneTimeZone());
  const enabled = userId !== null;

  const jar = useQuery({
    queryKey: todayQueryKeys.jar(userId ?? '', localDate),
    queryFn: () => fetchTodayJar(userId ?? '', now),
    enabled,
  });
  const me = useQuery({ queryKey: todayQueryKeys.me(userId ?? ''), queryFn: () => fetchMe(userId ?? ''), enabled });
  const queue = useQuery({
    queryKey: todayQueryKeys.queue(userId ?? ''),
    queryFn: async (): Promise<QueuedMoment[]> => listQueue(userId ?? ''),
    enabled,
    // Local SQLite: readable offline, and re-read on every focus because captures change it.
    networkMode: 'always',
    staleTime: 0,
  });

  return {
    userId,
    localDate,
    jar: jar.data,
    me: me.data,
    queue: queue.data ?? [],
    refetch: () => Promise.all([jar.refetch(), queue.refetch()]),
  };
}
