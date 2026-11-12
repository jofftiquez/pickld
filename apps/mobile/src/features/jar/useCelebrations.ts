// Opens the Full jar celebration and Sticker unlocked screens from Today (FR-JAR-07, FR-STK-05): reads the
// user's milestones (RLS: owner only), keeps what this phone has shown in expo-sqlite/kv-store per user,
// and pushes the next screen while Today is focused, so Sticker unlocked follows once the celebration closes.
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, type Href } from 'expo-router';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import { track } from '@/lib/analytics';
import { getSupabase } from '@/lib/supabase';

import { filledCount, milestoneKeys, nextCelebration, type Celebration, type CelebrationsSeen } from './celebrations';
import type { TodayJar } from './useToday';

// Only recent jars can be Today's jar again; older ones are dropped to keep the value small.
const MAX_JARS = 50;

const seenSchema = z.object({ jars: z.array(z.string()), milestones: z.array(z.string()) });

const seenKey = (userId: string) => `pickld-celebrations:${userId}`;

/** What this phone has shown the user; null when there is no record yet. Throws if the store can't be read. */
export async function loadCelebrationsSeen(userId: string): Promise<CelebrationsSeen | null> {
  const raw = await Storage.getItem(seenKey(userId));
  if (raw === null) return null;
  const parsed = seenSchema.safeParse(JSON.parse(raw));
  // A damaged record starts over like a new install: nothing pops up for what is already there.
  return parsed.success ? parsed.data : null;
}

export async function saveCelebrationsSeen(userId: string, seen: CelebrationsSeen): Promise<void> {
  const value: CelebrationsSeen = { jars: seen.jars.slice(-MAX_JARS), milestones: [...seen.milestones] };
  await Storage.setItem(seenKey(userId), JSON.stringify(value));
}

const milestoneRows = z.array(z.object({ key: z.string() }));

async function fetchMilestones(userId: string): Promise<string[]> {
  const { data, error } = await getSupabase().from('milestones').select('key').eq('user_id', userId);
  if (error) throw new Error(error.message);
  const parsed = milestoneRows.safeParse(data);
  if (!parsed.success) throw new Error('Unexpected milestones response');
  return parsed.data.map((row) => row.key);
}

/** The jar number (FR-JAR-08): the user's jars with at least one moment, up to and including this one. */
async function fetchJarNumber(userId: string, localDate: string): Promise<number | null> {
  const { count, error } = await getSupabase()
    .from('jars')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gt('moment_count', 0)
    .lte('local_date', localDate);
  return error || count === null || count < 1 ? null : count;
}

/** /full-jar params (strings from the link): the jar's date and, when known, its number. */
export const fullJarParams = z.object({
  localDate: z.iso.date(),
  number: z.coerce.number().int().positive().optional().catch(undefined),
});

/** /sticker-unlocked params: the milestone and how many the user has earned. */
export const stickerUnlockedParams = z.object({
  key: z.enum(milestoneKeys),
  earned: z.coerce.number().int().min(1).max(milestoneKeys.length).catch(1),
});

/** The route for a celebration. Params are strings; the screens validate them with the schemas above. */
export function celebrationHref(show: Celebration, extra: { jarNumber: number | null; earned: number }): Href {
  if (show.kind === 'fullJar') {
    return {
      pathname: '/full-jar',
      params: {
        jarId: show.jarId,
        localDate: show.localDate,
        ...(extra.jarNumber !== null ? { number: String(extra.jarNumber) } : null),
      },
    };
  }
  return { pathname: '/sticker-unlocked', params: { key: show.key, earned: String(extra.earned) } };
}

export function useCelebrations(input: {
  userId: string | null;
  /** Today's data; undefined while it loads. */
  today: Pick<TodayJar, 'jar' | 'moments'> | undefined;
  open: (href: Href) => void;
}): void {
  const { userId, today } = input;
  // The latest callback, so an inline arrow from the screen doesn't re-run the effect.
  const open = useRef(input.open);
  useEffect(() => {
    open.current = input.open;
  });
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  // Unknown until read for this user: nothing is shown meanwhile. `current` then follows each change.
  const [loaded, setLoaded] = useState<{ userId: string; seen: CelebrationsSeen | null } | null>(null);
  const current = useRef<{ userId: string; seen: CelebrationsSeen | null } | null>(null);
  useEffect(() => {
    if (userId === null) return;
    let active = true;
    loadCelebrationsSeen(userId)
      .then((seen) => active && setLoaded({ userId, seen }))
      .catch(() => {}); // unreadable store: stay unknown and show nothing
    return () => {
      active = false;
    };
  }, [userId]);

  // Re-read whenever the jar's count changes: the 8th moment and the milestone it earns arrive together.
  const count = filledCount(today?.moments ?? []);
  const milestones = useQuery({
    queryKey: ['milestones', userId ?? '', count],
    queryFn: () => fetchMilestones(userId ?? ''),
    enabled: userId !== null,
  });

  const earnedKeys = milestones.data;
  useEffect(() => {
    if (!focused || userId === null || today === undefined || earnedKeys === undefined) return;
    const record = current.current?.userId === userId ? current.current : loaded?.userId === userId ? loaded : null;
    if (record === null) return;
    const next = nextCelebration({
      seen: record.seen,
      jar: today.jar,
      moments: today.moments,
      milestones: earnedKeys,
    });
    if (next.seen === record.seen) return;
    // Remember first, so a re-render never opens the same screen twice.
    current.current = { userId, seen: next.seen };
    void saveCelebrationsSeen(userId, next.seen).catch(() => {});
    const show = next.show;
    if (show === null) return;
    const earned = milestoneKeys.filter((key) => earnedKeys.includes(key)).length;
    if (show.kind === 'sticker') {
      open.current(celebrationHref(show, { jarNumber: null, earned }));
      return;
    }
    // Once per jar, like the celebration itself (the seen record above).
    track('jar_full', {});
    void fetchJarNumber(userId, show.localDate)
      .catch(() => null)
      .then((jarNumber) => open.current(celebrationHref(show, { jarNumber, earned })));
  }, [focused, userId, loaded, today, earnedKeys]);
}
