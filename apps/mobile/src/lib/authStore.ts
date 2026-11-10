import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** Set when the client couldn't start (e.g. missing env); the app keeps working offline. */
  error: string | null;
  setSession: (session: Session | null) => void;
  setError: (error: string) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  error: null,
  setSession: (session) => set({ session, status: session ? 'signedIn' : 'signedOut', error: null }),
  setError: (error) => set({ session: null, status: 'signedOut', error }),
}));
