import { fireEvent, render, screen } from '@testing-library/react-native';

import { sizes, space } from '@/theme/tokens';

import { buildTodayGrid, type ServerMoment } from '../todayGrid';
import { TodayView, type TodayViewProps } from '../TodayView';

// Reanimated needs native worklets; JarGraphic only uses it to animate a new layer.
jest.mock('react-native-reanimated', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent:
        (C: React.ComponentType<Record<string, unknown>>) =>
        ({ animatedProps, ...rest }: { animatedProps: object }) =>
          createElement(C, { ...rest, ...animatedProps }),
    },
    Easing: { out: () => 'easeOut', cubic: 'cubic' },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedProps: (fn: () => object) => fn(),
    withTiming: (to: number) => to,
  };
});

const TZ = 'Asia/Manila';
const NOW = new Date('2026-11-10T08:15:00+08:00'); // Tue, Nov 10, morning

function live(slot: ServerMoment['slot']): ServerMoment {
  return {
    id: `m-${slot}`,
    slot,
    status: 'live',
    is_private: false,
    is_backfilled: false,
    captured_at: '2026-11-09T23:30:00Z',
    added_at: '2026-11-09T23:31:00Z',
    thumbUrl: null,
  };
}

async function renderToday(props: Partial<TodayViewProps> = {}) {
  const onCapture = jest.fn();
  const onOpenMyDays = jest.fn();
  const onRetry = jest.fn();
  await render(
    <TodayView
      now={NOW}
      tz={TZ}
      tiles={buildTodayGrid({ localDate: '2026-11-10', moments: [], queue: [], nowSlot: 'morning' })}
      hasAnyJar={false}
      displayName="Dale Cruz"
      avatarUrl={null}
      readerCount={0}
      insets={{ top: 47, bottom: 34 }}
      onCapture={onCapture}
      onOpenMyDays={onOpenMyDays}
      onRetry={onRetry}
      {...props}
    />,
  );
  return { onCapture, onOpenMyDays, onRetry };
}

describe('TodayView', () => {
  it('first day: shows "Your first jar" and no count or Publish', async () => {
    await renderToday();
    expect(screen.getByText('Your first jar')).toBeTruthy();
    expect(screen.getByText('Eight moments fill it up. Start with whatever’s in front of you right now.')).toBeTruthy();
    expect(screen.queryByText(/of 8 moments/)).toBeNull();
    expect(screen.queryByTestId('today-publish')).toBeNull();
    expect(screen.getByText('Tue, Nov 10 · Good morning, Dale')).toBeTruthy();
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Today');
  });

  it('a queued first moment replaces the first-day card with the count', async () => {
    await renderToday({
      tiles: buildTodayGrid({
        localDate: '2026-11-10',
        moments: [],
        nowSlot: 'morning',
        queue: [
          {
            id: 1,
            slot: 'ootd',
            state: 'queued',
            localDate: '2026-11-10',
            photoUri: 'file:///q/ootd.webp',
            thumbUri: null,
            capturedAt: null,
            isPrivate: false,
          },
        ],
      }),
    });
    expect(screen.queryByText('Your first jar')).toBeNull();
    expect(screen.getByText('1 of 8 moments')).toBeTruthy();
  });

  it('normal day: count, readers, a disabled Publish, and the 8 tiles in order', async () => {
    const moments = (['whereami', 'mebusywith', 'ootd', 'selfie', 'morning'] as const).map(live);
    await renderToday({
      hasAnyJar: true,
      readerCount: 312,
      tiles: buildTodayGrid({ localDate: '2026-11-10', moments, queue: [], nowSlot: 'afternoon' }),
    });
    expect(screen.queryByText('Your first jar')).toBeNull();
    expect(screen.getByText('5 of 8 moments')).toBeTruthy();
    expect(screen.getByText('in today’s jar · 312 readers')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    const tileIds = screen.getAllByTestId(
      /^tile-(whereami|mebusywith|whoamiwith|ootd|selfie|morning|afternoon|evening)$/,
    );
    expect(tileIds.map((el) => el.props.testID)).toEqual([
      'tile-whereami',
      'tile-mebusywith',
      'tile-whoamiwith',
      'tile-ootd',
      'tile-selfie',
      'tile-morning',
      'tile-afternoon',
      'tile-evening',
    ]);
    expect(screen.getAllByText('Tap to capture')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '#afternoon, now, tap to capture' })).toBeTruthy();
  });

  it('says "1 reader" for one reader and leaves the count out while it is unknown', async () => {
    await renderToday({ hasAnyJar: true, readerCount: 1 });
    expect(screen.getByText('in today’s jar · 1 reader')).toBeTruthy();
    await renderToday({ hasAnyJar: true, readerCount: null });
    expect(screen.getByText('in today’s jar')).toBeTruthy();
  });

  it('greets without a name while signed out', async () => {
    await renderToday({ displayName: null, hasAnyJar: null });
    expect(screen.getByText('Tue, Nov 10 · Good morning')).toBeTruthy();
    expect(screen.queryByTestId('today-avatar')).toBeNull();
  });

  it('empty and Now tiles open Capture for their slot; the calendar opens My days', async () => {
    const { onCapture, onOpenMyDays } = await renderToday();
    await fireEvent.press(screen.getByRole('button', { name: '#morning, now, tap to capture' }));
    await fireEvent.press(screen.getByRole('button', { name: '#evening, empty' }));
    expect(onCapture.mock.calls).toEqual([['morning'], ['evening']]);
    await fireEvent.press(screen.getByRole('button', { name: 'My days' }));
    expect(onOpenMyDays).toHaveBeenCalledTimes(1);
  });

  it('offline: the banner says how many moments are saved, above the jar card (UploadStates)', async () => {
    await renderToday({ hasAnyJar: true, offlineCount: 2 });
    const banner = screen.getByTestId('offline-banner');
    expect(banner).toHaveTextContent(
      'You’re offline. 2 moments are saved on your phone and will upload when you’re back.',
    );
    expect(banner.props.accessibilityLabel).toBe(
      'You’re offline. 2 moments are saved on your phone and will upload when you’re back.',
    );
    await renderToday({ hasAnyJar: true, offlineCount: 1 });
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(
      'You’re offline. 1 moment is saved on your phone and will upload when you’re back.',
    );
  });

  it('no banner while online', async () => {
    await renderToday({ hasAnyJar: true, offlineCount: null });
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  it('upload states: waiting, uploading and failed tiles; Retry passes the queue item id', async () => {
    const item = (
      id: number,
      slot: 'whereami' | 'selfie' | 'morning' | 'ootd',
      state: 'queued' | 'uploading' | 'failed' | 'conflict',
    ) => ({
      id,
      slot,
      state,
      localDate: '2026-11-10',
      photoUri: `file:///q/${slot}.webp`,
      thumbUri: null,
      capturedAt: null,
      isPrivate: false,
    });
    const { onRetry, onCapture } = await renderToday({
      hasAnyJar: true,
      tiles: buildTodayGrid({
        localDate: '2026-11-10',
        moments: [live('ootd')],
        queue: [
          item(11, 'whereami', 'queued'),
          item(12, 'selfie', 'uploading'),
          item(13, 'morning', 'failed'),
          item(14, 'ootd', 'conflict'),
        ],
        nowSlot: 'afternoon',
      }),
    });
    expect(screen.getByText('Waiting for connection')).toBeTruthy();
    expect(screen.getByText('Uploading')).toBeTruthy(); // the worker reports no progress: indeterminate
    expect(screen.getByText('Didn’t upload')).toBeTruthy();
    // Only the failed tile has Retry; the conflict leaves the server moment showing.
    expect(screen.getAllByRole('button', { name: /^Retry / })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry #morning' }));
    expect(onRetry.mock.calls).toEqual([[13]]);
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('pads the bottom so the last row clears the floating tab bar', async () => {
    await renderToday();
    const style = screen.getByTestId('today-scroll').props.contentContainerStyle as object[];
    const bottom = Object.assign({}, ...style) as { paddingBottom: number };
    expect(bottom.paddingBottom).toBe(34 + sizes.tabBar + space.lg);
  });
});
