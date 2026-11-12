import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { readEnv } from './env';
import { secureSessionStorage } from './secureSessionStorage';

let client: SupabaseClient<Database> | undefined;

// Created on first use so the app can still boot (offline, no .env) and report a clear error.
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const env = readEnv();
    client = createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        storage: secureSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Email links and Apple/Google come back as pickld://auth/callback?code=… (src/lib/auth.ts).
        flowType: 'pkce',
      },
    });
  }
  return client;
}
