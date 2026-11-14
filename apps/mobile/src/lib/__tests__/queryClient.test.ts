import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';

import { createQueryClient as create, persistOptions } from '../queryClient';

const clients: ReturnType<typeof create>[] = [];
const createQueryClient = () => {
  const c = create();
  clients.push(c);
  return c;
};
afterEach(() => clients.splice(0).forEach((c) => c.clear()));

const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
    removeItem: async (k: string) => void mockDisk.delete(k),
  },
}));

describe('query cache persister', () => {
  it('restores cached queries into a new client after a restart', async () => {
    const before = createQueryClient();
    before.setQueryData(['jar', 'u1', '2026-11-10'], { count: 5 });
    await persistQueryClientSave({ queryClient: before, ...persistOptions });
    expect(mockDisk.get('pickld-query-cache')).toContain('2026-11-10');

    const after = createQueryClient(); // simulates a cold start with no network
    await persistQueryClientRestore({ queryClient: after, ...persistOptions });
    expect(after.getQueryData(['jar', 'u1', '2026-11-10'])).toEqual({ count: 5 });
  });

  it('leaves out a timeline the date scrubber jumped into, and keeps the newest-first one', async () => {
    const before = createQueryClient();
    before.setQueryData(['momentsFeed', 'u1'], { pages: [['newest']] });
    before.setQueryData(['momentsFeed', 'u1', { from: '2026-11-12T16:00:00.000Z' }], { pages: [['nov 12']] });
    await persistQueryClientSave({ queryClient: before, ...persistOptions });

    const after = createQueryClient();
    await persistQueryClientRestore({ queryClient: after, ...persistOptions });
    expect(after.getQueryData(['momentsFeed', 'u1'])).toEqual({ pages: [['newest']] });
    expect(after.getQueryData(['momentsFeed', 'u1', { from: '2026-11-12T16:00:00.000Z' }])).toBeUndefined();
  });

  it('keeps restored queries for at least the persist max age', () => {
    expect(createQueryClient().getDefaultOptions().queries?.gcTime).toBeGreaterThanOrEqual(persistOptions.maxAge ?? 0);
  });

  it('discards a cache written by an older shape (buster)', async () => {
    const before = createQueryClient();
    before.setQueryData(['profile', 'dale'], { name: 'Dale' });
    await persistQueryClientSave({ queryClient: before, ...persistOptions, buster: 'old' });
    const after = createQueryClient();
    await persistQueryClientRestore({ queryClient: after, ...persistOptions });
    expect(after.getQueryData(['profile', 'dale'])).toBeUndefined();
  });
});
