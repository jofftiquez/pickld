import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { usePendingCrop } from '@/features/capture/pendingCrop';
import { buildTodayGrid, type GridTile } from '@/features/jar/todayGrid';
import { useToastStore } from '@/lib/toast';

import { MomentOptions, type MomentOptionsProps } from '../MomentOptions';
import { deleteMoment, MomentOptionError, moveMoment, setJarCover, setMomentVisibility } from '../momentActions';
import { openRecrop } from '../recrop';

// Moment options (M2-23, FR-CAP-10) on Today: the real sheet and confirm dialog; what each option does to
// the moment (queue or server) is momentActions.ts, tested on its own and against local Supabase.

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  useReducedMotion: () => false,
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: jest.requireActual('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet/mock');
  const { forwardRef, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
  const Sheet = forwardRef<{ close: () => void }, { onClose: () => void; children: ReactNode }>(
    function Sheet(props, ref) {
      useImperativeHandle(ref, () => ({ close: () => props.onClose() }));
      return <>{props.children}</>;
    },
  );
  return {
    ...actual,
    __esModule: true,
    default: Sheet,
    BottomSheetView: ({ children }: { children: ReactNode }) => children,
    BottomSheetBackdrop: () => null,
    useBottomSheetTimingConfigs: (config: object) => config,
  };
});
jest.mock('../momentActions', () => {
  const actual = jest.requireActual<typeof import('../momentActions')>('../momentActions');
  return {
    MomentOptionError: actual.MomentOptionError,
    setMomentVisibility: jest.fn(async () => undefined),
    moveMoment: jest.fn(async () => undefined),
    deleteMoment: jest.fn(async () => undefined),
    setJarCover: jest.fn(async () => undefined),
  };
});
jest.mock('../recrop', () => ({ openRecrop: jest.fn() }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockClient = { name: 'supabase' };
jest.mock('@/lib/supabase', () => ({ getSupabase: () => mockClient }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }] }));

const USER = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
const MOMENT = '0f1e2d3c-4b5a-4968-8776-655443322110';
const JAR = '11111111-2222-4333-8444-555555555555';

const tiles = buildTodayGrid({
  localDate: '2026-11-09',
  moments: [
    {
      id: MOMENT,
      slot: 'ootd',
      status: 'live',
      visibility: 'readers',
      is_backfilled: false,
      captured_at: '2026-11-08T23:30:00Z', // 7:30 AM in Manila, Mon Nov 9
      added_at: '2026-11-08T23:31:00Z',
      thumbUrl: null,
    },
  ],
  queue: [],
  nowSlot: null,
  jarTz: 'Asia/Manila',
});
const ootd = tiles.find((tile) => tile.slot === 'ootd') as GridTile;
const server = { tile: ootd, target: { kind: 'server', momentId: MOMENT, jarId: JAR } } as const;

let queryClient: QueryClient;
async function renderOptions(props: Partial<MomentOptionsProps> = {}) {
  const onClose = jest.fn();
  queryClient = new QueryClient();
  jest.spyOn(queryClient, 'invalidateQueries');
  await render(
    <QueryClientProvider client={queryClient}>
      <MomentOptions
        visible
        selection={server}
        userId={USER}
        freeSlots={['morning', 'evening']}
        tz="Asia/Manila"
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

const row = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.clearAllMocks();
  usePendingCrop.getState().setPending(null);
  useToastStore.setState({ current: null });
});

describe('Moment options', () => {
  it('shows the slot and time in the jar’s zone, then the options in the design’s order', async () => {
    await renderOptions({ tz: 'Asia/Manila' });
    expect(screen.getByRole('header', { name: '#ootd' })).toBeTruthy();
    expect(screen.getByText('7:30 AM · Mon, Nov 9')).toBeTruthy();
    const labels = screen
      .getAllByRole(/button|switch/)
      .map((b) => b.props.accessibilityLabel as string)
      .filter((l) => l !== 'Close');
    expect(labels).toEqual([
      'Edit caption',
      'Edit stickers and filters',
      'Re-crop',
      'Visibility: Readers',
      'Move to another moment',
      'Delete moment',
      'Cancel',
    ]);
  });

  it('as the preview’s More menu, leaves out what the preview’s bar already has (QA item 3, D-54)', async () => {
    await renderOptions({ mode: 'more' });
    const labels = screen
      .getAllByRole(/button|switch/)
      .map((b) => b.props.accessibilityLabel as string)
      .filter((l) => l !== 'Close');
    expect(labels).toEqual(['Re-crop', 'Move to another moment', 'Delete moment', 'Cancel']);
  });

  it('offers Set as cover for a moment that is not the cover yet (D-56), in More too, and shows a toast', async () => {
    const { onClose } = await renderOptions({ mode: 'more', selection: { ...server, canSetCover: true } });
    const labels = screen
      .getAllByRole(/button|switch/)
      .map((b) => b.props.accessibilityLabel as string)
      .filter((l) => l !== 'Close');
    expect(labels).toEqual(['Re-crop', 'Move to another moment', 'Set as cover', 'Delete moment', 'Cancel']);
    await fireEvent.press(row('Set as cover'));
    expect(setJarCover).toHaveBeenCalledWith(mockClient, JAR, MOMENT);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jarPage', USER, JAR] });
    expect(useToastStore.getState().current?.key).toBe('coverSet');
  });

  it('keeps the sheet open and says why when Set as cover is refused', async () => {
    jest.mocked(setJarCover).mockRejectedValueOnce(new MomentOptionError('refused'));
    const { onClose } = await renderOptions({ selection: { ...server, canSetCover: true } });
    await fireEvent.press(row('Set as cover'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('moment-options-error')).toBeTruthy();
    expect(useToastStore.getState().current).toBeNull();
  });

  it('as the preview’s Visibility action, opens on the Visibility page with no Back', async () => {
    await renderOptions({ mode: 'visibility' });
    expect(screen.getByRole('header', { name: 'Who can see this moment' })).toBeTruthy();
    expect(screen.queryByTestId('moment-options-visibility-back')).toBeNull();
    await fireEvent.press(screen.getByTestId('moment-options-visibility-only_me'));
    expect(setMomentVisibility).toHaveBeenCalledWith(mockClient, server.target, 'only_me');
  });

  it('Delete asks first: Cancel keeps the moment, Delete removes it and closes', async () => {
    const { onClose } = await renderOptions();
    await fireEvent.press(row('Delete moment'));
    const dialog = screen.getByTestId('delete-moment-dialog');
    expect(within(dialog).getByRole('header', { name: 'Delete your #ootd photo?' })).toBeTruthy();
    expect(deleteMoment).not.toHaveBeenCalled();

    await fireEvent.press(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('delete-moment-dialog')).toBeNull();
    expect(deleteMoment).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(row('Delete moment'));
    await fireEvent.press(within(screen.getByTestId('delete-moment-dialog')).getByRole('button', { name: 'Delete' }));
    expect(deleteMoment).toHaveBeenCalledWith(mockClient, server.target);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jar', USER] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['queue', USER] });
    expect(useToastStore.getState().current?.key).toBe('momentDeleted');
  });

  it('Visibility opens Readers, Everyone and Only me; a choice applies at once, a failure keeps the old one', async () => {
    const { onClose } = await renderOptions();
    await fireEvent.press(row('Visibility: Readers'));
    const choice = (name: RegExp) => screen.getByRole('radio', { name });
    expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
      'Readers, People who read your days',
      'Everyone, Anyone on Pickld',
      'Only me, Only you will see this moment',
    ]);
    expect(choice(/^Readers/).props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(choice(/^Only me/));
    expect(setMomentVisibility).toHaveBeenCalledWith(mockClient, server.target, 'only_me');
    expect(choice(/^Only me/).props.accessibilityState).toMatchObject({ checked: true });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jar', USER] });

    jest.mocked(setMomentVisibility).mockRejectedValueOnce(new Error('Network request failed'));
    await fireEvent.press(choice(/^Everyone/));
    expect(setMomentVisibility).toHaveBeenLastCalledWith(mockClient, server.target, 'everyone');
    expect(choice(/^Only me/).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('moment-options-error')).toHaveTextContent(
      'Couldn’t change this moment. Check your connection and try again.',
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Back to moment options' }));
    expect(row('Visibility: Only me')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Move lists only the jar’s empty slots and moves there; a slot filled meanwhile says so', async () => {
    const { onClose } = await renderOptions({ freeSlots: ['morning', 'evening'] });
    await fireEvent.press(row('Move to another moment'));
    expect(screen.getAllByRole('button', { name: /^Move to #/ }).map((b) => b.props.accessibilityLabel)).toEqual([
      'Move to #morning',
      'Move to #evening',
    ]);

    jest.mocked(moveMoment).mockRejectedValueOnce(new MomentOptionError('slotTaken'));
    await fireEvent.press(row('Move to #morning'));
    expect(screen.getByTestId('moment-options-error')).toHaveTextContent(
      'That moment was just filled. Pick another one.',
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(useToastStore.getState().current).toBeNull();

    await fireEvent.press(row('Move to #evening'));
    expect(moveMoment).toHaveBeenLastCalledWith(mockClient, server.target, 'evening');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().current).toMatchObject({ key: 'momentMoved', params: { slot: '#evening' } });
  });

  it('Move with no empty slot says there is nowhere to go, and Back returns to the options', async () => {
    await renderOptions({ freeSlots: [] });
    await fireEvent.press(row('Move to another moment'));
    expect(screen.getByTestId('moment-options-no-slots')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /^Move to #/ })).toHaveLength(0);
    await fireEvent.press(row('Back to moment options'));
    expect(row('Delete moment')).toBeTruthy();
  });

  it('Edit caption and Edit stickers and filters open the editor on the moment id, or the queue id', async () => {
    const { onClose } = await renderOptions();
    await fireEvent.press(row('Edit caption'));
    expect(mockPush).toHaveBeenLastCalledWith(`/edit/${MOMENT}?focus=caption`);
    await fireEvent.press(row('Edit stickers and filters'));
    expect(mockPush).toHaveBeenLastCalledWith(`/edit/${MOMENT}`);
    expect(onClose).toHaveBeenCalledTimes(2);

    await renderOptions({ selection: { tile: ootd, target: { kind: 'queued', queueId: 21 } } });
    await fireEvent.press(row('Edit caption'));
    expect(mockPush).toHaveBeenLastCalledWith('/edit/21?focus=caption');
  });

  it('Re-crop opens Crop on the saved photo; a busy upload says so and stays', async () => {
    const pending = {
      photo: { uri: 'file:///cache/recrop/x.webp', width: 1440, height: 1920, temporary: true },
      slot: 'ootd' as const,
      userId: USER,
      recrop: server.target,
    };
    jest.mocked(openRecrop).mockRejectedValueOnce(new MomentOptionError('busy'));
    const { onClose } = await renderOptions();
    await act(async () => fireEvent.press(row('Re-crop')));
    expect(screen.getByTestId('moment-options-error')).toHaveTextContent(
      'This photo is uploading. Try again in a moment.',
    );
    expect(mockPush).not.toHaveBeenCalled();

    jest.mocked(openRecrop).mockResolvedValueOnce(pending);
    await act(async () => fireEvent.press(row('Re-crop')));
    expect(openRecrop).toHaveBeenLastCalledWith({ target: server.target, slot: 'ootd', userId: USER });
    expect(usePendingCrop.getState().pending).toEqual(pending);
    expect(mockPush).toHaveBeenCalledWith('/crop');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
