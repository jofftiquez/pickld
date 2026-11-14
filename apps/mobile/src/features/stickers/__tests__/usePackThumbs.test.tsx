import { dehydrate, hydrate, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useAuthStore } from '@/lib/authStore';

import { usePackThumbs, withThumb } from '../usePackThumbs';

// Thumbs up on packs (FR-STK-07, 0110): a tap changes the count and the thumb at once, a failed request puts
// them back, and the counts are read again once a pack has nothing in flight.

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const PACK = 'a1100000-0000-4000-8000-000000000001';

describe('withThumb', () => {
  const thumbs = { [PACK]: { thumbs: 3, mine: false } };
  it('adds and removes the viewer’s thumb once, never below zero', () => {
    expect(withThumb(thumbs, PACK, true)[PACK]).toEqual({ thumbs: 4, mine: true });
    expect(withThumb(thumbs, PACK, false)).toBe(thumbs);
    expect(withThumb({ [PACK]: { thumbs: 0, mine: true } }, PACK, false)[PACK]).toEqual({ thumbs: 0, mine: false });
    expect(withThumb(thumbs, 'other', true)).toBe(thumbs);
  });
});

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

async function setup(client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => usePackThumbs(), { wrapper });
  await waitFor(() => expect(hook.result.current.thumbs).toBeDefined());
  return hook;
}

beforeEach(() => {
  mockRpc.mockReset();
  useAuthStore.setState({ session: { user: { id: 'u1' } } as never, status: 'signedIn' });
});

it('shows the thumb at once and sends it to the server', async () => {
  let server = { thumbs: 3, mine: false };
  let release: () => void = () => {};
  mockRpc.mockImplementation(async (fn: string, args?: { p_on: boolean }) => {
    if (fn === 'pack_thumbs') return { data: [{ pack_id: PACK, ...server }], error: null };
    await new Promise<void>((r) => (release = r));
    server = { thumbs: args!.p_on ? 4 : 3, mine: args!.p_on };
    return { data: { thumbed: args!.p_on, thumbs: server.thumbs }, error: null };
  });
  const hook = await setup();
  await act(async () => hook.result.current.toggle(PACK));
  // The server hasn't answered yet (release is still pending), so this is the optimistic change.
  await waitFor(() => expect(hook.result.current.thumbs?.get(PACK)).toEqual({ thumbs: 4, mine: true }));
  expect(mockRpc).toHaveBeenCalledWith('set_pack_thumb', { p_pack: PACK, p_on: true });
  await act(async () => release());
  await waitFor(() => expect(mockRpc.mock.calls.filter(([fn]) => fn === 'pack_thumbs')).toHaveLength(2));
  expect(hook.result.current.thumbs?.get(PACK)).toEqual({ thumbs: 4, mine: true });
});

it('puts the count back when the request fails', async () => {
  mockRpc.mockImplementation(async (fn: string) =>
    fn === 'pack_thumbs'
      ? { data: [{ pack_id: PACK, thumbs: 2, mine: true }], error: null }
      : { data: null, error: { message: 'offline' } },
  );
  const hook = await setup();
  await act(async () => hook.result.current.toggle(PACK));
  await waitFor(() => expect(hook.result.current.thumbs?.get(PACK)).toEqual({ thumbs: 2, mine: true }));
  expect(mockRpc).toHaveBeenCalledWith('set_pack_thumb', { p_pack: PACK, p_on: false });
});

it('still reads the counts after a restart restores the saved cache', async () => {
  mockRpc.mockResolvedValue({ data: [{ pack_id: PACK, thumbs: 5, mine: true }], error: null });
  const first = newClient();
  const before = await setup(first);
  await waitFor(() => expect(before.result.current.thumbs?.get(PACK)).toEqual({ thumbs: 5, mine: true }));
  // The app saves queries as JSON and restores them on launch (queryClient.ts); the server is unreachable now.
  const restored = newClient();
  hydrate(restored, JSON.parse(JSON.stringify(dehydrate(first))));
  mockRpc.mockReturnValue(new Promise(() => {}));
  const after = await setup(restored);
  expect(after.result.current.thumbs?.get(PACK)).toEqual({ thumbs: 5, mine: true });
});
