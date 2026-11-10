import { CHUNK_SIZE, secureSessionStorage } from '../secureSessionStorage';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    if (v.length > 2048) throw new Error('value too large for SecureStore');
    mockStore.set(k, v);
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    mockStore.delete(k);
  }),
}));

beforeEach(() => mockStore.clear());

describe('secureSessionStorage', () => {
  it('round-trips a session larger than one SecureStore item', async () => {
    const session = JSON.stringify({ access_token: 'a'.repeat(3000), refresh_token: 'r'.repeat(900) });
    await secureSessionStorage.setItem('sb-auth', session);
    expect(mockStore.get('sb-auth.n')).toBe(String(Math.ceil(session.length / CHUNK_SIZE)));
    expect(await secureSessionStorage.getItem('sb-auth')).toBe(session);
  });

  it('survives a "restart" because nothing is held in memory', async () => {
    await secureSessionStorage.setItem('sb-auth', 'token');
    let fresh: typeof import('../secureSessionStorage') | undefined;
    jest.isolateModules(() => {
      // A fresh module instance reads the same SecureStore.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = require('../secureSessionStorage') as typeof import('../secureSessionStorage');
    });
    expect(fresh?.secureSessionStorage).not.toBe(secureSessionStorage);
    expect(await fresh?.secureSessionStorage.getItem('sb-auth')).toBe('token');
  });

  it('drops leftover chunks when a value shrinks and on remove', async () => {
    await secureSessionStorage.setItem('k', 'x'.repeat(CHUNK_SIZE * 3));
    await secureSessionStorage.setItem('k', 'short');
    expect([...mockStore.keys()].sort()).toEqual(['k.0', 'k.n']);
    expect(await secureSessionStorage.getItem('k')).toBe('short');
    await secureSessionStorage.removeItem('k');
    expect(mockStore.size).toBe(0);
    expect(await secureSessionStorage.getItem('k')).toBeNull();
  });

  it('treats a partially written value as missing', async () => {
    await secureSessionStorage.setItem('k', 'x'.repeat(CHUNK_SIZE * 2));
    mockStore.delete('k.1');
    expect(await secureSessionStorage.getItem('k')).toBeNull();
  });
});
