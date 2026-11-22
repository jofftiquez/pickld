import { act, renderHook } from '@testing-library/react-native';

import { useAuthStore } from '@/lib/authStore';
import { showToast, useToastStore } from '@/lib/toast';

import { turnOnGuideTips, useGuideStore } from '../guideTips';
import { useGuideTip, type GuideTipCandidate } from '../useGuideTip';

// The phone's key-value store, kept across remounts (a relaunch).
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
  },
}));
const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

type Props = { candidates: GuideTipCandidate[]; focused: boolean };
const TODAY: GuideTipCandidate[] = [
  { id: 'today', when: true },
  { id: 'publish', when: true },
];

const open = async (props: Props) => {
  const hook = await renderHook((p: Props) => useGuideTip(p.candidates, p.focused), { initialProps: props });
  await act(async () => undefined);
  return hook;
};

/** A relaunch: the loaded state is forgotten and read from the phone again. */
const relaunch = () => useGuideStore.setState({ userId: null, on: false, seen: [] });

describe('First-time guide tips (FR-ONB-10)', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockTrack.mockClear();
    relaunch();
    useToastStore.setState({ current: null });
    useAuthStore.setState({ session: { user: { id: 'u-1' } } as never, status: 'signedIn' });
  });

  it('shows nothing for an account that did not finish setup on this build', async () => {
    const hook = await open({ candidates: TODAY, focused: true });
    expect(hook.result.current.tip).toBeNull();
    await hook.unmount();
  });

  it('shows one tip per visit, in order, and never the same tip again after a relaunch', async () => {
    await turnOnGuideTips('u-1');
    const hook = await open({ candidates: TODAY, focused: true });
    expect(hook.result.current.tip).toBe('today');
    await act(async () => hook.result.current.close('got_it'));
    expect(hook.result.current.tip).toBeNull();
    expect(mockTrack).toHaveBeenCalledWith('guide_tip_closed', { tip: 'today', how: 'got_it' });

    // Still on the same visit: Publish waits for the next one.
    await act(async () => undefined);
    expect(hook.result.current.tip).toBeNull();
    await hook.rerender({ candidates: TODAY, focused: false });
    await hook.rerender({ candidates: TODAY, focused: true });
    await act(async () => undefined);
    expect(hook.result.current.tip).toBe('publish');
    await hook.unmount();

    relaunch();
    const again = await open({ candidates: TODAY, focused: true });
    expect(again.result.current.tip).toBeNull();
    await again.unmount();
  });

  it('counts as shown when it opens, so leaving the screen with it up does not bring it back', async () => {
    await turnOnGuideTips('u-1');
    const hook = await open({ candidates: [{ id: 'discover', when: true }], focused: true });
    expect(hook.result.current.tip).toBe('discover');
    await hook.rerender({ candidates: [{ id: 'discover', when: true }], focused: false });
    expect(hook.result.current.tip).toBeNull();
    await hook.rerender({ candidates: [{ id: 'discover', when: true }], focused: true });
    await act(async () => undefined);
    expect(hook.result.current.tip).toBeNull();
    await hook.unmount();
  });

  it('skips a tip that does not apply yet without using it up', async () => {
    await turnOnGuideTips('u-1');
    const hook = await open({
      candidates: [
        { id: 'today', when: false },
        { id: 'publish', when: true },
      ],
      focused: true,
    });
    expect(hook.result.current.tip).toBe('publish');
    await act(async () => hook.result.current.close('got_it'));
    await hook.rerender({ candidates: [{ id: 'today', when: true }], focused: false });
    await hook.rerender({ candidates: [{ id: 'today', when: true }], focused: true });
    await act(async () => undefined);
    expect(hook.result.current.tip).toBe('today');
    await hook.unmount();
  });

  it('waits for a toast on screen to leave', async () => {
    await turnOnGuideTips('u-1');
    showToast('readEachOther', { username: 'mia' });
    const hook = await open({ candidates: TODAY, focused: true });
    expect(hook.result.current.tip).toBeNull();
    await act(async () => useToastStore.getState().hide(useToastStore.getState().current!.id));
    await act(async () => undefined);
    expect(hook.result.current.tip).toBe('today');
    await hook.unmount();
  });

  it('Turn off tips stops every later tip, even after a relaunch; Show tips again brings them all back', async () => {
    await turnOnGuideTips('u-1');
    const hook = await open({ candidates: TODAY, focused: true });
    await act(async () => hook.result.current.close('turn_off'));
    expect(mockTrack).toHaveBeenCalledWith('guide_tip_closed', { tip: 'today', how: 'turn_off' });
    await hook.unmount();

    relaunch();
    const later = await open({ candidates: [{ id: 'discover', when: true }], focused: true });
    expect(later.result.current.tip).toBeNull();
    await act(async () => turnOnGuideTips('u-1'));
    await act(async () => undefined);
    expect(later.result.current.tip).toBe('discover');
    await later.unmount();
  });

  it('keeps each account to its own tips', async () => {
    await turnOnGuideTips('u-1');
    useAuthStore.setState({ session: { user: { id: 'u-2' } } as never, status: 'signedIn' });
    const hook = await open({ candidates: TODAY, focused: true });
    expect(hook.result.current.tip).toBeNull();
    await hook.unmount();
  });
});
