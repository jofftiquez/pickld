// Data for Discover's people (M6-08, D-100; FR-EXP-01, FR-EXP-02): people search and Suggested authors from the
// 0031 RPCs, with signed avatar URLs from fn:photo-urls (Discover's lists are in useDiscover.ts). Contact matches join the suggestions only when
// the phone already allows contacts (Find friends asked); Explore never asks for the permission itself.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPermissionsAsync } from 'expo-contacts';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { hashAddressBook, matchContacts } from '@/features/onboarding/findFriends';
import { setReading } from '@/features/profile/useFollow';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';

import {
  fullJarRow,
  mergeSuggestions,
  searchRow,
  searchTerm,
  suggestedRow,
  type ContactMatch,
  type Explore,
  type Person,
} from './explore';
import { removeDiscoverAuthor } from './useDiscover';

const SEARCH_DELAY_MS = 250;
const MAX_BATCH = 100; // fn:photo-urls

const urlsResponse = z.object({
  data: z.object({ profiles: z.array(z.object({ id: z.string(), avatar: z.string().nullable() })).optional() }),
});

/** Signed avatars; a failure leaves them on initials. */
async function signedAvatars(profileIds: string[]): Promise<Map<string, string | null>> {
  if (profileIds.length === 0) return new Map();
  const { data, error } = await getSupabase().functions.invoke<unknown>('photo-urls', {
    body: { profileIds: profileIds.slice(0, MAX_BATCH) },
  });
  const parsed = urlsResponse.safeParse(data);
  if (error || !parsed.success) return new Map();
  return new Map((parsed.data.data.profiles ?? []).map((p) => [p.id, p.avatar]));
}

/** Contact matches when contacts are already allowed; nothing (and no prompt) otherwise. */
async function contactSuggestions(): Promise<ContactMatch[]> {
  try {
    const permission = await getPermissionsAsync();
    if (!permission.granted) return [];
    const hashes = await hashAddressBook();
    return hashes === 'denied' ? [] : await matchContacts(hashes);
  } catch {
    return [];
  }
}

export async function fetchExplore(): Promise<Explore> {
  const supabase = getSupabase();
  const [friends, full, contacts] = await Promise.all([
    supabase.rpc('suggested_authors', { max_count: 10 }),
    supabase.rpc('full_jars_today', { max_count: 12 }),
    contactSuggestions(),
  ]);
  const error = friends.error ?? full.error;
  if (error) throw new Error(error.message);
  const fof = z.array(suggestedRow).parse(friends.data);
  const jars = z.array(fullJarRow).parse(full.data);

  const avatars = await signedAvatars(fof.filter((f) => f.avatar_path !== null).map((f) => f.id));
  const suggestions = mergeSuggestions(
    contacts,
    fof.map((f) => ({
      id: f.id,
      username: f.username,
      displayName: f.display_name,
      avatarUrl: avatars.get(f.id) ?? null,
      reading: false,
      mutualCount: f.mutual_count,
    })),
    new Set(jars.map((j) => j.user_id)),
  );
  return { suggestions };
}

export async function searchPeople(term: string): Promise<Person[]> {
  const { data, error } = await getSupabase().rpc('search_people', { query: term, max_count: 20 });
  if (error) throw new Error(error.message);
  const rows = z.array(searchRow).parse(data);
  const avatars = await signedAvatars(rows.filter((r) => r.avatar_path !== null).map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: avatars.get(r.id) ?? null,
    reading: r.is_reading,
  }));
}

export const exploreKeys = {
  explore: (userId: string) => ['explore', userId] as const,
  search: (userId: string, term: string) => ['search', userId, term] as const,
};

export function useExplore() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: exploreKeys.explore(userId ?? ''),
    queryFn: fetchExplore,
    enabled: userId !== null,
  });
}

/** Results for what's typed, searched once typing pauses; `term` is null while there's nothing to search. */
export function usePeopleSearch(query: string) {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);
  // Clearing the field ends the search at once; new text waits for typing to pause.
  const term = searchTerm(query) === null ? null : searchTerm(settled);
  const result = useQuery({
    queryKey: exploreKeys.search(userId ?? '', term ?? ''),
    queryFn: () => searchPeople(term ?? ''),
    enabled: userId !== null && term !== null,
  });
  return { term, ...result };
}

/**
 * Be a reader / Reading from Discover. Search results flip at once (optimistic), and an author read from a
 * Discover card leaves both lists at once (D-102); a suggestion leaves its row once the server agrees. Profiles,
 * follow lists, the timelines and Discover are read again afterwards, like Read anywhere else.
 */
export function useExploreReading() {
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ authorId, reading }: { authorId: string; reading: boolean }) =>
      setReading(userId ?? '', authorId, reading),
    onMutate: async ({ authorId, reading }) => {
      if (reading) await removeDiscoverAuthor(queryClient, authorId);
      await queryClient.cancelQueries({ queryKey: ['search'] });
      const lists = queryClient.getQueriesData<Person[]>({ queryKey: ['search'] });
      for (const [key, rows] of lists) {
        if (rows)
          queryClient.setQueryData(
            key,
            rows.map((r) => (r.id === authorId ? { ...r, reading } : r)),
          );
      }
      return { lists };
    },
    onError: (_error, _vars, context) => {
      for (const [key, rows] of context?.lists ?? []) queryClient.setQueryData(key, rows);
    },
    onSettled: () =>
      Promise.all(
        ['explore', 'search', 'profile', 'followList', 'feed', 'feedAuthors', 'momentsFeed', 'discover'].map((k) =>
          queryClient.invalidateQueries({ queryKey: [k] }),
        ),
      ),
  });
  return {
    setReading: (authorId: string, reading: boolean) => {
      if (userId !== null) mutation.mutate({ authorId, reading });
    },
    busy: mutation.isPending,
  };
}
