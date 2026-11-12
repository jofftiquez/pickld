import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import Index from '../../../../app/index';
import { useAuthStore } from '@/lib/authStore';

const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItem: async (k: string) => mockDisk.get(k) ?? null },
}));
const mockProfileLookup = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: () => mockProfileLookup(id) }) }),
    }),
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}
const routes = {
  index: Index,
  welcome: () => <Text>Welcome</Text>,
  'setup/about': () => <Text>About you</Text>,
  'setup/day': () => <Text>Your day</Text>,
  '(tabs)/today': () => <Text>Today</Text>,
};
const signIn = () => useAuthStore.getState().setSession({ user: { id: 'u-1' } } as Session);

describe('where the app opens', () => {
  beforeEach(() => {
    mockProfileLookup.mockReset();
    mockDisk.clear();
  });

  it('signed out → Welcome', async () => {
    useAuthStore.getState().setSession(null);
    await renderRouter(routes, { initialUrl: '/', wrapper });
    expect(await screen.findByText('Welcome')).toBeTruthy();
    expect(screen).toHavePathname('/welcome');
  });

  it('a new account without a profile → About you', async () => {
    signIn();
    mockProfileLookup.mockResolvedValue({ data: null, error: null });
    await renderRouter(routes, { initialUrl: '/', wrapper });
    expect(await screen.findByText('About you')).toBeTruthy();
    expect(mockProfileLookup).toHaveBeenCalledWith('u-1');
  });

  it('a returning user → Today', async () => {
    signIn();
    mockProfileLookup.mockResolvedValue({ data: { id: 'u-1' }, error: null });
    await renderRouter(routes, { initialUrl: '/', wrapper });
    expect(await screen.findByText('Today')).toBeTruthy();
  });

  it('setup left unfinished on this phone → that step (FR-ONB-09)', async () => {
    signIn();
    mockDisk.set('setupStep:u-1', '/setup/day');
    mockProfileLookup.mockResolvedValue({ data: { id: 'u-1' }, error: null });
    await renderRouter(routes, { initialUrl: '/', wrapper });
    expect(await screen.findByText('Your day')).toBeTruthy();
  });

  it('can’t reach the server → Today (a stored session is almost always a returning user)', async () => {
    signIn();
    mockProfileLookup.mockRejectedValue(new Error('Network request failed'));
    await renderRouter(routes, { initialUrl: '/', wrapper });
    expect(await screen.findByText('Today', {}, { timeout: 4000 })).toBeTruthy();
  });
});
