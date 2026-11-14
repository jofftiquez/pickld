// Explore, now Discover (M6-08, D-100; FR-EXP-01, FR-EXP-02): the rows the 0031 RPCs return and the pure rules
// that turn them into Suggested authors. Friends of friends come from `suggested_authors()`, contact matches from
// fn:contacts-match. Today's full jars (`full_jars_today`) only give a suggestion its "8/8 today" reason; the
// jars themselves are in Discover's Jars list (D-100).
import { z } from 'zod';

export const searchRow = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  is_reading: z.boolean(),
});

export const suggestedRow = z.object({
  id: z.string(),
  username: z.string(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  mutual_count: z.number(),
});

export const fullJarRow = z.object({
  jar_id: z.string(),
  user_id: z.string(),
});

export type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  reading: boolean;
};

/** Why a person is suggested; the card's subtitle. */
export type SuggestionReason = { kind: 'fullToday' } | { kind: 'friends'; count: number } | { kind: 'contact' };

export type Suggestion = Person & { reason: SuggestionReason };

export type Explore = { suggestions: Suggestion[] };

export type ContactMatch = Person;
export type FriendOfFriend = Person & { mutualCount: number };

/**
 * Suggested authors: contact matches first (people you know), then friends of friends by most mutual readers.
 * Each person once, and never someone the viewer already reads. Someone with a full jar today says so, since
 * that's the most inviting reason to read them.
 */
export function mergeSuggestions(
  contacts: ContactMatch[],
  friends: FriendOfFriend[],
  fullTodayIds: ReadonlySet<string>,
  max = 10,
): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  const add = (p: Person, fallback: SuggestionReason) => {
    if (p.reading || seen.has(p.id) || out.length >= max) return;
    seen.add(p.id);
    out.push({ ...p, reason: fullTodayIds.has(p.id) ? { kind: 'fullToday' } : fallback });
  };
  for (const c of contacts) add(c, { kind: 'contact' });
  for (const f of friends) add(f, { kind: 'friends', count: f.mutualCount });
  return out;
}

/** The text sent to search: trimmed; under two characters (after an @) searches nothing. */
export function searchTerm(query: string): string | null {
  const trimmed = query.trim();
  return trimmed.replace(/^@/, '').length >= 2 ? trimmed : null;
}
