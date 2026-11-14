import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  const thumbs = new Map([[PACK, { thumbs: 3, mine: false }]]);
  it('adds and removes the viewer’s thumb once, never below zero', () => {
    expect(withThumb(thumbs, PACK, true).get(PACK)).toEqual({ thumbs: 4, mine: true });
    expect(withThumb(thumbs, PACK, false)).toBe(thumbs);
    expect(withThumb(new Map([[PACK, { thumbs: 0, mine: true }]]), PACK, false).get(PACK)).toEqual({
      thumbs: 0,
      mine: false,
    });
    expect(withThumb(thumbs, 'other', true)).toBe(thumbs);
  });
});

async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
