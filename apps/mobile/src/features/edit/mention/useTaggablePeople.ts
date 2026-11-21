// Who the signed-in person may tag (0172 taggable_people): mutual readers, best username match first. Used by the
// Mention tool and the caption's @ suggestions.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { fetchAvatarUrls } from '@/lib/avatars';
import { getSupabase } from '@/lib/supabase';

const SEARCH_DELAY_MS = 250;

const row = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
});

export type TaggablePerson = { id: string; username: string; displayName: string; avatarUrl: string | null };

export async function fetchTaggablePeople(query: string, limit = 20): Promise<TaggablePerson[]> {
  const { data, error } = await getSupabase().rpc('taggable_people', { p_query: query, p_limit: limit });
  if (error) throw new Error(error.message);
  const people = z.array(row).parse(data);
  const withPhoto = people.filter((p) => p.avatar_path !== null).map((p) => p.id);
  // Signing avatars can fail; the list still shows, on initials.
  const avatars = await fetchAvatarUrls(withPhoto).catch(() => ({}) as Record<string, string | null>);
  return people.map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    avatarUrl: avatars[p.id] ?? null,
  }));
}

/** Mutual readers matching `query` (typed text, searched a moment after typing stops). */
export function useTaggablePeople(query: string, { enabled = true, limit = 20 } = {}) {
  const [term, setTerm] = useState(query.trim());
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  return useQuery({
    queryKey: ['taggable', term, limit],
    queryFn: () => fetchTaggablePeople(term, limit),
    enabled,
    staleTime: 60_000,
  });
}
