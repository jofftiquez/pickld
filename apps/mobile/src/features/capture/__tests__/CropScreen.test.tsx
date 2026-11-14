// Gesture-handler's own jest mocks for its native module (not in the shared jest setup).
import 'react-native-gesture-handler/jestSetup';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import '../../edit/__tests__/mockReanimated';
import type { ReactNode } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import CropScreen from '../../../../app/crop';
import { CROP_RATIO, cropFrame, cropRectFor, initialCrop } from '../cropMath';
import { usePendingCrop, type PendingCrop } from '../pendingCrop';
import { saveGalleryPhoto } from '../saveCapture';
import { captureError } from '@/lib/monitoring';
import { cropProfilePhoto, useProfileCrop } from '@/features/profile/profileCrop';
import type { ProfileCrop } from '@/lib/image/profileImage';

// Crop screen (FR-CAP-03, FR-CAP-02; design: Crop): buttons, gestures and the zoom slider change what Done
// queues; Reset and Fit undo; Cancel returns to the camera with nothing queued; Done queues the raw photo
// with the crop through the queue-first path and opens the editor. saveGalleryPhoto has its own test.
jest.mock('../saveCapture', () => ({ saveGalleryPhoto: jest.fn() }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

const userId = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
const image = { width: 4000, height: 2000 };
const pending: PendingCrop = {
  photo: { uri: 'file:///picker/beach.jpg', ...image, exif: null },
  slot: 'afternoon',
  userId,
  target: { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-08T19:30:00+08:00' },
};
// The test renderer has no safe areas, so the screen sizes the frame with zero insets.
const frame = () => cropFrame(Dimensions.get('window'), { top: 0, bottom: 0 });

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
  usePendingCrop.setState({ pending });
  jest.mocked(saveGalleryPhoto).mockReset();
  jest
    .mocked(saveGalleryPhoto)
    .mockImplementation(async () => ({ id: 9 }) as Awaited<ReturnType<typeof saveGalleryPhoto>>);
  jest.mocked(captureError).mockClear();
});

describe('Crop screen', () => {
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
    for (const name of ['Cancel', 'Reset', 'Rotate 90 degrees', 'Flip', 'Fit', 'Next: edit']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByText('Every Pickld moment is 3:4, so your jars always line up.')).toBeTruthy();
  });

  it('puts Next: edit in the header as a pill and Reset with the tools (D-65); the frame fits the sheet', async () => {
    await openCrop();
    const header = screen.getByTestId('crop-header');
    expect(within(header).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(within(header).getByRole('button', { name: 'Next: edit' }).props.accessibilityHint).toBe(
      'Adds the photo to #afternoon and opens the editor',
    );
    expect(within(header).queryByRole('button', { name: 'Reset' })).toBeNull();
    const tools = within(screen.getByTestId('crop-tools')).getAllByRole('button');
    expect(tools.map((tool) => tool.props.accessibilityLabel)).toEqual(['Rotate 90 degrees', 'Flip', 'Fit', 'Reset']);
    expect(screen.getByRole('button', { name: 'Reset' }).props.accessibilityHint).toBe(
      'Undoes every change to the crop',
    );
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

  it('the zoom slider steps with a screen reader; Fit goes back to the whole photo, keeping the turn', async () => {
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
    await act(() =>
      screen.getByRole('adjustable', { name: 'Zoom' }).props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      }),
    );
    await press('Fit');
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
    for (const name of ['Rotate 90 degrees', 'Flip', 'Fit']) expect(screen.queryByRole('button', { name })).toBeNull();
    for (const name of ['Cancel', 'Reset', 'Use photo']) expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('adjustable', { name: 'Zoom' })).toBeTruthy();
    expect(screen.queryByText('#afternoon · from gallery')).toBeNull();
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
