// Signed avatar URLs for a screen (D-93; FR-SOC-08). Avatars are private keys signed by fn:photo-urls, which
// reads each profile as the caller, so RLS leaves out anyone blocked either way and inactive profiles. One
// query per screen signs every person on it in batches of 100. The key carries each avatar key, so a new
// upload is a new query and every screen shows the new photo once its rows are read again. Without a photo,
// or while signing (or when it fails), the Avatar shows initials.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useAuthStore } from './authStore';
import { getSupabase } from './supabase';

const BATCH = 100; // fn:photo-urls MAX_BATCH
/** Signed URLs live 15 minutes (fn:photo-urls); sign again a little before that. */
const STALE_MS = 10 * 60 * 1000;

const urlsResponse = z.object({
  data: z.object({ profiles: z.array(z.object({ id: z.string(), avatar: z.string().nullable() })) }),
});

/** A person on screen and their avatar key from the row that listed them (null or missing: no photo). */
export type AvatarEntry = { id: string; path: string | null | undefined };

/** Signed avatar URL by profile id. */
export type AvatarUrls = Record<string, string | null>;

export const avatarQueryKeys = {
  /** ['avatars', viewerId, ...]: every screen's avatars. */
  all: ['avatars'] as const,
  /** ['avatars', viewerId, ['id:key', …]] (sorted, one per person with a photo). */
  set: (viewerId: string, pairs: string[]) => ['avatars', viewerId, pairs] as const,
};

/** Profile ids with a photo, one per person, as `id:key` sorted so the same people give the same key. */
export function avatarPairs(entries: AvatarEntry[]): string[] {
  const byId = new Map<string, string>();
  for (const e of entries) if (e.path) byId.set(e.id, e.path);
  return [...byId].map(([id, path]) => `${id}:${path}`).sort();
}

export async function fetchAvatarUrls(profileIds: string[]): Promise<AvatarUrls> {
  const batches: string[][] = [];
  for (let i = 0; i < profileIds.length; i += BATCH) batches.push(profileIds.slice(i, i + BATCH));
  const results = await Promise.all(
    batches.map(async (ids) => {
      const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', {
        body: { profileIds: ids },
      });
      if (error) throw new Error(error.message);
      return urlsResponse.parse(data).data.profiles;
    }),
  );
  return Object.fromEntries(results.flat().map((p) => [p.id, p.avatar]));
}

/** Signed avatar URLs for the people in `entries`; an id missing from the result shows initials. */
export function useAvatarUrls(entries: AvatarEntry[]): AvatarUrls {
  const viewerId = useAuthStore((s) => s.session?.user.id ?? null);
  const pairs = avatarPairs(entries);
  const query = useQuery({
    queryKey: avatarQueryKeys.set(viewerId ?? '', pairs),
    queryFn: () => fetchAvatarUrls(pairs.map((p) => p.slice(0, p.indexOf(':')))),
    enabled: viewerId !== null && pairs.length > 0,
    staleTime: STALE_MS,
    // A new page adds people: keep the photos already shown while it signs.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === viewerId ? previous : undefined),
  });
  return query.data ?? {};
}
