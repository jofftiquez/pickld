import { track } from '@/lib/analytics';

import { setReading } from '../useFollow';

// `follow` (NFR-ANL-01) goes from setReading, which every Read and Read back uses (profile, readers list,
// notifications, Find friends): once per follow that went through, never for Reading → Read.

const mockResult: { error: { message: string } | null; requested: boolean } = { error: null, requested: false };
jest.mock('@/lib/supabase', () => {
  // follow_requests reads come back with the viewer's request when the author approves readers (0176).
  const chain = (table: string): object => {
    const c = {
      eq: () => c,
      select: () => c,
      then: (resolve: (v: unknown) => unknown) =>
        resolve({
          error: mockResult.error,
          data: table === 'follow_requests' && mockResult.requested ? [{ author_id: 'u-2' }] : [],
        }),
    };
    return c;
  };
  return {
    getSupabase: () => ({
      from: (table: string) => ({
        upsert: async () => mockResult,
        delete: () => chain(table),
        select: () => chain(table),
      }),
    }),
  };
});
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

beforeEach(() => {
  mockResult.error = null;
  mockResult.requested = false;
  jest.mocked(track).mockClear();
});

describe('setReading analytics', () => {
  it('a Read that went through is one follow event', async () => {
    expect(await setReading('u-1', 'u-2', true)).toBe('reading');
    expect(jest.mocked(track).mock.calls).toEqual([['follow', {}]]);
  });

  it('a Read that became a request sends nothing until it is approved (0176)', async () => {
    mockResult.requested = true;
    expect(await setReading('u-1', 'u-2', true)).toBe('requested');
    expect(await setReading('u-1', 'u-2', false)).toBe('cancelled');
    expect(track).not.toHaveBeenCalled();
  });

  it('a failed Read and an unfollow send nothing', async () => {
    mockResult.error = { message: 'offline' };
    await expect(setReading('u-1', 'u-2', true)).rejects.toThrow('offline');
    mockResult.error = null;
    await setReading('u-1', 'u-2', false);
    expect(track).not.toHaveBeenCalled();
  });
});
