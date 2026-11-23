import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { momentsQueryKeys } from '@/features/moments/useMomentsFeed';
import { useAuthStore } from '@/lib/authStore';

import { feedQueryKeys } from '../useFeed';
import { useJarsUnread, useMomentsUnread, useSeenBeforeVisit } from '../useTabUnread';

// The dots read the timelines' own cache entries: with those filled, nothing is fetched.
const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a), functions: { invoke: jest.fn() } }),
}));

const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));

const me = 'u1';
const friend = 'u2';

const pages = <T,>(key: 'moments' | 'jars', rows: T[]) => ({
  pages: [{ [key]: rows, nextCursor: null }],
  pageParams: [null],
});
const moment = (author_id: string, added_at: string) => ({ author_id, added_at });
const jar = (author_id: string, feed_at: string, published_at: string | null = feed_at) => ({
  author_id,
  feed_at,
  published_at,
});

/** Lets the kv-store read and write (promises) and the re-renders they cause settle. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** Changes the timeline's cache, as a refetch would, and lets the dot catch up. */
async function update(key: readonly unknown[], data: unknown) {
  await act(async () => {
    client.setQueryData(key, data);
  });
  await settle();
}

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockDisk.clear();
  mockRpc.mockReset();
  client = new QueryClient();
  useAuthStore.setState({ session: { user: { id: me } } as never, status: 'signedIn' });
});
afterEach(() => client.clear());

describe('Moments dot', () => {
  it('sets a quiet baseline from other people’s moments, lights for a friend’s new one, never for my own, and clears while open', async () => {
    const key = momentsQueryKeys.feed(me);
    client.setQueryData(
      key,
      pages('moments', [moment(me, '2026-11-14T12:00:00Z'), moment(friend, '2026-11-14T10:00:00Z')]),
    );
    const hook = await renderHook(({ focused }: { focused: boolean }) => useMomentsUnread(focused), {
      wrapper,
      initialProps: { focused: false },
    });
    await settle();
    // My own newer moment is not the baseline, and there is no dot on first run.
    expect(mockDisk.get('unreadSeen:moments:u1')).toBe('2026-11-14T10:00:00Z');
    expect(hook.result.current).toBe(false);

    // I post again: still nothing.
    await update(key, pages('moments', [moment(me, '2026-11-14T13:00:00Z'), moment(friend, '2026-11-14T10:00:00Z')]));
    expect(hook.result.current).toBe(false);

    // A friend's moment arrives (written "+00:00" with micros, as Postgres does).
    await update(
      key,
      pages('moments', [moment(friend, '2026-11-14T10:00:00.250000+00:00'), moment(me, '2026-11-14T13:00:00Z')]),
    );
    expect(hook.result.current).toBe(true);

    // Opening the tab clears it and stores what it showed; leaving keeps it cleared.
    await hook.rerender({ focused: true });
    await settle();
    expect(hook.result.current).toBe(false);
    expect(mockDisk.get('unreadSeen:moments:u1')).toBe('2026-11-14T10:00:00.250000+00:00');
    await hook.rerender({ focused: false });
    await settle();
    expect(hook.result.current).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe('Seen time for the caught-up line', () => {
  it('keeps the seen time from before the visit while the open tab moves the stored one on, and takes the new one next visit', async () => {
    const key = momentsQueryKeys.feed(me);
    mockDisk.set('unreadSeen:moments:u1', '2026-11-14T08:00:00Z');
    client.setQueryData(key, pages('moments', [moment(friend, '2026-11-14T10:00:00Z')]));
    const hook = await renderHook(
      ({ focused }: { focused: boolean }) => ({
        dot: useMomentsUnread(focused),
        seenAt: useSeenBeforeVisit('moments'),
      }),
      { wrapper, initialProps: { focused: true } },
    );
    await settle();
    // The open tab stored what it shows, but the line still marks where the last visit ended.
    expect(mockDisk.get('unreadSeen:moments:u1')).toBe('2026-11-14T10:00:00Z');
    expect(hook.result.current.seenAt).toBe('2026-11-14T08:00:00Z');

    // More arrives while open: the line stays put.
    await update(
      key,
      pages('moments', [moment(friend, '2026-11-14T11:00:00Z'), moment(friend, '2026-11-14T10:00:00Z')]),
    );
    expect(mockDisk.get('unreadSeen:moments:u1')).toBe('2026-11-14T11:00:00Z');
    expect(hook.result.current.seenAt).toBe('2026-11-14T08:00:00Z');

    // Leave and come back: the next visit starts from what was seen.
    await hook.rerender({ focused: false });
    await settle();
    await hook.rerender({ focused: true });
    await settle();
    expect(hook.result.current.seenAt).toBe('2026-11-14T11:00:00Z');
  });
});

describe('Jars dot', () => {
  it('lights for a friend’s published jar only, under its own key', async () => {
    const key = feedQueryKeys.feed(me);
    mockDisk.set('unreadSeen:jars:u1', '2026-11-14T08:00:00Z');
    client.setQueryData(key, pages('jars', [jar(me, '2026-11-14T12:00:00Z'), jar(friend, '2026-11-14T07:00:00Z')]));
    const hook = await renderHook(() => useJarsUnread(false), { wrapper });
    await settle();
    expect(hook.result.current).toBe(false);

    await update(key, pages('jars', [jar(friend, '2026-11-14T09:00:00Z', null), jar(me, '2026-11-14T12:00:00Z')]));
    expect(hook.result.current).toBe(false);

    await update(key, pages('jars', [jar(friend, '2026-11-14T09:00:00Z')]));
    expect(hook.result.current).toBe(true);
    // The Moments dot keeps its own seen time.
    expect(mockDisk.has('unreadSeen:moments:u1')).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
