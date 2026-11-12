import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/lib/authStore';
import { setStoreForTesting, type Store } from '@/lib/store/store';

import { useBuyPack } from '../usePackPreview';

// Buying a pack (FR-STK-07): the store sells it, then fn:store-sync makes owned_packs match. A cancelled
// store sheet never calls the server; the dev store's product id is passed on for the local server.

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } }),
}));

function store(result: Awaited<ReturnType<Store['purchase']>>): Store {
  return { products: jest.fn(), purchase: jest.fn().mockResolvedValue(result), restore: jest.fn() };
}

async function buy(productId: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useBuyPack(), { wrapper });
  let outcome: string | undefined;
  await act(async () => {
    outcome = await hook.result.current.mutateAsync(productId).catch((e: Error) => `error: ${e.message}`);
  });
  return outcome;
}

beforeEach(() => {
  mockInvoke.mockReset();
  useAuthStore.setState({ session: { user: { id: 'u1' } } as never, status: 'signedIn' });
});
afterEach(() => setStoreForTesting(undefined));

it('syncs after a store purchase, passing the dev product id only when the dev store set one', async () => {
  mockInvoke.mockResolvedValue({ data: { data: { granted: ['pinoy-life'], revoked: [] } }, error: null });
  const real = store({ status: 'bought' });
  setStoreForTesting(real);
  expect(await buy('me.pickld.pack.pinoy_life')).toBe('bought');
  expect(real.purchase).toHaveBeenCalledWith('me.pickld.pack.pinoy_life', 'u1');
  expect(mockInvoke).toHaveBeenLastCalledWith('store-sync', { body: {} });

  setStoreForTesting(store({ status: 'bought', devProductId: 'me.pickld.pack.barkada' }));
  await buy('me.pickld.pack.barkada');
  expect(mockInvoke).toHaveBeenLastCalledWith('store-sync', { body: { devProductId: 'me.pickld.pack.barkada' } });
});

it('does nothing on the server when the user cancels, and fails when the sync fails', async () => {
  setStoreForTesting(store({ status: 'cancelled' }));
  expect(await buy('me.pickld.pack.pinoy_life')).toBe('cancelled');
  expect(mockInvoke).not.toHaveBeenCalled();

  setStoreForTesting(store({ status: 'bought' }));
  mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });
  expect(await buy('me.pickld.pack.pinoy_life')).toBe('error: offline');
});
