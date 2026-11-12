// Live username availability for Edit profile (M3-15; FR-ACC-03): once typing has paused for 300 ms the
// server's username_available (0017) answers, so the verdict shows well within 500 ms of the last key.
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { getSupabase } from '@/lib/supabase';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

import { localUsernameStatus, type UsernameStatus } from './editProfileModel';

export const USERNAME_DEBOUNCE_MS = 300;

const verdict = z.enum(['available', 'taken', 'reserved', 'invalid']);

export async function checkUsername(candidate: string): Promise<z.infer<typeof verdict>> {
  const { data, error } = await getSupabase().rpc('username_available', { candidate });
  if (error) throw new Error(error.message);
  return verdict.parse(data);
}

/** The status for `candidate`; `checking` while typing or while the server answers. */
export function useUsernameAvailability(candidate: string, current: string): UsernameStatus {
  const trimmed = candidate.trim();
  const settled = useDebouncedValue(trimmed, USERNAME_DEBOUNCE_MS);
  const local = localUsernameStatus(trimmed, current);
  const query = useQuery({
    queryKey: ['usernameAvailable', settled.toLowerCase()],
    queryFn: () => checkUsername(settled),
    enabled: local === null && settled === trimmed,
    staleTime: 10_000,
  });
  if (local !== null) return local;
  if (settled !== trimmed || query.data === undefined) return 'checking';
  return query.data;
}
