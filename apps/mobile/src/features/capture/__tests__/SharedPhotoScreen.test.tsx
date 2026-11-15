import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import SharedPhotoScreen from '../../../../app/shared-photo';
import { usePendingCrop } from '../pendingCrop';
import type { PickedPhoto } from '../pickFromGallery';
import { saveGalleryPhoto } from '../saveCapture';
import { parseSharedPhotoId, takeSharedPhoto } from '../sharedPhoto';
import type { QueuedMoment } from '@/features/jar/todayGrid';

// Add to Pickld (FR-CAP-02): a photo shared from Photos goes to the day it was taken, only into a slot that day
// still has free, and on through Crop (or straight to the editor when it is 3:4). Reading the App Group is
// mocked; the jar date rules are the real ones.

jest.mock('../sharedPhoto', () => ({
  ...jest.requireActual<typeof import('../sharedPhoto')>('../sharedPhoto'),
  takeSharedPhoto: jest.fn(),
}));
jest.mock('../saveCapture', () => ({
  ...jest.requireActual<typeof import('../saveCapture')>('../saveCapture'),
  saveGalleryPhoto: jest.fn(),
}));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

const userId = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
const mockQueue: { items: QueuedMoment[] } = { items: [] };
jest.mock('@/features/jar/useToday', () => ({
  phoneTimeZone: () => 'Asia/Manila',
  todayQueryKeys: { queue: (id: string) => ['queue', id] },
  useToday: () => ({
    userId,
    localDate: '2026-11-11',
    jar: { hasAnyJar: true, jar: { id: 'jar-1', localDate: '2026-11-11', tz: 'Asia/Manila' }, moments: [] },
    queue: mockQueue.items,
    me: null,
  }),
}));
jest.mock('@/features/days/useDayJar', () => ({
  useDayJar: () => ({ userId, day: undefined, queue: mockQueue.items }),
}));

const ID = '0f6d3c1e-8a2b-4c5d-9e7f-1a2b3c4d5e6f';
const queued = (slot: QueuedMoment['slot'], localDate: string): QueuedMoment => ({
  id: 9,
  slot,
  state: 'queued',
  localDate,
  photoUri: 'file:///queue/9.jpg',
  thumbUri: null,
  capturedAt: `${localDate}T09:00:00+08:00`,
  visibility: null,
});
const photo = (exif: PickedPhoto['exif'], size = { width: 4032, height: 3024 }): PickedPhoto => ({
  uri: 'file:///cache/shared.jpg',
  ...size,
  exif,
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => <Text>Today stub</Text>,
  'shared-photo': SharedPhotoScreen,
  crop: function CropStub() {
    const pending = usePendingCrop((s) => s.pending);
    const target = pending && !pending.recrop ? pending.target.localDate : null;
    return (
      <View>
        <Text>
          Crop stub {pending?.slot} {target}
        </Text>
      </View>
    );
  },
  'edit/[momentId]': function EditStub() {
    const { momentId } = useLocalSearchParams<{ momentId: string }>();
    return <Text>Editor stub {String(momentId)}</Text>;
  },
};

async function openShared(picked: PickedPhoto, id = ID) {
  jest.mocked(takeSharedPhoto).mockResolvedValue(picked);
  await renderRouter(routes, { initialUrl: `/shared-photo?id=${id}`, wrapper });
  await act(async () => {});
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date('2026-11-11T14:00:00+08:00'),
    doNotFake: ['setTimeout', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
  mockQueue.items = [];
  usePendingCrop.setState({ pending: null });
  jest.mocked(takeSharedPhoto).mockReset();
  jest.mocked(saveGalleryPhoto).mockReset();
  jest
    .mocked(saveGalleryPhoto)
    .mockImplementation(async () => ({ id: 4 }) as Awaited<ReturnType<typeof saveGalleryPhoto>>);
});
afterEach(() => jest.useRealTimers());

it('sends a photo from an earlier day to that day, offers only its free slots, and crops a 4:3 photo first', async () => {
  // #ootd is already queued on Nov 7; #ootd today doesn't matter for this photo.
  mockQueue.items = [queued('ootd', '2026-11-07')];
  await openShared(photo({ DateTimeOriginal: '2026:11:07 18:30:00', OffsetTimeOriginal: '+08:00' }));

  expect(screen.getByTestId('shared-photo-day')).toHaveTextContent(/Nov 7 · added later/);
  expect(screen.getByLabelText('#ootd, already filled')).toBeDisabled();
  fireEvent.press(screen.getByLabelText('#ootd, already filled'));
  expect(screen).toHavePathname('/shared-photo');

  await act(async () => fireEvent.press(screen.getByLabelText('#selfie')));
  expect(screen).toHavePathname('/crop');
  expect(screen.getByText('Crop stub selfie 2026-11-07')).toBeTruthy();
  expect(saveGalleryPhoto).not.toHaveBeenCalled();
});

it('queues a 3:4 photo taken today into the open jar and opens the editor, skipping Crop', async () => {
  mockQueue.items = [queued('morning', '2026-11-11')];
  await openShared(photo({ DateTimeOriginal: '2026:11:11 08:00:00' }, { width: 1440, height: 1920 }));

  expect(screen.getByTestId('shared-photo-day')).toHaveTextContent('For today’s jar');
  expect(screen.getByLabelText('#morning, already filled')).toBeDisabled();
  await act(async () => fireEvent.press(screen.getByLabelText('#whereami')));

  expect(saveGalleryPhoto).toHaveBeenCalledWith(
    expect.objectContaining({
      slot: 'whereami',
      crop: null,
      target: { localDate: '2026-11-11', tz: 'Asia/Manila', capturedAt: '2026-11-11T08:00:00+08:00' },
    }),
  );
  expect(screen).toHavePathname('/edit/4');
});

it('refuses a photo dated after today', async () => {
  await openShared(photo({ DateTimeOriginal: '2026:11:12 09:00:00', OffsetTimeOriginal: '+08:00' }));
  expect(screen.getByText('This photo is dated after today')).toBeTruthy();
  expect(screen.queryByLabelText('#ootd')).toBeNull();
});

it('says the jar is full when that day has no free slot', async () => {
  mockQueue.items = (
    ['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'] as const
  ).map((slot) => queued(slot, '2026-11-07'));
  await openShared(photo({ DateTimeOriginal: '2026:11:07 10:00:00', OffsetTimeOriginal: '+08:00' }));
  expect(screen.getByText('That jar is full')).toBeTruthy();
  expect(screen.queryByLabelText('#selfie')).toBeNull();
});

it('says the photo could not be opened when the hand-off is missing or not an id', async () => {
  await renderRouter(routes, { initialUrl: '/shared-photo?id=..%2F..%2Fsecrets', wrapper });
  await act(async () => {});
  expect(screen.getByText('Couldn’t open that photo')).toBeTruthy();
  expect(takeSharedPhoto).not.toHaveBeenCalled();
  expect(parseSharedPhotoId('../x')).toBeNull();
  expect(parseSharedPhotoId(ID.toUpperCase())).toBe(ID);
});
