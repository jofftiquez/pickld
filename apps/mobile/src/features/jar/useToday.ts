// Data for the Today screen (FR-JAR-01): the open jar and its moments from Supabase, the signed-in
// profile, and the offline queue. Everything is read as the user, so RLS decides what comes back.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import { useEffect } from 'react';
import { z } from 'zod';

import { useAuthStore } from '@/lib/authStore';
import { trackNetwork } from '@/lib/connectivity';
import { findOpenJar, localDateIn, normalizeZone } from '@/lib/jars';
import { listQueue, subscribeQueue } from '@/lib/queue/store';
import { getSupabase } from '@/lib/supabase';

import type { Visibility } from '@/features/publish/publishJar';

import type { QueuedMoment, ServerMoment } from './todayGrid';

/** The phone's IANA zone (rule 7). */
export function phoneTimeZone(): string {
  return normalizeZone(getCalendars()[0]?.timeZone);
}

export type TodayJar = {
  /** False on the user's first day (no jar yet): the screen shows "Your first jar". */
  hasAnyJar: boolean;
  /** The open jar (travel rule), or null until the first moment of the day creates it. `endsAt` is the
   * server's `ends_at`; optional because caches persisted before M2-06 lack it. */
  jar: {
    id: string;
    localDate: string;
    tz: string;
    endsAt?: string | null;
    /** Optional because caches persisted before M3-01 lack them; a missing `publishedAt` reads as unpublished. */
    visibility?: Visibility;
    publishedAt?: string | null;
    /** Server-set like count (FR-SOC-05); optional because caches persisted before M3-02 lack it. */
    likeCount?: number;
  } | null;
  moments: ServerMoment[];
  /** Zone of the user's latest jar before the open one (Time zone banner, FR-JAR-05): null when there is
   * none; missing in caches persisted before M2-29, which means unknown. */
  previousTz?: string | null;
};

export type Me = {
  displayName: string;
  avatarUrl: string | null;
  readerCount: number;
  lidColor: string;
  /** Publish review's preselected visibility (FR-PUB-01); optional in caches persisted before M3-01. */
  defaultVisibility?: Visibility;
};

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
    .select('id, local_date, tz, ends_at, visibility, published_at, like_count')
    .eq('user_id', userId)
    .order('local_date', { ascending: false })
    .limit(RECENT_JARS);
  if (error) throw new Error(error.message);
  const open = findOpenJar(jars, now);
  if (!open) return { hasAnyJar: jars.length > 0, jar: null, moments: [] };
  const previousTz = await fetchPreviousTz(userId, jars, open);

  const { data: rows, error: momentsError } = await supabase
    .from('moments')
    .select('id, slot, status, is_private, is_backfilled, captured_at, added_at, edits, replaces')
    .eq('jar_id', open.id);
  if (momentsError) throw new Error(momentsError.message);
  // Removed moments too: their tile shows the owner's photo blurred (FR-PUB-07).
  const urls = await thumbUrls(rows.map((m) => m.id));
  return {
    hasAnyJar: true,
    jar: {
      id: open.id,
      localDate: open.local_date,
      tz: open.tz,
      endsAt: open.ends_at,
      visibility: open.visibility,
      publishedAt: open.published_at,
      likeCount: open.like_count,
    },
    moments: rows.map((m) => ({ ...m, thumbUrl: urls.get(m.id) ?? null })),
    previousTz,
  };
}

/** The zone of the latest jar dated before `open`: from the recent jars, or one more read when `open` is
 * the oldest of them. */
async function fetchPreviousTz(
  userId: string,
  recent: readonly { local_date: string; tz: string }[],
  open: { local_date: string },
): Promise<string | null> {
  const earlier = recent.find((jar) => jar.local_date < open.local_date);
  if (earlier) return earlier.tz;
  if (recent.length < RECENT_JARS) return null;
  const { data, error } = await getSupabase()
    .from('jars')
    .select('tz')
    .eq('user_id', userId)
    .lt('local_date', open.local_date)
    .order('local_date', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data[0]?.tz ?? null;
}

async function fetchMe(userId: string): Promise<Me> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar_path, reader_count, lid_color, default_visibility')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  // TODO(M3-13): avatar photo URLs; until then the avatar shows initials.
  return {
    displayName: data.display_name,
    avatarUrl: null,
    readerCount: data.reader_count,
    lidColor: data.lid_color,
    defaultVisibility: data.default_visibility,
  };
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
    // Fetch results feed the offline signal; offline, the persisted cache keeps the last jar (NFR-OFF-03).
    queryFn: () => trackNetwork(fetchTodayJar(userId ?? '', now)),
    enabled,
  });
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => trackNetwork(fetchMe(userId ?? '')),
    enabled,
  });
  const queue = useQuery({
    queryKey: todayQueryKeys.queue(userId ?? ''),
    queryFn: async (): Promise<QueuedMoment[]> => listQueue(userId ?? ''),
    enabled,
    // Local SQLite: readable offline, and re-read on every focus because captures change it.
    networkMode: 'always',
    staleTime: 0,
  });

  // Upload states change while Today is open: re-read the queue, and the jar once an item has reached the
  // server and left the queue, so its tile shows the server moment instead of going empty.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (userId === null) return;
    return subscribeQueue((change) => {
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      if (change === 'removed') void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
    });
  }, [queryClient, userId]);

  return {
    userId,
    localDate,
    jar: jar.data,
    me: me.data,
    queue: queue.data ?? [],
    refetch: () => Promise.all([jar.refetch(), queue.refetch()]),
  };
}
