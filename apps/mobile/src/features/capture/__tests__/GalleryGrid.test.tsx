import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { GalleryGrid } from '../GalleryGrid';
import type { GalleryItem, LibraryPhoto } from '../galleryDays';
import { libraryPhotoFile, loadLibraryPhotos } from '../libraryPhotos';

jest.mock('../libraryPhotos', () => ({
  loadLibraryPhotos: jest.fn(),
  libraryPhotoFile: jest.fn(),
  onLibraryChange: () => () => {},
  chooseMorePhotos: jest.fn(),
}));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

const at = (iso: string, id: string) => ({ id, width: 3024, height: 4032, creationTime: Date.parse(iso) });
const insets = { top: 0, right: 0, bottom: 0, left: 0 };
let library: LibraryPhoto[] = [];

beforeEach(() => {
  // Only the date is fixed, so "Today" and the year in day labels don't move.
  jest.useFakeTimers({
    now: new Date('2026-11-11T14:00:00+08:00'),
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
  library = [at('2026-11-10T09:00:00+08:00', 'ph://new'), at('2026-11-08T21:00:00+08:00', 'ph://filled')];
  // Like Photos: newest first, and with a range only the photos taken within it.
  jest.mocked(loadLibraryPhotos).mockReset();
  jest
    .mocked(loadLibraryPhotos)
    .mockImplementation(async (offset, limit, range = null) =>
      library
        .filter(
          (p) =>
            range === null || (p.creationTime !== null && p.creationTime >= range.from && p.creationTime < range.to),
        )
        .slice(offset, offset + limit),
    );
  jest.mocked(libraryPhotoFile).mockReset();
  jest
    .mocked(libraryPhotoFile)
    .mockResolvedValue({ uri: 'file:///cache/gallery-1.jpg', width: 3024, height: 4032, exif: null });
});

afterEach(() => jest.useRealTimers());

async function openGrid(target: string | null = '2026-11-08', shown: 'day' | 'all' = 'day') {
  const onPick = jest.fn();
  await render(
    <GalleryGrid
      access="all"
      tz="Asia/Manila"
      target={target}
      insets={insets}
      onPick={onPick}
      onClose={jest.fn()}
      onUnavailable={jest.fn()}
    />,
  );
  await screen.findByTestId('gallery-photo-ph://filled');
  if (shown === 'all') {
    await fireEvent.press(screen.getByRole('tab', { name: 'All photos' }));
    await waitFor(() => expect(loadLibraryPhotos).toHaveBeenLastCalledWith(0, expect.any(Number), null));
    await screen.findByTestId('gallery-photo-ph://filled');
  }
  return onPick;
}

describe('Holding a photo in the gallery grid (FR-CAP-02)', () => {
  // The list at the top (750 pt wide): Nov 10's header (36 pt), its row (188), Nov 8's header from y 224,
  // and its row from y 260. Cells are 186 pt, so x 120 is inside the first one.
  const finger = { x: 120, y: 400, absoluteX: 120, absoluteY: 500, translationX: 0, translationY: 0 };

  it('previews the photo large with its date; letting go closes it without picking', async () => {
    const onPick = await openGrid('2026-11-08', 'all');
    const hold = createGestureController('gallery-peek-hold');
    await act(() => {
      hold.begin(finger);
      hold.activate(finger);
    });
    expect(screen.getByRole('image', { name: 'Preview of the photo from Sun, Nov 8 · 9:00 PM' })).toBeTruthy();
    // The full photo from the library, which may come from iCloud, not the cached thumbnail.
    expect(screen.getByTestId('gallery-peek-photo').props.source).toEqual([{ uri: 'ph://filled' }]);
    // It's from the day being filled: header tag plus the preview's.
    expect(screen.getAllByText('Filling')).toHaveLength(2);
    await act(() => hold.end(finger));
    expect(screen.queryByTestId('gallery-peek')).toBeNull();
    expect(libraryPhotoFile).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('opens nothing when held over a day header', async () => {
    await openGrid('2026-11-08', 'all');
    const hold = createGestureController('gallery-peek-hold');
    const header = { ...finger, y: 240 };
    await act(() => {
      hold.begin(header);
      hold.activate(header);
    });
    expect(screen.queryByTestId('gallery-peek')).toBeNull();
  });

  it('a larger preview that fails to load says so and still offers the photo', async () => {
    await openGrid('2026-11-08', 'all');
    const hold = createGestureController('gallery-peek-hold');
    await act(() => {
      hold.begin(finger);
      hold.activate(finger);
    });
    await act(() =>
      fireEvent(screen.getByTestId('gallery-peek-photo'), 'error', { nativeEvent: { error: 'offline' } }),
    );
    expect(screen.getByText('Couldn’t load a bigger preview. You can still use this photo.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this photo' })).toBeTruthy();
  });

  it("VoiceOver's Preview action opens it until Close; Use this photo picks the full-size file", async () => {
    const onPick = await openGrid(null);
    await act(() =>
      fireEvent(screen.getByTestId('gallery-photo-ph://new'), 'accessibilityAction', {
        nativeEvent: { actionName: 'preview' },
      }),
    );
    expect(screen.getByRole('image', { name: 'Preview of the photo from Yesterday · 9:00 AM' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('gallery-peek-close'));
    expect(screen.queryByTestId('gallery-peek')).toBeNull();

    await act(() =>
      fireEvent(screen.getByTestId('gallery-photo-ph://new'), 'accessibilityAction', {
        nativeEvent: { actionName: 'preview' },
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Use this photo' }));
    await act(async () => {});
    expect(screen.queryByTestId('gallery-peek')).toBeNull();
    expect(libraryPhotoFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'ph://new' }), 'Asia/Manila');
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///cache/gallery-1.jpg' }));
  });
});

describe('Only the day being filled (FR-CAP-02)', () => {
  // Manila is UTC+8 all year: Nov 8 runs from Nov 7 16:00 UTC up to Nov 8 16:00 UTC.
  const nov8 = { from: Date.parse('2026-11-07T16:00:00Z'), to: Date.parse('2026-11-08T16:00:00Z') };
  // Every photo in the list, rendered or not (the grid opens scrolled to the day being filled).
  const listedIds = (): string[] =>
    (screen.queryByTestId('gallery-list')?.props.data ?? []).flatMap((item: GalleryItem) =>
      item.kind === 'row' ? item.photos.map((p) => p.id) : [],
    );
  const shownIds = () =>
    screen.queryAllByTestId(/^gallery-photo-/).map((node) => String(node.props.testID).replace('gallery-photo-', ''));

  beforeEach(() => {
    library = [
      at('2026-11-10T09:00:00+08:00', 'ph://new'),
      at('2026-11-09T00:10:00+08:00', 'ph://after'), // 10 minutes into Nov 9
      at('2026-11-08T23:50:00+08:00', 'ph://late'), // 10 minutes before Nov 8 ends
      at('2026-11-08T21:00:00+08:00', 'ph://filled'),
      at('2026-11-08T00:10:00+08:00', 'ph://early'), // 10 minutes into Nov 8
      at('2026-11-07T23:50:00+08:00', 'ph://before'), // 10 minutes before Nov 8 starts
    ];
  });

  it('starts on only that day, asked of the library by its local midnights', async () => {
    await openGrid('2026-11-08');
    const only = screen.getByRole('tab', { name: 'Only Nov 8' });
    expect(only.props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('tab', { name: 'All photos' }).props.accessibilityState).toEqual({ selected: false });
    expect(loadLibraryPhotos).toHaveBeenCalledTimes(1);
    expect(loadLibraryPhotos).toHaveBeenCalledWith(0, expect.any(Number), nov8);
    // Exactly the Nov 8 section, newest first: 23:50 is in, 00:10 the next day is not.
    expect(shownIds()).toEqual(['ph://late', 'ph://filled', 'ph://early']);
    expect(screen.getAllByRole('header', { name: 'Sun, Nov 8, the day you’re filling' })).toHaveLength(1);
  });

  it('All photos goes back to every day, and Only Nov 8 again to the one day', async () => {
    await openGrid('2026-11-08');
    await fireEvent.press(screen.getByRole('tab', { name: 'All photos' }));
    await waitFor(() => expect(listedIds()).toHaveLength(6));
    expect(loadLibraryPhotos).toHaveBeenLastCalledWith(0, expect.any(Number), null);
    expect(screen.getByRole('tab', { name: 'All photos' }).props.accessibilityState).toEqual({ selected: true });
    // Every day again, Nov 8 still where the grid opens and tagged Filling.
    expect(listedIds()).toEqual(['ph://new', 'ph://after', 'ph://late', 'ph://filled', 'ph://early', 'ph://before']);
    expect(screen.getByTestId('gallery-list').props.initialScrollIndex).toBe(4);

    await fireEvent.press(screen.getByRole('tab', { name: 'Only Nov 8' }));
    await waitFor(() => expect(listedIds()).toEqual(['ph://late', 'ph://filled', 'ph://early']));
    expect(screen.getByRole('tab', { name: 'Only Nov 8' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('a day without photos says so and offers all photos', async () => {
    await render(
      <GalleryGrid
        access="all"
        tz="Asia/Manila"
        target="2026-11-05"
        insets={insets}
        onPick={jest.fn()}
        onClose={jest.fn()}
        onUnavailable={jest.fn()}
      />,
    );
    expect(await screen.findByText('No photos from Nov 5.')).toBeTruthy();
    expect(shownIds()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Show all photos' }));
    await screen.findByTestId('gallery-photo-ph://new');
    expect(screen.getByRole('tab', { name: 'All photos' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByText('No photos from Nov 5.')).toBeNull();
  });

  it("isn't offered when choosing for today's jar", async () => {
    await openGrid(null);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(loadLibraryPhotos).toHaveBeenCalledWith(0, expect.any(Number), null);
    expect(shownIds()).toHaveLength(6);
  });
});
