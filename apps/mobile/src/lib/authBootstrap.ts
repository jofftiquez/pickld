import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { useAuthStore } from './authStore';

type AuthClient = Pick<SupabaseClient, 'auth'>;

// Restores the stored session, follows auth changes and refreshes tokens only while the app is active.
// Returns a cleanup function.
export function startAuth(getClient: () => AuthClient): () => void {
  const { setSession, setError } = useAuthStore.getState();
  let client: AuthClient;
  try {
    client = getClient();
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
    return () => {};
  }

  void client.auth.getSession().then(({ data, error }) => {
    if (error) setError(error.message);
    else setSession(data.session);
  });

  const { data } = client.auth.onAuthStateChange((_event, session) => setSession(session));

  if (AppState.currentState === 'active') void client.auth.startAutoRefresh();
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void client.auth.startAutoRefresh();
    else void client.auth.stopAutoRefresh();
  });

  return () => {
    data.subscription.unsubscribe();
    appState.remove();
  };
}
