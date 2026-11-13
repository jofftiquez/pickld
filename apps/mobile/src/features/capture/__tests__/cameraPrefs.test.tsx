import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getMirrorSelfies, setMirrorSelfies, useMirrorSelfies } from '../cameraPrefs';

// Mirror selfies (QA item 25, D-66): on by default, saved on this phone only (the local key-value store).
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));

beforeEach(() => mockDisk.clear());

describe('Mirror selfies', () => {
  it('is on until it is turned off, and remembers either choice', async () => {
    expect(await getMirrorSelfies()).toBe(true);
    await setMirrorSelfies(false);
    expect(await getMirrorSelfies()).toBe(false);
    await setMirrorSelfies(true);
    expect(await getMirrorSelfies()).toBe(true);
  });

  it('is kept for the phone, not for an account', async () => {
    await setMirrorSelfies(false);
    expect([...mockDisk.keys()]).toEqual(['camera:mirrorSelfies']);
  });

  it('the Settings hook loads the saved value and saves a change', async () => {
    await setMirrorSelfies(false);
    const { result } = await renderHook(() => useMirrorSelfies());
    await waitFor(() => expect(result.current[0]).toBe(false));
    await act(async () => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(await getMirrorSelfies()).toBe(true);
  });
});
