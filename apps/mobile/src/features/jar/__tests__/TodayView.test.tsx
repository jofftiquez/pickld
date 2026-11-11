import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { filterMatrices } from '@/features/edit/filters';
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
  const onOpenMoment = jest.fn();
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
      onOpenMoment={onOpenMoment}
      {...props}
    />,
  );
  return { onCapture, onOpenMyDays, onRetry, onOpenMoment };
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

  it('checking and removed server moments open their moment; filled and queued checking tiles do not (M2-21)', async () => {
    const { onOpenMoment, onCapture } = await renderToday({
      hasAnyJar: true,
      tiles: buildTodayGrid({
        localDate: '2026-11-10',
        moments: [
          live('whereami'),
          { ...live('mebusywith'), id: 'm-checking', status: 'checking' },
          { ...live('ootd'), id: 'm-removed', status: 'removed' },
        ],
        queue: [
          {
            id: 7,
            slot: 'selfie',
            state: 'uploaded',
            localDate: '2026-11-10',
            photoUri: 'file:///q/selfie.webp',
            thumbUri: null,
            capturedAt: '2026-11-10T00:10:00Z',
            isPrivate: false,
          },
        ],
        nowSlot: 'morning',
      }),
    });

    await fireEvent.press(screen.getByTestId('tile-mebusywith'));
    expect(onOpenMoment).toHaveBeenLastCalledWith('m-checking');
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(onOpenMoment).toHaveBeenLastCalledWith('m-removed');
    expect(screen.getByRole('button', { name: '#ootd, removed, tap to see why' })).toBeTruthy();

    // Not pressable: a live tile (Moment detail is M3-08) and a checking tile still waiting for its server row.
    expect(screen.getByTestId('tile-whereami')).toBeDisabled();
    expect(screen.getByTestId('tile-selfie')).toBeDisabled();
    expect(onOpenMoment).toHaveBeenCalledTimes(2);
    expect(onCapture).not.toHaveBeenCalled();
    // A removed moment doesn't count toward the jar.
    expect(screen.getByText('3 of 8 moments')).toBeTruthy();
  });
});

describe('TodayView: tiles draw moments with their edits (M2-18)', () => {
  const hidden = { includeHiddenElements: true } as const;
  const sticker = {
    id: 's1',
    type: 'sticker',
    stickerId: '4fec3a86-8a82-4601-fe12-fdbf36bead43',
    asset: 'stickers/everyday/kape-muna.png',
    label: 'Kape muna',
    x: 0.3,
    y: 0.3,
    scale: 0.4,
    rotation: 0.2,
  };
  const stamp = { ...sticker, id: 'st', asset: 'stickers/stamps/time.png', label: 'Time', stamp: 'time' };
  const serverEdits = { v: 1, filter: 'merienda', overlays: [sticker, stamp] };

  async function renderWithEdits() {
    await renderToday({
      hasAnyJar: true,
      tiles: buildTodayGrid({
        localDate: '2026-11-10',
        nowSlot: 'afternoon',
        jarTz: TZ,
        moments: [
          { ...live('ootd'), thumbUrl: 'https://photos.test/ootd.webp', edits: serverEdits },
          { ...live('selfie'), status: 'checking', thumbUrl: 'https://photos.test/selfie.webp', edits: serverEdits },
          { ...live('whereami'), thumbUrl: 'https://photos.test/whereami.webp', edits: {} },
        ],
        queue: [
          {
            id: 4,
            slot: 'morning',
            state: 'queued',
            localDate: '2026-11-10',
            photoUri: 'file:///q/morning.webp',
            thumbUri: 'file:///q/morning-thumb.webp',
            capturedAt: '2026-11-10T00:05:00Z',
            isPrivate: false,
            tz: TZ,
            createdAt: Date.parse('2026-11-10T00:05:00Z'),
            edits: {
              v: 1,
              filter: 'original',
              overlays: [{ id: 'b1', type: 'bubble', text: 'hello', x: 0.5, y: 0.5, scale: 0.5, rotation: 0 }],
            },
          },
        ],
      }),
    });
    // The tile's width comes from the grid: lay the moment out in a 171 × 116 tile.
    for (const slot of ['ootd', 'morning']) {
      await fireEvent(screen.getByTestId(`tile-${slot}-moment`, hidden), 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 171, height: 116 } },
      });
    }
  }

  it('a live moment shows its filter, its stickers and its stamp, cropped like the plain photo', async () => {
    await renderWithEdits();
    const tile = within(screen.getByTestId('tile-ootd-moment', hidden));
    expect(tile.getByTestId('moment-overlay-s1', hidden)).toBeTruthy();
    expect(tile.getByTestId('skia-image', hidden).props.accessibilityHint).toBe('https://photos.test/ootd.webp');
    expect(JSON.parse(tile.getByTestId('color-matrix', hidden).props.accessibilityValue.text)).toEqual([
      ...filterMatrices.merienda,
    ]);
    // Captured 23:30 UTC: 7:30 AM in the jar's zone.
    expect(within(tile.getByTestId('sticker-st', hidden)).getByText('7:30 AM', hidden)).toBeTruthy();
    // Drawn 3:4 at the tile's width and centred, so the overlays stay where they are on the photo.
    expect(tile.getByTestId('moment-overlay-s1', hidden).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: 0.4 * 171 })]),
    );
    expect(within(screen.getByTestId('tile-ootd')).queryByTestId('photo-tile-image', hidden)).toBeNull();
    expect(within(screen.getByTestId('tile-whereami')).getByTestId('photo-tile-image', hidden)).toBeTruthy();
    // The tile still speaks for itself; the picture adds no extra stops.
    expect(screen.getByRole('image', { name: '#ootd, 7:30 AM, added' })).toBeTruthy();
  });

  it('a queued moment shows the edits saved on the phone', async () => {
    await renderWithEdits();
    const tile = within(screen.getByTestId('tile-morning-moment', hidden));
    expect(tile.getByTestId('bubble-b1', hidden)).toBeTruthy();
    expect(tile.getByTestId('moment-view-photo', hidden).props.source).toEqual([
      { uri: 'file:///q/morning-thumb.webp' },
    ]);
  });

  it('a checking moment stays plain and blurred, and a moment without edits keeps the plain photo', async () => {
    await renderWithEdits();
    expect(screen.queryByTestId('tile-selfie-moment', hidden)).toBeNull();
    expect(screen.queryByTestId('tile-whereami-moment', hidden)).toBeNull();
    expect(within(screen.getByTestId('tile-selfie')).queryByTestId('moment-overlay-s1', hidden)).toBeNull();
  });
});
