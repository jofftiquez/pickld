import 'react-native-gesture-handler/jestSetup';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { useAuthStore } from '@/lib/authStore';

import { packIds, packRows, stickerRows } from '../../edit/__tests__/stickerRows';
import { buildMyPacks, movePack, type MyPack } from '../myStickers';
import { MyStickersView } from '../MyStickersView';
import { useSavePacks } from '../useMyStickers';

// My stickers (FR-STK-08): the packs the user may use in their order, how they got each, and saving the
// order and switches to user_pack_prefs.

const mockUpsert = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }) }),
}));

const earned = { earned: ['first_full_jar'] };
const bought = [{ pack_id: packIds.everyday, source: 'purchase', acquired_at: '2026-11-10T03:00:00Z' }];

describe('buildMyPacks', () => {
  it('lists usable packs only, saying how the user has each and how much of an earned pack is unlocked', () => {
    const packs = buildMyPacks(packRows(earned), stickerRows(earned), bought, []);
    expect(packs.map((p) => p.slug)).toEqual(['everyday', 'the-eight', 'stamps', 'milestones']);
    expect(packs.map((p) => p.kind)).toEqual(['bought', 'free', 'free', 'earned']);
    expect(packs[0]?.boughtAt).toBe('2026-11-10T03:00:00Z');
    const milestones = packs[3];
    expect(milestones?.usableCount).toBe(1);
    expect(milestones?.stickerCount).toBeGreaterThan(1);
  });

  it('applies the saved order and switches', () => {
    const packs = buildMyPacks(
      packRows(),
      stickerRows(),
      [],
      [
        { pack_id: packIds.stamps, sort: 0, hidden: true },
        { pack_id: packIds.everyday, sort: 1, hidden: false },
      ],
    );
    expect(packs.map((p) => [p.slug, p.hidden])).toEqual([
      ['stamps', true],
      ['everyday', false],
      ['the-eight', false],
    ]);
  });
});

it('movePack moves one pack and clamps the target', () => {
  expect(movePack(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  expect(movePack(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b']);
  expect(movePack(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
});

describe('MyStickersView', () => {
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const packs = buildMyPacks(packRows(), stickerRows(), [], []);
  const view = (onChange: (p: MyPack[]) => void, restore = { status: 'idle' as const }) =>
    render(
      <MyStickersView
        packs={packs}
        restore={restore}
        insets={insets}
        onBack={jest.fn()}
        onRetry={jest.fn()}
        onChange={onChange}
        onRestore={jest.fn()}
        onShop={jest.fn()}
      />,
    );

  it('hides a pack with its switch and moves one with the screen reader actions', async () => {
    const onChange = jest.fn();
    await view(onChange);
    await fireEvent.press(screen.getByTestId('my-stickers-toggle-the-eight'));
    expect(onChange).toHaveBeenLastCalledWith(packs.map((p) => (p.slug === 'the-eight' ? { ...p, hidden: true } : p)));
    await fireEvent(screen.getByTestId('my-stickers-row-stamps'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveUp' },
    });
    expect(onChange.mock.lastCall?.[0].map((p: MyPack) => p.slug)).toEqual(['everyday', 'stamps', 'the-eight']);
  });

  it('drags a pack by its grip to a new place, by whole rows', async () => {
    const onChange = jest.fn();
    await view(onChange);
    await fireEvent(screen.getByTestId('my-stickers-row-everyday'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 70 } },
    });
    const grip = createGestureController('my-stickers-grip-stamps');
    await act(() => {
      grip.begin({ translationY: 0 });
      grip.activate({ translationY: 0 });
      grip.update({ translationY: -150 });
      grip.end({ translationY: -150 });
    });
    expect(onChange.mock.lastCall?.[0].map((p: MyPack) => p.slug)).toEqual(['stamps', 'everyday', 'the-eight']);
  });

  it('says what Restore purchases found', async () => {
    await render(
      <MyStickersView
        packs={packs}
        restore={{ status: 'done', count: 0 }}
        insets={insets}
        onBack={jest.fn()}
        onRetry={jest.fn()}
        onChange={jest.fn()}
        onRestore={jest.fn()}
        onShop={jest.fn()}
      />,
    );
    expect(screen.getByTestId('my-stickers-restore-result')).toHaveTextContent(
      'Nothing new to restore. Your packs are all here.',
    );
  });
});

describe('useSavePacks', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    useAuthStore.setState({ session: { user: { id: 'u1' } } as never, status: 'signedIn' });
  });

  it('saves every pack with its position and switch', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const hook = await renderHook(() => useSavePacks(), { wrapper });
    const packs = buildMyPacks(packRows(), stickerRows(), [], []);
    const next = movePack(packs, 2, 0).map((p) => (p.slug === 'everyday' ? { ...p, hidden: true } : p));
    await act(async () => {
      await hook.result.current.mutateAsync(next);
    });
    expect(mockUpsert).toHaveBeenCalledWith([
      { user_id: 'u1', pack_id: packIds.stamps, sort: 0, hidden: false },
      { user_id: 'u1', pack_id: packIds.everyday, sort: 1, hidden: true },
      { user_id: 'u1', pack_id: packIds['the-eight'], sort: 2, hidden: false },
    ]);
  });
});
