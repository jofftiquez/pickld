import { act, renderHook } from '@testing-library/react-native';

import { showToast, useToastStore } from '@/lib/toast';

import { useFirstMomentTip } from '../useFirstMomentTip';

// The phone's key-value store, kept across remounts (a relaunch).
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));

/** Opens Today once (mounts the hook), returns whether the tip showed, and closes it again. */
const shows = async (userId: string, eligible: boolean) => {
  const hook = await renderHook(() => useFirstMomentTip(userId, eligible));
  await act(async () => undefined);
  const visible = hook.result.current.visible;
  await hook.unmount();
  return visible;
};

describe('First moment tip (FR-ONB-08)', () => {
  beforeEach(() => {
    mockDisk.clear();
    useToastStore.setState({ current: null });
  });

  it('shows once on the first day; the next open of Today does not show it again', async () => {
    expect(await shows('u-1', true)).toBe(true);
    expect(await shows('u-1', true)).toBe(false);
    expect(await shows('u-2', true)).toBe(true);
  });

  it('is not shown once the account has a jar, and that does not use it up', async () => {
    expect(await shows('u-1', false)).toBe(false);
    expect(await shows('u-1', true)).toBe(true);
  });

  it('waits for a toast on screen to leave, so it does not cover it; a later toast leaves it up', async () => {
    showToast('readEachOther', { username: 'mia' });
    const hook = await renderHook(() => useFirstMomentTip('u-1', true));
    await act(async () => undefined);
    expect(hook.result.current.visible).toBe(false);
    expect(mockDisk.size).toBe(0);
    await act(async () => useToastStore.getState().hide(useToastStore.getState().current!.id));
    await act(async () => undefined);
    expect(hook.result.current.visible).toBe(true);
    await act(async () => showToast('readEachOther', { username: 'mia' }));
    expect(hook.result.current.visible).toBe(true);
    await hook.unmount();
  });

  it('closes for good when it stops applying, such as Today leaving the front for a linked screen', async () => {
    const hook = await renderHook(({ eligible }: { eligible: boolean }) => useFirstMomentTip('u-1', eligible), {
      initialProps: { eligible: true },
    });
    await act(async () => undefined);
    expect(hook.result.current.visible).toBe(true);
    await hook.rerender({ eligible: false });
    await act(async () => undefined);
    expect(hook.result.current.visible).toBe(false);
    // Back on Today: it already counted as shown.
    await hook.rerender({ eligible: true });
    await act(async () => undefined);
    expect(hook.result.current.visible).toBe(false);
    await hook.unmount();
  });
});
