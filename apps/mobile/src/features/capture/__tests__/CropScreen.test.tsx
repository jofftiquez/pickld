// Gesture-handler's own jest mocks for its native module (not in the shared jest setup).
import 'react-native-gesture-handler/jestSetup';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import '../../edit/__tests__/mockReanimated';
import type { ReactNode } from 'react';
import * as Haptics from 'expo-haptics';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import CropScreen from '../../../../app/crop';
import { CROP_RATIO, cropFrame, cropRectFor, initialCrop, MOMENT_CROP_SHEET_HEIGHT } from '../cropMath';
import { usePendingCrop, type PendingCrop } from '../pendingCrop';
import { saveGalleryPhoto } from '../saveCapture';
import { captureError } from '@/lib/monitoring';
import { prepareItem } from '@/lib/queue/prepare';
import type { QueueItem } from '@/lib/queue/store';
import { cropProfilePhoto, useProfileCrop } from '@/features/profile/profileCrop';
import type { ProfileCrop } from '@/lib/image/profileImage';
import { crop, space } from '@/theme/tokens';

// Crop screen (FR-CAP-03, FR-CAP-02; design: Crop): buttons, gestures and the zoom slider change what Done
// queues; Reset undoes; Fill / Fit (D-152) and the frame styles reach the queued crop; Cancel returns to the camera with nothing queued; Done queues the raw photo
// with the crop through the queue-first path and opens the editor. saveGalleryPhoto has its own test.
jest.mock('../saveCapture', () => ({ saveGalleryPhoto: jest.fn() }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
jest.mock('@/lib/queue/prepare', () => ({ prepareItem: jest.fn() }));
const mockStorage = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => void mockStorage.set(key, value),
  },
}));

const userId = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
const image = { width: 4000, height: 2000 };
const pending: PendingCrop = {
  photo: { uri: 'file:///picker/beach.jpg', ...image, exif: null },
  slot: 'afternoon',
  userId,
  target: { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-08T19:30:00+08:00' },
};
// The test renderer has no safe areas, so the screen sizes the frame with zero insets.
// A moment's sheet has the Fill / Fit row (D-152).
const frame = () =>
  cropFrame(Dimensions.get('window'), { top: 0, bottom: 0 }, CROP_RATIO.moment, MOMENT_CROP_SHEET_HEIGHT);
// The frame's left edge in the photo area, which spans the window.
const frameLeft = () => (Dimensions.get('window').width - frame().width) / 2;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => (
    <View>
      <Text>Today stub</Text>
    </View>
  ),
  camera: () => (
    <View>
      <Text>Camera stub</Text>
    </View>
  ),
  crop: CropScreen,
  'edit/[momentId]': function EditStub() {
    const { momentId } = useLocalSearchParams<{ momentId: string }>();
    return (
      <View>
        <Text>Editor stub {String(momentId)}</Text>
      </View>
    );
  },
};

async function openCrop() {
  await renderRouter(routes, { initialUrl: '/camera', wrapper });
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push('/crop');
  });
  expect(screen).toHavePathname('/crop');
}

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
async function done() {
  await press('Next: edit');
  await act(async () => {});
}
const queuedCrop = () => jest.mocked(saveGalleryPhoto).mock.calls.at(-1)?.[0].crop;

beforeEach(() => {
  // Evening of Nov 8 in Manila: the pending photo's jar day is today.
  jest.useFakeTimers({ now: new Date('2026-11-08T12:00:00Z'), advanceTimers: true });
  mockStorage.clear();
  usePendingCrop.setState({ pending });
  jest.mocked(saveGalleryPhoto).mockReset();
  jest
    .mocked(saveGalleryPhoto)
    .mockImplementation(async () => ({ id: 9 }) as Awaited<ReturnType<typeof saveGalleryPhoto>>);
  jest.mocked(captureError).mockClear();
  jest.mocked(prepareItem).mockReset();
  jest.mocked(prepareItem).mockImplementation(async (item) => ({ ...item, prepared: true }));
});

afterEach(() => jest.useRealTimers());

describe('Crop screen', () => {
  // D-156: a photo for a past day's jar names that day; the photo was shot on another day still (Nov 2), so
  // using its shot date would fail.
  it('names the past day being filled: "#afternoon · for Thu, Nov 5"', async () => {
    usePendingCrop.setState({
      pending: {
        ...pending,
        target: { localDate: '2026-11-05', tz: 'Asia/Manila', capturedAt: '2026-11-02T09:00:00+08:00' },
      },
    });
    await openCrop();
    expect(screen.getByText('#afternoon · for Thu, Nov 5')).toBeTruthy();
    expect(screen.queryByText(/from gallery/)).toBeNull();
    expect(screen.queryByText(/Nov 2/)).toBeNull();
  });

  it('a photo for today’s jar keeps "from gallery", even when it was shot on an earlier day', async () => {
    usePendingCrop.setState({
      pending: {
        ...pending,
        target: { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-04T09:00:00+08:00' },
      },
    });
    await openCrop();
    expect(screen.getByText('#afternoon · from gallery')).toBeTruthy();
    expect(screen.queryByText(/ for /)).toBeNull();
  });

  it('shows the design: title, slot, 3:4 lock chip, grid frame, hint, zoom and tools', async () => {
    await openCrop();
    expect(screen.getByRole('header', { name: 'Crop photo' })).toBeTruthy();
    expect(screen.getByText('#afternoon · from gallery')).toBeTruthy();
    expect(screen.getByLabelText('Crop locked to 3:4')).toBeTruthy();
    expect(screen.getByTestId('crop-frame', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Drag to reposition · pinch to zoom')).toBeTruthy();
    expect(screen.getByRole('adjustable', { name: 'Zoom' }).props.accessibilityValue).toMatchObject({
      min: 100,
      max: 300,
      now: 100,
    });
    for (const name of ['Cancel', 'Reset', 'Rotate 90 degrees', 'Flip', 'Next: edit']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByLabelText('Fill or fit the 3:4 frame')).toBeTruthy();
    expect(screen.getByText('Every Pickld moment is 3:4, so your jars always line up.')).toBeTruthy();
  });

  it('puts Next: edit in the header as a pill (D-65); Rotate, Flip and Reset down the frame’s top right (D-158)', async () => {
    await openCrop();
    const header = screen.getByTestId('crop-header');
    expect(within(header).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Next: edit' }).props.accessibilityHint).toBe(
      'Adds the photo to #afternoon and opens the editor',
    );
    expect(within(header).queryByRole('button', { name: 'Reset' })).toBeNull();
    // A column of round glass buttons over the photo, as in the editor; none of them in the sheet any more.
    const column = screen.getByTestId('crop-tools');
    expect(column).toHaveStyle({
      position: 'absolute',
      top: crop.frameInsetY + space.md,
      right: frameLeft() + space.md,
    });
    const tools = within(column).getAllByRole('button');
    expect(tools.map((tool) => tool.props.accessibilityLabel)).toEqual(['Rotate 90 degrees', 'Flip', 'Reset']);
    expect(within(column).getAllByTestId('glass')).toHaveLength(3);
    expect(tools.map((tool) => tool.props.accessibilityHint)).toEqual([
      undefined,
      'Mirrors the photo left to right',
      'Undoes every change to the crop',
    ]);
    const sheet = screen.getByTestId('crop-sheet');
    for (const name of ['Rotate 90 degrees', 'Flip', 'Reset']) {
      expect(within(sheet).queryByRole('button', { name })).toBeNull();
    }
    // The drawn frame is the one Done crops to.
    const drawn = screen.getByTestId('crop-frame', { includeHiddenElements: true });
    expect(drawn).toHaveStyle({ width: frame().width, height: frame().height });
  });

  it('disables the header button while the photo is being added', async () => {
    let finish: (value: Awaited<ReturnType<typeof saveGalleryPhoto>>) => void = () => {};
    jest.mocked(saveGalleryPhoto).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await openCrop();
    await press('Next: edit');
    expect(screen.getByRole('button', { name: 'Next: edit' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await act(async () => finish({ id: 9 } as Awaited<ReturnType<typeof saveGalleryPhoto>>));
    expect(screen).toHavePathname('/edit/9');
  });

  it('Done waits for the cropped file before opening the editor, so the editor draws the frame chosen here (D-150)', async () => {
    let finish: (value: QueueItem) => void = () => {};
    jest.mocked(prepareItem).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await openCrop();
    await done();
    // Queued (rule 3), but the raw photo is not what the editor may draw: still on Crop, Done busy.
    expect(prepareItem).toHaveBeenCalledWith({ id: 9 });
    expect(screen).toHavePathname('/crop');
    expect(screen.getByRole('button', { name: 'Next: edit' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    await act(async () => finish({ id: 9, prepared: true } as QueueItem));
    expect(screen).toHavePathname('/edit/9');
  });

  it('if preparing fails, the queued photo still opens in the editor and the error is reported', async () => {
    jest.mocked(prepareItem).mockRejectedValueOnce(new Error('decode failed'));
    await openCrop();
    await done();
    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'decode failed' }), {
      area: 'gallery',
    });
    expect(screen).toHavePathname('/edit/9');
  });

  it('Done right away queues the centred 3:4 crop with the slot and gallery date, then opens the editor', async () => {
    await openCrop();
    await done();
    expect(saveGalleryPhoto).toHaveBeenCalledTimes(1);
    expect(saveGalleryPhoto).toHaveBeenCalledWith({
      uri: 'file:///picker/beach.jpg',
      slot: 'afternoon',
      userId,
      target: pending.target,
      crop: { crop: cropRectFor(initialCrop, image, frame()), cropBasis: image, rotate: 0, flip: false },
      // No profile cached here: the moment takes the owner's default on the server (D-48).
      visibility: null,
    });
    expect(queuedCrop()?.crop).toMatchObject({ originY: 0, height: 2000, width: 1500, originX: 1250 });
    expect(screen).toHavePathname('/edit/9');
    expect(usePendingCrop.getState().pending).toBeNull();
  });

  it('Rotate turns a quarter each press and Flip mirrors; both reach the queued crop', async () => {
    await openCrop();
    await press('Rotate 90 degrees');
    await press('Rotate 90 degrees');
    await press('Rotate 90 degrees');
    await press('Flip');
    const photo = screen.getByTestId('crop-photo');
    expect(photo.props.style).toMatchObject({ transform: [{ scaleX: -1 }, { rotate: '270deg' }] });
    await done();
    expect(queuedCrop()).toMatchObject({ rotate: 270, flip: true });
    // Turned, the 2:1 photo is tall: the full width is kept.
    expect(queuedCrop()?.crop).toMatchObject({ originX: 0, width: 2000 });
  });

  it('dragging moves the frame over the photo, clamped at the edge', async () => {
    await openCrop();
    const pan = createGestureController('crop-pan');
    await act(() => {
      pan.begin({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.activate({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.update({ x: 5000, y: 100, translationX: 4900, translationY: 0 });
      pan.end({ x: 5000, y: 100, translationX: 4900, translationY: 0 });
    });
    await done();
    // Dragged right as far as it goes: the photo's left edge.
    expect(queuedCrop()?.crop).toMatchObject({ originX: 0, originY: 0, width: 1500, height: 2000 });
  });

  it('pinching zooms in, up to 3×', async () => {
    await openCrop();
    const pinch = createGestureController('crop-pinch');
    await act(() => {
      pinch.begin({ focalX: 100, focalY: 100, scale: 1 });
      pinch.activate({ focalX: 100, focalY: 100, scale: 1 });
      pinch.update({ focalX: 100, focalY: 100, scale: 8 });
      pinch.end({ focalX: 100, focalY: 100, scale: 8 });
    });
    expect(screen.getByRole('adjustable', { name: 'Zoom' }).props.accessibilityValue.now).toBe(300);
    // Zoomed in, the preview still draws the full-resolution photo, not one shrunk to the starting size.
    expect(screen.getByTestId('crop-photo').props).toMatchObject({ allowDownscaling: false, cachePolicy: 'memory' });
    await done();
    expect(queuedCrop()?.crop).toMatchObject({ width: 500, originX: 1750 });
  });

  it('the zoom slider steps with a screen reader; Rotate starts again from zoom 1', async () => {
    await openCrop();
    const slider = screen.getByRole('adjustable', { name: 'Zoom' });
    await act(() => slider.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    await act(() =>
      screen.getByRole('adjustable', { name: 'Zoom' }).props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      }),
    );
    expect(screen.getByRole('adjustable', { name: 'Zoom' }).props.accessibilityValue.now).toBe(120);
    await press('Rotate 90 degrees');
    expect(screen.getByRole('adjustable', { name: 'Zoom' }).props.accessibilityValue.now).toBe(100);
    await done();
    expect(queuedCrop()).toMatchObject({ rotate: 90, flip: false });
  });

  it('Reset undoes every change', async () => {
    await openCrop();
    await press('Rotate 90 degrees');
    await press('Flip');
    await act(() =>
      screen.getByRole('adjustable', { name: 'Zoom' }).props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      }),
    );
    await press('Reset');
    await done();
    expect(queuedCrop()).toEqual({
      crop: cropRectFor(initialCrop, image, frame()),
      cropBasis: image,
      rotate: 0,
      flip: false,
    });
  });

  it('Cancel returns to the camera and queues nothing', async () => {
    await openCrop();
    await press('Cancel');
    expect(screen).toHavePathname('/camera');
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
    expect(usePendingCrop.getState().pending).toBeNull();
  });

  it('a queueing failure is reported, stays on Crop and lets the user try again', async () => {
    jest.mocked(saveGalleryPhoto).mockRejectedValueOnce(new Error('disk full'));
    await openCrop();
    await done();
    expect(captureError).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk full' }), { area: 'gallery' });
    expect(screen).toHavePathname('/crop');
    expect(screen.getByText('Couldn’t add this photo. Try again.')).toBeTruthy();
    await done();
    expect(screen).toHavePathname('/edit/9');
  });

  it('opened without a photo (deep link) leaves for Today', async () => {
    usePendingCrop.setState({ pending: null });
    await renderRouter(routes, { initialUrl: '/crop', wrapper });
    await act(async () => {});
    expect(screen).toHavePathname('/today');
  });
});

// Edit profile's photos (D-79): /crop?mode=avatar|cover, pan and zoom only. Done hands the frame back to
// Edit profile (which prepares and uploads it); Cancel hands back nothing.
describe('Fill / Fit (D-152)', () => {
  const tab = (name: 'Fill' | 'Fit') => screen.getByRole('tab', { name });
  const swatch = (name: string) => screen.getByRole('radio', { name });

  it('every photo opens on Fill, portrait and landscape alike: the zoom slider shows, no frame styles', async () => {
    for (const size of [image, { width: 2000, height: 4000 }]) {
      usePendingCrop.setState({ pending: { ...pending, photo: { ...pending.photo, ...size } } });
      await openCrop();
      expect(tab('Fill').props.accessibilityState).toEqual({ selected: true });
      expect(tab('Fit').props.accessibilityState).toEqual({ selected: false });
      expect(screen.getByRole('adjustable', { name: 'Zoom' })).toBeTruthy();
      expect(screen.queryByRole('radiogroup', { name: 'Frame style' })).toBeNull();
      await done();
      expect(queuedCrop()).not.toHaveProperty('fit');
    }
  });

  it('Fit is a layout, not a crop (D-154): no crop chrome, the whole photo centred, Frame / Border / Corners tabs', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    expect(tab('Fit').props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByRole('adjustable', { name: 'Zoom' })).toBeNull();
    // No frame outline, thirds grid, corner marks or lock chip over the photo.
    expect(screen.queryByTestId('crop-frame', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByLabelText('Crop locked to 3:4')).toBeNull();
    expect(screen.getByText('Drag to move · pinch to resize · double tap to center')).toBeTruthy();
    for (const [name, selected] of [
      ['Frame', true],
      ['Border', false],
      ['Corners', false],
    ] as const) {
      expect(screen.getByRole('tab', { name }).props.accessibilityState).toEqual({ selected });
    }
    const names = ['white', 'off-white', 'cream', 'black', 'blurred photo'].map((n) => `Fit, ${n} frame`);
    for (const name of names) {
      expect(swatch(name)).toHaveStyle({ width: 44, height: 44 });
    }
    expect(swatch('Fit, white frame').props.accessibilityState).toEqual({ checked: true });
    // The 2:1 photo, contained: as wide as the frame, half as tall, centred on the white backdrop.
    const f = frame();
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({
      width: f.width,
      height: f.width / 2,
      top: 48 + (f.height - f.width / 2) / 2,
      borderRadius: 0,
    });
    expect(screen.getByTestId('crop-fit-box')).not.toHaveStyle({ backgroundColor: '#ffffff' });
    expect(screen.getByTestId('crop-fit-backdrop-white')).toHaveStyle({ width: f.width, height: f.height });
    // Fill has none of this.
    await fireEvent.press(tab('Fill'));
    expect(screen.queryByLabelText('Fit options')).toBeNull();
    expect(screen.getByTestId('crop-frame', { includeHiddenElements: true })).toBeTruthy();
  });

  it('a chosen frame style reaches the queued crop, and is remembered for the next photo', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    await fireEvent.press(swatch('Fit, cream frame'));
    expect(swatch('Fit, cream frame').props.accessibilityState).toEqual({ checked: true });
    expect(swatch('Fit, white frame').props.accessibilityState).toEqual({ checked: false });
    await done();
    expect(queuedCrop()).toMatchObject({ rotate: 0, flip: false, fit: { frame: 'cream' } });
    expect(mockStorage.get('crop:fitFrame')).toBe('cream');

    usePendingCrop.setState({ pending });
    await openCrop();
    // The next photo still opens on Fill; its Fit starts on cream.
    expect(tab('Fill').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(tab('Fit'));
    expect(swatch('Fit, cream frame').props.accessibilityState).toEqual({ checked: true });
  });

  const drag = async (dx: number, dy: number) => {
    const pan = createGestureController('crop-pan');
    await act(() => {
      pan.begin({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.activate({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.update({ x: 100 + dx, y: 100 + dy, translationX: dx, translationY: dy });
      pan.end({ x: 100 + dx, y: 100 + dy, translationX: dx, translationY: dy });
    });
  };
  const pinchTo = async (scale: number) => {
    const pinch = createGestureController('crop-pinch');
    await act(() => {
      pinch.begin({ focalX: 100, focalY: 100, scale: 1 });
      pinch.activate({ focalX: 100, focalY: 100, scale: 1 });
      pinch.update({ focalX: 100, focalY: 100, scale });
      pinch.end({ focalX: 100, focalY: 100, scale });
    });
  };
  const doubleTap = async () => {
    const tapper = createGestureController('crop-double-tap');
    await act(() => {
      tapper.begin({ x: 100, y: 100 });
      tapper.activate({ x: 100, y: 100 });
      tapper.end({ x: 100, y: 100 });
    });
  };

  it('in Fit, drag moves the photo and pinch makes it smaller, always whole inside the frame (D-154)', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    const f = frame();
    // At full size the 2:1 photo spans the frame's width: it only moves up and down, at most to the bottom edge.
    await drag(5000, 5000);
    const bottom = (f.height - f.width / 2) / 2 / f.height;
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({ left: frameLeft(), top: 48 + f.height - f.width / 2 });
    // Pinched past the smallest: 30% of the size that fits. Pinched up again: never past whole.
    await pinchTo(0.01);
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({ width: f.width * 0.3 });
    await pinchTo(50);
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({ width: f.width });
    // Half size, then dragged far left: the photo stops at the frame's left edge, a quarter of the frame from centre.
    await pinchTo(0.5);
    await drag(-5000, 0);
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({ left: frameLeft(), width: f.width / 2 });
    await done();
    const fit = queuedCrop()?.fit;
    expect(fit).toMatchObject({ frame: 'white', scale: 0.5, border: 'none', corners: 'none' });
    expect(fit?.x).toBeCloseTo(-0.25, 9);
    // Made smaller, it kept the place it was dragged to: still against the bottom edge it reached at full size.
    expect(fit?.y).toBeCloseTo(bottom, 9);
  });

  it('a double tap or Reset puts the photo back whole and centred; Reset stays on Fit', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    await pinchTo(0.5);
    await drag(-5000, -5000);
    await doubleTap();
    const f = frame();
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({
      left: frameLeft(),
      width: f.width,
      top: 48 + (f.height - f.width / 2) / 2,
    });
    await pinchTo(0.5);
    await press('Rotate 90 degrees');
    await press('Reset');
    expect(tab('Fit').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'Reset' }).props.accessibilityHint).toBe(
      'Puts the photo back whole and centered, unturned',
    );
    await done();
    expect(queuedCrop()).toMatchObject({ rotate: 0, fit: { scale: 1, x: 0, y: 0 } });
  });

  // D-158: dragged near the frame's centre, the photo's centre snaps to it across and/or down, with a guide line and
  // a tick; it lets go only 1.5 × the threshold away. Half size, so the 2:1 photo can move both ways.
  describe('centre snap in Fit', () => {
    const guide = (axis: 'vertical' | 'horizontal') =>
      screen.getByTestId(`crop-snap-${axis}`, { includeHiddenElements: true });
    const guides = () => ({
      vertical: StyleSheet.flatten(guide('vertical').props.style).opacity,
      horizontal: StyleSheet.flatten(guide('horizontal').props.style).opacity,
    });
    // One drag through these points (offsets in points from where the photo started: the frame's centre).
    const dragThrough = async (points: [number, number][], check?: (step: number) => void) => {
      const pan = createGestureController('crop-pan');
      await act(() => {
        pan.begin({ x: 100, y: 100, translationX: 0, translationY: 0 });
        pan.activate({ x: 100, y: 100, translationX: 0, translationY: 0 });
      });
      for (const [i, [dx, dy]] of points.entries()) {
        await act(() => pan.update({ x: 100 + dx, y: 100 + dy, translationX: dx, translationY: dy }));
        check?.(i);
      }
      const [dx, dy] = points.at(-1) ?? [0, 0];
      await act(() => pan.end({ x: 100 + dx, y: 100 + dy, translationX: dx, translationY: dy }));
    };
    const openHalf = async () => {
      await openCrop();
      await fireEvent.press(tab('Fit'));
      await pinchTo(0.5);
      jest.mocked(Haptics.selectionAsync).mockClear();
    };

    it('a drag ending within 6 points of the centre lands exactly centred, as a double tap does', async () => {
      await openHalf();
      expect(guides()).toEqual({ vertical: 0, horizontal: 0 });
      // Moved away first, then back to 4 points right and 5 up of the centre.
      await dragThrough([[60, 40]]);
      const seen: ReturnType<typeof guides>[] = [];
      await dragThrough([[-56, -45]], () => seen.push(guides()));
      expect(seen).toEqual([{ vertical: 1, horizontal: 1 }]);
      // Both axes snapped in on the same step: one tick.
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
      // The guides go when the finger lifts; the preview is exactly centred.
      expect(guides()).toEqual({ vertical: 0, horizontal: 0 });
      const f = frame();
      expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({
        left: frameLeft() + f.width / 4,
        top: 48 + (f.height - f.width / 4) / 2,
      });
      await done();
      const fit = queuedCrop()?.fit;
      expect(fit?.x).toBe(0);
      expect(fit?.y).toBe(0);
    });

    it('holds the snap up to 9 points, lets go past it, and snaps again only within 6', async () => {
      await openHalf();
      const shown: number[] = [];
      // Across: 40 away, 4 (snaps in), 8 and 9 (held), 10 (lets go), 7 (not again: outside 6). Down: 30 away.
      await dragThrough(
        [
          [40, 30],
          [4, 30],
          [8, 30],
          [9, 30],
          [10, 30],
          [7, 30],
        ],
        () => shown.push(guides().vertical),
      );
      expect(shown).toEqual([0, 1, 1, 1, 0, 0]);
      expect(guides().horizontal).toBe(0);
      // A tick when it snapped in; none when it let go.
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
      await done();
      const f = frame();
      const fit = queuedCrop()?.fit;
      expect(fit?.x).toBeCloseTo(7 / f.width, 9);
      expect(fit?.y).toBeCloseTo(30 / f.height, 9);
    });

    it('no guide on an axis the photo spans: at full size it is always centred across', async () => {
      await openCrop();
      await fireEvent.press(tab('Fit'));
      jest.mocked(Haptics.selectionAsync).mockClear();
      const shown: ReturnType<typeof guides>[] = [];
      await dragThrough([[2, 40]], () => shown.push(guides()));
      expect(shown).toEqual([{ vertical: 0, horizontal: 0 }]);
      expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    });
  });

  it('a double tap does nothing in Fill; Fit’s moves leave Fill’s crop as it was', async () => {
    await openCrop();
    const slider = () => screen.getByRole('adjustable', { name: 'Zoom' });
    await act(() => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    await doubleTap();
    expect(slider().props.accessibilityValue.now).toBe(110);
    await fireEvent.press(tab('Fit'));
    await drag(4900, 0);
    await pinchTo(0.5);
    await fireEvent.press(tab('Fill'));
    expect(slider().props.accessibilityValue.now).toBe(110);
    await done();
    // Zoomed to 110% about the centre and not dragged.
    expect(queuedCrop()?.crop).toEqual(cropRectFor({ ...initialCrop, zoom: 1.1 }, image, frame()));
    expect(queuedCrop()).not.toHaveProperty('fit');
  });

  it('Border: none by default; widths and colours as labelled radios; the preview and queued crop follow', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    await fireEvent.press(screen.getByRole('tab', { name: 'Border' }));
    expect(screen.getByLabelText('Border width')).toBeTruthy();
    expect(screen.getByLabelText('Border color')).toBeTruthy();
    const widths = ['no', 'thin', 'medium', 'thick'].map((n) => `Fit, ${n} border`);
    for (const name of widths) expect(swatch(name)).toHaveStyle({ width: 44, height: 44 });
    expect(swatch('Fit, no border').props.accessibilityState).toEqual({ checked: true });
    // With no border, no colour shows as chosen; picking one adds a thin border.
    for (const name of ['white', 'cream', 'black']) {
      expect(swatch(`Fit, ${name} border`).props.accessibilityState).toEqual({ checked: false });
    }
    await fireEvent.press(swatch('Fit, cream border'));
    expect(swatch('Fit, thin border').props.accessibilityState).toEqual({ checked: true });
    expect(swatch('Fit, cream border').props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(swatch('Fit, thick border'));
    await fireEvent.press(swatch('Fit, black border'));
    const f = frame();
    // Thick: 24 / 480 of the frame's width on every side, in black, around the photo (smaller to make room).
    const border = (24 / 480) * f.width;
    expect(screen.getByTestId('crop-fit-box')).toHaveStyle({ backgroundColor: '#000000', width: f.width });
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({
      left: frameLeft() + border,
      width: f.width - border * 2,
    });
    await done();
    expect(queuedCrop()?.fit).toMatchObject({ border: 'thick', borderColor: 'black' });
  });

  it('Corners: square by default; rounded corners on the photo and its border; remembered with the look', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    await fireEvent.press(screen.getByRole('tab', { name: 'Corners' }));
    expect(screen.getByLabelText('Corner shape')).toBeTruthy();
    const names = ['square', 'small rounded', 'medium rounded', 'large rounded'].map((n) => `Fit, ${n} corners`);
    for (const name of names) expect(swatch(name)).toHaveStyle({ width: 44, height: 44 });
    expect(swatch('Fit, square corners').props.accessibilityState).toEqual({ checked: true });
    await fireEvent.press(swatch('Fit, medium rounded corners'));
    expect(swatch('Fit, medium rounded corners').props.accessibilityState).toEqual({ checked: true });
    const f = frame();
    expect(screen.getByTestId('crop-fit-photo')).toHaveStyle({ borderRadius: (30 / 480) * f.width });
    await fireEvent.press(screen.getByRole('tab', { name: 'Border' }));
    await fireEvent.press(swatch('Fit, medium border'));
    // The border's outer corners are the photo's plus the border, so it is even all round.
    expect(StyleSheet.flatten(screen.getByTestId('crop-fit-box').props.style).borderRadius).toBeCloseTo(
      (42 / 480) * f.width,
      9,
    );
    await pinchTo(0.6);
    await done();
    expect(queuedCrop()?.fit).toMatchObject({ corners: 'medium', border: 'medium', borderColor: 'white', scale: 0.6 });
    expect(mockStorage.get('crop:fitCorners')).toBe('medium');
    expect(mockStorage.get('crop:fitBorder')).toBe('medium');

    // The next photo keeps the look but starts whole and centred.
    usePendingCrop.setState({ pending });
    await openCrop();
    await fireEvent.press(tab('Fit'));
    await done();
    expect(queuedCrop()?.fit).toMatchObject({ corners: 'medium', border: 'medium', scale: 1, x: 0, y: 0 });
  });

  it('Rotate and Flip still apply in Fit and reach the queued crop', async () => {
    await openCrop();
    await fireEvent.press(tab('Fit'));
    await press('Rotate 90 degrees');
    await press('Flip');
    // Turned, the 2:1 photo is 1:2: as tall as the frame (its unturned view is sized before the turn).
    const f = frame();
    expect(screen.getByTestId('crop-photo').props.style).toMatchObject({
      width: f.height,
      height: f.height / 2,
      transform: [{ scaleX: -1 }, { rotate: '90deg' }],
    });
    await done();
    expect(queuedCrop()).toMatchObject({ rotate: 90, flip: true, fit: { frame: 'white' } });
  });
});

describe('Crop screen for profile photos', () => {
  const photo = { uri: 'file:///picker/portrait.jpg', width: 3000, height: 4000 };
  const profileRoutes = {
    ...routes,
    'settings/profile': () => (
      <View>
        <Text>Edit profile stub</Text>
      </View>
    ),
  };
  const shapeFrame = (kind: 'avatar' | 'cover') =>
    cropFrame(Dimensions.get('window'), { top: 0, bottom: 0 }, CROP_RATIO[kind]);

  async function openProfileCrop(kind: 'avatar' | 'cover') {
    await renderRouter(profileRoutes, { initialUrl: '/settings/profile', wrapper });
    let result: Promise<ProfileCrop | null> = Promise.resolve(null);
    await act(async () => {
      result = cropProfilePhoto(photo, kind);
    });
    expect(screen).toHavePathname('/crop');
    // Wrapped, so awaiting the opening doesn't wait for the crop's answer.
    return { result };
  }

  beforeEach(() => {
    usePendingCrop.setState({ pending: null });
    useProfileCrop.setState({ request: null });
  });

  it('avatar: a square frame under a circle guide, pan and zoom only', async () => {
    await openProfileCrop('avatar');
    expect(screen.getByText('Profile photo')).toBeTruthy();
    expect(screen.getByLabelText('Crop locked to a square')).toBeTruthy();
    const drawn = screen.getByTestId('crop-frame', { includeHiddenElements: true });
    const square = shapeFrame('avatar');
    expect(square.width).toBe(square.height);
    expect(drawn).toHaveStyle({ width: square.width, height: square.height });
    expect(screen.getByTestId('crop-circle', { includeHiddenElements: true })).toBeTruthy();
    for (const name of ['Rotate 90 degrees', 'Flip']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Fit' })).toBeNull();
    for (const name of ['Cancel', 'Reset', 'Use photo']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('adjustable', { name: 'Zoom' })).toBeTruthy();
    expect(screen.queryByText('#afternoon · from gallery')).toBeNull();
    // Reset alone at the square's top right corner (D-158).
    const column = screen.getByTestId('crop-tools');
    expect(
      within(column)
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel),
    ).toEqual(['Reset']);
    expect(column).toHaveStyle({ right: (Dimensions.get('window').width - square.width) / 2 + space.md });
  });

  it('Reset at the corner puts a dragged profile photo back in the middle', async () => {
    const { result } = await openProfileCrop('avatar');
    const pan = createGestureController('crop-pan');
    await act(() => {
      pan.begin({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.activate({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.update({ x: 100, y: 5000, translationX: 0, translationY: 4900 });
      pan.end({ x: 100, y: 5000, translationX: 0, translationY: 4900 });
    });
    await press('Reset');
    await press('Use photo');
    await act(async () => {});
    await expect(result).resolves.toEqual({
      rect: { originX: 0, originY: 500, width: 3000, height: 3000 },
      basis: { width: 3000, height: 4000 },
    });
  });

  it('cover: the 5:2 frame, no circle guide', async () => {
    await openProfileCrop('cover');
    expect(screen.getByText('Cover photo')).toBeTruthy();
    expect(screen.getByLabelText('Crop locked to 5:2')).toBeTruthy();
    const band = shapeFrame('cover');
    expect(band.width / band.height).toBeCloseTo(2.5);
    const drawn = screen.getByTestId('crop-frame', { includeHiddenElements: true });
    expect(drawn).toHaveStyle({ width: band.width, height: band.height });
    expect(screen.queryByTestId('crop-circle', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rotate 90 degrees' })).toBeNull();
  });

  it('Done hands back the chosen square in the picker’s pixels and returns to Edit profile', async () => {
    const { result } = await openProfileCrop('avatar');
    const pan = createGestureController('crop-pan');
    await act(() => {
      pan.begin({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.activate({ x: 100, y: 100, translationX: 0, translationY: 0 });
      pan.update({ x: 100, y: 5000, translationX: 0, translationY: 4900 });
      pan.end({ x: 100, y: 5000, translationX: 0, translationY: 4900 });
    });
    await press('Use photo');
    await act(async () => {});
    // Dragged down as far as it goes: the top of the portrait photo, full width.
    await expect(result).resolves.toEqual({
      rect: { originX: 0, originY: 0, width: 3000, height: 3000 },
      basis: { width: 3000, height: 4000 },
    });
    expect(screen).toHavePathname('/settings/profile');
    expect(useProfileCrop.getState().request).toBeNull();
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
  });

  it('Done right away on a cover hands back the centred 5:2 band', async () => {
    const { result } = await openProfileCrop('cover');
    await press('Use photo');
    await act(async () => {});
    const band = cropRectFor(initialCrop, photo, shapeFrame('cover'), CROP_RATIO.cover);
    expect(band).toEqual({ originX: 0, originY: 1400, width: 3000, height: 1200 });
    await expect(result).resolves.toEqual({ rect: band, basis: { width: 3000, height: 4000 } });
  });

  it('Cancel hands back nothing and returns to Edit profile', async () => {
    const { result } = await openProfileCrop('avatar');
    await press('Cancel');
    await act(async () => {});
    await expect(result).resolves.toBeNull();
    expect(screen).toHavePathname('/settings/profile');
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
  });

  it('opened without a photo (deep link) leaves for Today', async () => {
    await renderRouter(profileRoutes, { initialUrl: '/crop?mode=avatar', wrapper });
    await act(async () => {});
    expect(screen).toHavePathname('/today');
  });
});
