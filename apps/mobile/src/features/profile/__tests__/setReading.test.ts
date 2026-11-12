import { track } from '@/lib/analytics';

import { setReading } from '../useFollow';

// `follow` (NFR-ANL-01) goes from setReading, which every Read and Read back uses (profile, readers list,
// notifications, Find friends): once per follow that went through, never for Reading → Read.

const mockResult: { error: { message: string } | null } = { error: null };
jest.mock('@/lib/supabase', () => {
  const deleted = { eq: () => deleted, then: (resolve: (v: unknown) => unknown) => resolve(mockResult) };
  return {
    getSupabase: () => ({ from: () => ({ upsert: async () => mockResult, delete: () => deleted }) }),
  };
});
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

beforeEach(() => {
  mockResult.error = null;
  jest.mocked(track).mockClear();
});

describe('setReading analytics', () => {
  it('a Read that went through is one follow event', async () => {
    await setReading('u-1', 'u-2', true);
    expect(jest.mocked(track).mock.calls).toEqual([['follow', {}]]);
  });

  it('a failed Read and an unfollow send nothing', async () => {
    mockResult.error = { message: 'offline' };
    await expect(setReading('u-1', 'u-2', true)).rejects.toThrow('offline');
    mockResult.error = null;
    await setReading('u-1', 'u-2', false);
    expect(track).not.toHaveBeenCalled();
  });
});
