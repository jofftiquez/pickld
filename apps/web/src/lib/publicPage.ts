import { cache } from 'react';
import { z } from 'zod';

import { slots } from '@/theme/tokens';

import { env } from './env';

// Data for the shared-link pages, from fn:public-page (M4-13). The function asks Postgres what is public
// (public_profile / public_jar, 0025) and signs only those photo keys; this site never sees a bucket key
// or a signing secret, and never a service key (rule 2).

const author = z.object({
  id: z.uuid(),
  username: z.string(),
  display_name: z.string(),
  bio: z.string().nullable(),
  lid_color: z.string(),
  reader_count: z.number(),
  author_count: z.number(),
  avatar: z.url().nullable(),
  cover: z.url().nullable(),
});
export type PublicAuthor = z.infer<typeof author>;

const moment = z.object({
  id: z.uuid(),
  slot: z.enum(slots),
  caption: z.string().nullable(),
  added_at: z.string(),
  is_backfilled: z.boolean(),
  edits: z.unknown(),
  full: z.url().nullable(),
  thumb: z.url().nullable(),
});
export type PublicMoment = z.infer<typeof moment>;

const jarSummary = z.object({
  id: z.uuid(),
  local_date: z.string(),
  visible_count: z.number(),
  moments: z.array(moment),
});
export type PublicJarSummary = z.infer<typeof jarSummary>;

const profilePage = z.object({
  kind: z.literal('profile'),
  assetBase: z.url(),
  profile: author,
  jars: z.array(jarSummary),
});
export type ProfilePage = z.infer<typeof profilePage>;

const jarPage = z.object({
  kind: z.literal('jar'),
  assetBase: z.url(),
  id: z.uuid(),
  local_date: z.string(),
  readers_only: z.boolean(),
  visible_count: z.number(),
  author,
  moments: z.array(moment).optional(),
  /** The jar's cover among its Everyone moments (0069, D-56); absent on a Readers teaser. */
  cover_moment_id: z.uuid().nullish(),
});
export type JarPage = z.infer<typeof jarPage>;

async function call(body: { username: string } | { jarId: string }): Promise<unknown | null> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/public-page`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store', // photo URLs expire after 15 minutes
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`public-page answered ${res.status}`);
  return ((await res.json()) as { data: unknown }).data;
}

export const USERNAME = /^[A-Za-z0-9._]{3,20}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cached per request, so generateMetadata and the page share one call. */
export const getProfile = cache(async (username: string): Promise<ProfilePage | null> => {
  if (!USERNAME.test(username)) return null;
  const data = await call({ username });
  return data === null ? null : profilePage.parse(data);
});

export const getJar = cache(async (id: string): Promise<JarPage | null> => {
  if (!UUID.test(id)) return null;
  const data = await call({ jarId: id.toLowerCase() });
  return data === null ? null : jarPage.parse(data);
});
