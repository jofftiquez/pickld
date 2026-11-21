// Tags on moments (0172): who a viewer may see tagged, the caption split into words and @mentions, and the
// tagged person's Remove tag. The database decides who is tagged and who may see it (moment_tags RLS); the app
// only links what it is shown.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';

export type MomentTag = { userId: string; username: string };

const tagRow = z.object({
  moment_id: z.string(),
  tagged_id: z.string(),
  profile: z.object({ username: z.string() }).nullable(),
});

/** The tags the viewer may see on these moments, by moment id. */
export async function fetchMomentTags(momentIds: readonly string[]): Promise<Record<string, MomentTag[]>> {
  if (momentIds.length === 0) return {};
  const { data, error } = await getSupabase()
    .from('moment_tags')
    .select('moment_id, tagged_id, profile:profiles!moment_tags_tagged_id_fkey(username)')
    .in('moment_id', [...momentIds]);
  if (error) throw new Error(error.message);
  const tags: Record<string, MomentTag[]> = {};
  for (const row of z.array(tagRow).parse(data)) {
    // No profile: hidden from the viewer (not active, or blocked); the tag stays plain text.
    if (!row.profile) continue;
    (tags[row.moment_id] ??= []).push({ userId: row.tagged_id, username: row.profile.username });
  }
  return tags;
}

export function useMomentTags(momentIds: readonly string[]) {
  const ids = [...momentIds].sort();
  return useQuery({
    queryKey: ['moment-tags', ids],
    queryFn: () => fetchMomentTags(ids),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
}

/** Takes the signed-in person's tag off a moment: the sticker goes for everyone, and the author isn't told. */
export function useRemoveTag(onDone?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (momentId: string) => {
      const { error } = await getSupabase().rpc('remove_moment_tag', { p_moment: momentId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['moment-tags'] });
      void client.invalidateQueries({ queryKey: ['jarPage'] });
      onDone?.();
    },
  });
}

/** A caption as plain words and @mentions; a mention carries the tag when the viewer may follow it. */
export type CaptionPart = { kind: 'text'; text: string } | { kind: 'mention'; text: string; tag: MomentTag | null };

// As caption_mentioned (0172): an @ not stuck to a word, then 3 to 20 letters, digits, dots and underscores. A dot
// that ends the name (a full stop) isn't part of it.
const MENTION = /(^|[^A-Za-z0-9._@])@([A-Za-z0-9._]{3,20})/g;

export function captionParts(caption: string, tags: readonly MomentTag[]): CaptionPart[] {
  const byName = new Map(tags.map((t) => [t.username.toLowerCase(), t]));
  const parts: CaptionPart[] = [];
  let at = 0;
  for (const m of caption.matchAll(MENTION)) {
    const lead = m[1] ?? '';
    let name = m[2] ?? '';
    let tag = byName.get(name.toLowerCase()) ?? null;
    if (!tag && name.endsWith('.')) {
      const trimmed = name.replace(/\.+$/, '');
      const found = byName.get(trimmed.toLowerCase());
      if (found) {
        name = trimmed;
        tag = found;
      }
    }
    const start = (m.index ?? 0) + lead.length;
    if (start > at) parts.push({ kind: 'text', text: caption.slice(at, start) });
    parts.push({ kind: 'mention', text: `@${name}`, tag });
    at = start + 1 + name.length;
  }
  if (at < caption.length) parts.push({ kind: 'text', text: caption.slice(at) });
  return parts;
}

/** The @word being typed at the end of `text`, without its @; null when the end isn't an @mention. */
export function typingMention(text: string): string | null {
  const m = /(?:^|[^A-Za-z0-9._@])@([A-Za-z0-9._]{0,20})$/.exec(text);
  return m ? (m[1] ?? '') : null;
}

/** `text` with the @word being typed at its end replaced by `@username `. */
export function completeMention(text: string, username: string): string {
  const partial = typingMention(text);
  if (partial === null) return text;
  return `${text.slice(0, text.length - partial.length - 1)}@${username} `;
}
