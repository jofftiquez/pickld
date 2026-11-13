import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { env } from './env';

/** A Supabase client acting as the signed-in moderator; the session lives in cookies (@supabase/ssr). */
export async function supabase() {
  const jar = await cookies();
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // Server Components can't set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/** Same check as public.is_moderator(): the role in app_metadata, which only the service role can set. */
export function isModerator(user: User | null): boolean {
  return user?.app_metadata?.role === 'moderator';
}
