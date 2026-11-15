import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { GalleryGrid } from '../GalleryGrid';
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
  jest
    .mocked(loadLibraryPhotos)
    .mockResolvedValue([at('2026-11-10T09:00:00+08:00', 'ph://new'), at('2026-11-08T21:00:00+08:00', 'ph://filled')]);
  jest.mocked(libraryPhotoFile).mockReset();
  jest
    .mocked(libraryPhotoFile)
    .mockResolvedValue({ uri: 'file:///cache/gallery-1.jpg', width: 3024, height: 4032, exif: null });
});

afterEach(() => jest.useRealTimers());

async function openGrid(target: string | null = '2026-11-08') {
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
  return onPick;
}

describe('Holding a photo in the gallery grid (FR-CAP-02)', () => {
  // The list at the top (750 pt wide): Nov 10's header (36 pt), its row (188), Nov 8's header from y 224,
  // and its row from y 260. Cells are 186 pt, so x 120 is inside the first one.
  const finger = { x: 120, y: 400, absoluteX: 120, absoluteY: 500, translationX: 0, translationY: 0 };

  it('previews the photo large with its date; letting go closes it without picking', async () => {
    const onPick = await openGrid();
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
    await openGrid();
    const hold = createGestureController('gallery-peek-hold');
    const header = { ...finger, y: 240 };
    await act(() => {
      hold.begin(header);
      hold.activate(header);
    });
    expect(screen.queryByTestId('gallery-peek')).toBeNull();
  });

  it('a larger preview that fails to load says so and still offers the photo', async () => {
    await openGrid();
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
