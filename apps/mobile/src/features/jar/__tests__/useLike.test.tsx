import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { JarPageData } from '../jarPage';
import { jarPageQueryKeys } from '../useJarPage';
import { useLike } from '../useLike';

const VIEWER = 'viewer-id';
const JAR = 'jar-1';

// A fake reactions table: each request waits until the test releases it, so the test decides when the
// server answers and can check what the screen shows meanwhile.
type Request = { op: 'like' | 'unlike'; target: string; release: (error?: string) => void };
const mockServer = { requests: [] as Request[], liked: new Set<string>() };

jest.mock('@/lib/supabase', () => {
  const answer = (op: 'like' | 'unlike', target: string) =>
    new Promise<{ error: { message: string } | null }>((resolve) => {
      mockServer.requests.push({
        op,
        target,
        release: (error) => {
          if (!error) {
            if (op === 'like') mockServer.liked.add(target);
            else mockServer.liked.delete(target);
          }
          resolve({ error: error ? { message: error } : null });
        },
      });
    });
  const client = {
    from: () => ({
      upsert: (row: { target: string; target_id: string }) => answer('like', `${row.target}:${row.target_id}`),
      delete: () => {
        const f: Record<string, string> = {};
        const b = {
          eq: (k: string, v: string) => {
            f[k] = v;
            return Object.keys(f).length === 3 ? answer('unlike', `${f.target}:${f.target_id}`) : b;
          },
        };
        return b;
      },
    }),
  };
  return { getSupabase: () => client };
});

function page(): JarPageData {
  return {
    jar: {
      id: JAR,
      user_id: 'author-id',
      local_date: '2026-11-08',
      tz: 'Asia/Manila',
      moment_count: 1,
      visible_count: 1,
      like_count: 10,
      comment_count: 0,
    },
    author: { username: 'dale', display_name: 'Dale Santos' },
    moments: [
      {
        id: 'm1',
        slot: 'ootd',
        status: 'live',
        is_private: false,
        is_backfilled: false,
        caption: null,
        captured_at: null,
        added_at: '2026-11-08T01:00:00Z',
        edits: {},
        like_count: 2,
        thumbUrl: null,
        fullUrl: null,
      },
    ],
    viewerId: VIEWER,
    liked: { jar: false, moments: [] },
  };
}

async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  const key = jarPageQueryKeys.jar(VIEWER, JAR);
  client.setQueryData(key, page());
  // Keep the seeded page: the refetch after the last request would otherwise call the real fetcher.
  client.setQueryDefaults(key, { queryFn: () => client.getQueryData(key) ?? null });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useLike(VIEWER, JAR), { wrapper });
  const current = () => client.getQueryData<JarPageData>(key);
  return { result, current };
}

beforeEach(() => {
  mockServer.requests = [];
  mockServer.liked = new Set();
});

describe('useLike', () => {
  it('shows the like and the new count before the server answers', async () => {
    const { result, current } = await setup();
    await act(async () => result.current.toggle({ kind: 'jar' }));
    expect(current()?.jar.like_count).toBe(11);
    expect(current()?.liked?.jar).toBe(true);
    await waitFor(() => expect(mockServer.requests).toHaveLength(1));
    expect(mockServer.requests[0]).toMatchObject({ op: 'like', target: `jar:${JAR}` });
    await act(async () => mockServer.requests[0]?.release());
    expect(mockServer.liked.has(`jar:${JAR}`)).toBe(true);
  });

  it('undoes the change when the server refuses it', async () => {
    const { result, current } = await setup();
    await act(async () => result.current.toggle({ kind: 'moment', id: 'm1' }));
    expect(current()?.moments[0]?.like_count).toBe(3);
    await waitFor(() => expect(mockServer.requests).toHaveLength(1));
    await act(async () => mockServer.requests[0]?.release('new row violates row-level security policy'));
    await waitFor(() => expect(current()?.moments[0]?.like_count).toBe(2));
    expect(current()?.liked?.moments).toEqual([]);
  });

  it('sends fast taps one at a time in order, so the last tap wins on the server', async () => {
    const { result, current } = await setup();
    await act(async () => result.current.toggle({ kind: 'jar' }));
    await act(async () => result.current.toggle({ kind: 'jar' }));
    await act(async () => result.current.toggle({ kind: 'jar' }));
    // Like, unlike, like: the screen follows every tap at once…
    expect(current()?.jar.like_count).toBe(11);
    expect(current()?.liked?.jar).toBe(true);
    // …and only the first request is out until it settles.
    await waitFor(() => expect(mockServer.requests).toHaveLength(1));
    for (let i = 0; i < 3; i += 1) {
      await waitFor(() => expect(mockServer.requests).toHaveLength(i + 1));
      await act(async () => mockServer.requests[i]?.release());
    }
    expect(mockServer.requests.map((r) => r.op)).toEqual(['like', 'unlike', 'like']);
    expect(mockServer.liked.has(`jar:${JAR}`)).toBe(true);
  });
});
