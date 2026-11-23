// A line for the day (0175): one optional sentence the owner writes on their jar. The jars trigger trims it and
// stores a blank line as null; RLS lets only the owner write it, and whoever may read the jar reads it.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/** The most characters a line may have; the database refuses more (0175). */
export const JAR_LINE_MAX = 80;

/** Saves the owner's line; an empty one clears it. Returns the line as the server stored it. */
export async function saveJarLine(
  client: Pick<SupabaseClient<Database>, 'from'>,
  jarId: string,
  line: string,
): Promise<string | null> {
  // Line breaks would be refused; the field is one line, but a paste can carry them.
  const clean = line.replace(/\s+/g, ' ').trim();
  const { data, error } = await client
    .from('jars')
    .update({ line: clean === '' ? null : clean })
    .eq('id', jarId)
    .select('line');
  if (error) throw new Error(error.message);
  if (!data?.[0]) throw new Error('jar not found');
  return data[0].line;
}

/** Saving the line, then re-reading Today, the day page and the jar page that show it. */
export function useSaveJarLine(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: (input: { jarId: string; line: string }) => saveJarLine(getSupabase(), input.jarId, input.line),
    onSuccess: () => {
      if (userId === null) return;
      void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
      void queryClient.invalidateQueries({ queryKey: ['day', userId] });
      void queryClient.invalidateQueries({ queryKey: ['jarPage', userId] });
    },
  });
}
