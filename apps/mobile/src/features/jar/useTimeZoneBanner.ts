// Time zone banner state for Today (FR-JAR-05): which jars the user already tapped Got it on, kept on
// the phone per user and jar id, and whether to show the banner and the zone tag now.
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

import { shouldShowTimeZoneBanner, zoneChanged, zoneCity, type BannerJar } from './timeZoneBannerLogic';

// Only recent jars can be Today's jar again; older acknowledgements are dropped to keep the value small.
const MAX_ACKS = 50;

const acksSchema = z.array(z.string());

const ackKey = (userId: string) => `pickld-tz-banner-acks:${userId}`;

/** Jar ids the user acknowledged. Throws if the store can't be read, so the caller can hide the banner. */
export async function loadTimeZoneAcks(userId: string): Promise<string[]> {
  const raw = await Storage.getItem(ackKey(userId));
  if (raw === null) return [];
  const parsed = acksSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : [];
}

export async function saveTimeZoneAck(userId: string, jarId: string): Promise<void> {
  const acks = await loadTimeZoneAcks(userId).catch(() => []);
  const next = [...acks.filter((id) => id !== jarId), jarId].slice(-MAX_ACKS);
  await Storage.setItem(ackKey(userId), JSON.stringify(next));
}

export type TimeZoneBannerState = {
  /** Show the banner (once per zone change). */
  show: boolean;
  /** Readable zones for the banner and the tag on the jar; null when the zone didn't change. */
  zones: { from: string; to: string } | null;
  acknowledge: () => void;
};

export function useTimeZoneBanner(input: {
  userId: string | null;
  jar: BannerJar | null;
  previousTz: string | null | undefined;
}): TimeZoneBannerState {
  const { userId, jar, previousTz } = input;
  // Unknown until read for this user: no banner meanwhile, so it never flashes for an acknowledged jar.
  const [loaded, setLoaded] = useState<{ userId: string; ids: ReadonlySet<string> } | null>(null);
  const acks = loaded !== null && loaded.userId === userId ? loaded.ids : null;

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    loadTimeZoneAcks(userId)
      .then((ids) => active && setLoaded({ userId, ids: new Set(ids) }))
      .catch(() => {}); // unreadable store: stay unknown and hide the banner
    return () => {
      active = false;
    };
  }, [userId]);

  const jarId = jar?.id ?? null;
  const acknowledge = useCallback(() => {
    if (userId === null || jarId === null) return;
    setLoaded((prev) => ({
      userId,
      ids: new Set([...(prev !== null && prev.userId === userId ? prev.ids : []), jarId]),
    }));
    void saveTimeZoneAck(userId, jarId).catch(() => {});
  }, [userId, jarId]);

  const changed = jar !== null && previousTz && zoneChanged(jar.tz, previousTz);
  return {
    show: acks !== null && shouldShowTimeZoneBanner({ jar, previousTz, acknowledged: acks }),
    zones: changed ? { from: zoneCity(previousTz), to: zoneCity(jar.tz) } : null,
    acknowledge,
  };
}
