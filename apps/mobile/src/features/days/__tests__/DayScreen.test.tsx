// Gesture-handler's own jest mocks for its native module (the gallery grid's press and hold).
import 'react-native-gesture-handler/jestSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import '../../edit/__tests__/mockReanimated';
import type { ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import DayScreen from '../../../../app/day/[date]';
import { askLibraryAccess, libraryPhotoFile, loadLibraryPhotos } from '@/features/capture/libraryPhotos';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import { pickFromGallery } from '@/features/capture/pickFromGallery';
import { saveGalleryPhoto } from '@/features/capture/saveCapture';
import type { ServerMoment } from '@/features/jar/todayGrid';
import { markJarPublished } from '@/features/publish/publishCelebration';

import type { DayJar } from '../useDayJar';

// The day page (D-55, FR-DAY-02): only past dates have one; it is Today's grid and jar card for that date.
// Empty tiles open the gallery for that day, never the camera (D-153); filled ones the moment preview for
// that day, and Publish that day's review. Data hooks and the photo library are mocked; TodayView, the
// gallery grid, Crop, the editor, the preview and Publish have their own tests.
// The tiles' pop and the publish burst (D-58) use Reanimated, which the router test harness can't load; they
// have their own tests.
jest.mock('@/features/jar/TilePop', () => ({ TilePop: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/jar/PublishBurst', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { PublishBurst: () => createElement(View, { testID: 'publish-burst' }) };
});
jest.mock('@/components/JarGraphic', () => ({ JarGraphic: () => null, MAX_LAYERS: 8 }));
jest.mock('@/features/jar/JarTapReaction', () => ({ JarTapReaction: () => null }));
jest.mock('@/features/publish/JarVisibilitySheet', () => ({ JarVisibilitySheet: () => null }));
jest.mock('@/features/jar/retryUpload', () => ({ retryUpload: jest.fn() }));
jest.mock('@/lib/connectivity', () => ({ useIsOffline: () => false }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
// The gallery grid's gesture detector looks for these two.
jest.mock('react-native-reanimated/mock', () => ({
  __esModule: true,
  default: { createAnimatedComponent: <T,>(component: T) => component },
  isSharedValue: () => false,
  useReducedMotion: () => false,
}));
jest.mock('@/features/capture/saveCapture', () => ({
  ...jest.requireActual<typeof import('@/features/capture/saveCapture')>('@/features/capture/saveCapture'),
  saveGalleryPhoto: jest.fn(),
}));
jest.mock('@/features/capture/pickFromGallery', () => ({ pickFromGallery: jest.fn() }));
// Photos access and the library (iOS); askLibraryAccess asks Apple once while undecided (libraryPhotos).
jest.mock('@/features/capture/libraryPhotos', () => ({
  askLibraryAccess: jest.fn(),
  libraryAccess: jest.fn(),
  loadLibraryPhotos: jest.fn(),
  libraryPhotoFile: jest.fn(),
  onLibraryChange: () => () => {},
  chooseMorePhotos: jest.fn(),
}));
jest.mock('@/features/jar/useToday', () => ({
  phoneTimeZone: () => 'Asia/Manila',
  todayQueryKeys: { queue: (userId: string) => ['queue', userId] },
  useToday: () => ({ me: { readerCount: 12, lidColor: 'brand', defaultVisibility: 'private' } }),
}));

const mockDays: Record<string, DayJar> = {};
const mockDayJar = jest.fn((date: string | null) => ({
  userId: 'u-1',
  day: date ? mockDays[date] : undefined,
  queue: [],
}));
jest.mock('../useDayJar', () => ({ useDayJar: (date: string | null) => mockDayJar(date) }));

const moment = (slot: ServerMoment['slot'], extra: Partial<ServerMoment> = {}): ServerMoment => ({
  id: `m-${slot}`,
  slot,
  status: 'live',
  visibility: 'readers',
  is_backfilled: false,
  captured_at: '2026-11-08T01:00:00Z',
  added_at: '2026-11-08T01:00:00Z',
  thumbUrl: null,
  ...extra,
});

// Nov 8: an unpublished jar with two moments, one added later. Nov 7: published. Nov 3: no jar.
mockDays['2026-11-08'] = {
  jar: { id: 'jar-8', localDate: '2026-11-08', tz: 'Asia/Manila', publishedAt: null, visibility: 'readers' },
  moments: [moment('whereami'), moment('evening', { is_backfilled: true, added_at: '2026-11-10T01:00:00Z' })],
};
mockDays['2026-11-07'] = {
  jar: {
    id: 'jar-7',
    localDate: '2026-11-07',
    tz: 'Asia/Manila',
    publishedAt: '2026-11-07T14:10:00Z',
    visibility: 'everyone',
    likeCount: 3,
  },
  moments: [moment('whereami')],
};
mockDays['2026-11-03'] = { jar: null, moments: [] };
// Nov 1: every slot filled.
mockDays['2026-11-01'] = {
  jar: { id: 'jar-1', localDate: '2026-11-01', tz: 'Asia/Manila', publishedAt: null, visibility: 'readers' },
  moments: (['whereami', 'mebusywith', 'whoamiwith', 'ootd', 'selfie', 'morning', 'afternoon', 'evening'] as const).map(
    (slot) => moment(slot),
  ),
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

/** A stub screen that prints its path params and goes back. */
function stub(name: string) {
  return function Stub() {
    const router = useRouter();
    const params = useLocalSearchParams<{ date?: string; slot?: string }>();
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Close ${name}`} onPress={() => router.back()}>
        <Text>{`${name} ${params.date ?? 'none'} ${params.slot ?? 'none'}`}</Text>
      </Pressable>
    );
  };
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => <Text>Today stub</Text>,
  'my-days': () => <Text>My days stub</Text>,
  'day/[date]': DayScreen,
  camera: stub('camera'),
  crop: function CropStub() {
    const pending = usePendingCrop((s) => s.pending);
    return (
      <Text>{`crop ${pending?.slot ?? 'none'} ${pending && 'target' in pending ? pending.target.localDate : 'none'}`}</Text>
    );
  },
  'edit/[momentId]': function EditStub() {
    const { momentId } = useLocalSearchParams<{ momentId: string }>();
    return <Text>{`editor ${momentId}`}</Text>;
  },
  'jar/[id]': function JarStub() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <Text>{`jar ${id}`}</Text>;
  },
  publish: stub('publish'),
  'moment/preview': stub('preview'),
};

// Library photos: one taken on Nov 8, one on Nov 10 (outside "Only Nov 8").
const libraryPhoto = (iso: string, id: string, width = 4032, height = 3024) => ({
  id,
  width,
  height,
  creationTime: Date.parse(iso),
});

beforeEach(() => {
  // 12:00 on 2026-11-11 in Manila.
  jest.useFakeTimers({ now: new Date('2026-11-11T04:00:00Z'), advanceTimers: true });
  mockDayJar.mockClear();
  usePendingCrop.setState({ pending: null });
  jest.mocked(askLibraryAccess).mockReset().mockResolvedValue('all');
  jest
    .mocked(loadLibraryPhotos)
    .mockReset()
    .mockImplementation(async (_offset, _limit, range) =>
      [
        libraryPhoto('2026-11-10T09:00:00+08:00', 'ph://later'),
        libraryPhoto('2026-11-08T21:00:00+08:00', 'ph://day'),
      ].filter(
        (photo) =>
          range === null || range === undefined || (photo.creationTime >= range.from && photo.creationTime < range.to),
      ),
    );
  jest
    .mocked(libraryPhotoFile)
    .mockReset()
    .mockResolvedValue({
      uri: 'file:///cache/gallery-1.jpg',
      width: 4032,
      height: 3024,
      exif: { DateTimeOriginal: '2026:11:08 21:00:00', OffsetTimeOriginal: '+08:00' },
    });
  jest.mocked(pickFromGallery).mockReset().mockResolvedValue(null);
  jest
    .mocked(saveGalleryPhoto)
    .mockReset()
    .mockResolvedValue({ id: 41 } as Awaited<ReturnType<typeof saveGalleryPhoto>>);
});
afterEach(() => jest.useRealTimers());

describe('Day page route', () => {
  it.each([
    ['today', '2026-11-11'],
    ['a future date', '2026-11-12'],
    ['a malformed date', 'nov-8'],
    ['an impossible date', '2026-02-30'],
  ])('%s goes to the Today tab', async (_case, date) => {
    await renderRouter(routes, { initialUrl: `/day/${date}`, wrapper });
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(screen.getByText('Today stub')).toBeTruthy();
  });

  it('a past day shows its date, Back and that day’s jar, with no Now tile', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    expect(mockDayJar).toHaveBeenCalledWith('2026-11-08');
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Sunday');
    expect(screen.getByTestId('day-subtitle')).toHaveTextContent('Nov 8, 2026');
    expect(screen.queryByTestId('today-my-days')).toBeNull();
    expect(screen.getByText('2 of 8 moments')).toBeTruthy();
    expect(screen.getByText('in this jar · 12 readers')).toBeTruthy();
    expect(screen.queryByText(/Now/)).toBeNull();
  });

  // D-156: a past day looks like one, so it is never mistaken for Today.
  it('a past day shows the past-day banner naming the day, on warm paper', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    expect(screen.getByTestId('past-day-screen')).toBeTruthy();
    expect(screen.getByTestId('past-day-title')).toHaveTextContent('Filling in Sun, Nov 8 · Added later');
    expect(screen.getByText('This is a past day, not today. Moments you add here show as “Added later”.')).toBeTruthy();
  });

  it('a full past day says "Sun, Nov 1 · Added later", without "Filling in"', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-01', wrapper });
    expect(screen.getByTestId('past-day-title')).toHaveTextContent('Sun, Nov 1 · Added later');
    expect(screen.queryByText(/Filling in/)).toBeNull();
  });

  it('Back to Today goes to the Today tab, past My days below', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    await act(async () => router.push('/my-days'));
    await act(async () => router.push('/day/2026-11-08'));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen).toHavePathname('/today');
    expect(screen.getByText('Today stub')).toBeTruthy();
    expect(screen.queryByTestId('past-day-banner')).toBeNull();
  });

  it('Back to Today with no history opens the Today tab', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-07', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(screen).toHavePathname('/today');
    expect(screen.getByText('Today stub')).toBeTruthy();
  });

  it('an empty tile opens the gallery on that day, never the camera, and its photo goes to Crop for that slot', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(await screen.findByTestId('gallery-grid')).toBeTruthy();
    expect(screen).toHavePathname('/day/2026-11-08');
    expect(screen.getByRole('tab', { name: 'Only Nov 8' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByTestId('gallery-photo-ph://later')).toBeNull();
    expect(pickFromGallery).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('gallery-photo-ph://day'));
    await waitFor(() => expect(screen).toHavePathname('/crop'));
    expect(screen.getByText('crop ootd 2026-11-08')).toBeTruthy();
    // Nov 8's jar is in Manila; the photo keeps its own capture time.
    expect(usePendingCrop.getState().pending).toEqual(
      expect.objectContaining({
        slot: 'ootd',
        userId: 'u-1',
        target: { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-08T21:00:00+08:00' },
      }),
    );
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
  });

  it('a 3:4 photo is saved for that day and slot at the default visibility, then the editor opens', async () => {
    jest.mocked(libraryPhotoFile).mockResolvedValue({
      uri: 'file:///cache/gallery-2.jpg',
      width: 3000,
      height: 4000,
      exif: { DateTimeOriginal: '2026:11:08 21:00:00', OffsetTimeOriginal: '+08:00' },
    });
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    await fireEvent.press(await screen.findByTestId('gallery-photo-ph://day'));
    await waitFor(() => expect(screen).toHavePathname('/edit/41'));
    expect(saveGalleryPhoto).toHaveBeenCalledWith({
      uri: 'file:///cache/gallery-2.jpg',
      slot: 'ootd',
      userId: 'u-1',
      target: { localDate: '2026-11-08', tz: 'Asia/Manila', capturedAt: '2026-11-08T21:00:00+08:00' },
      crop: null,
      visibility: 'private',
      exif: { DateTimeOriginal: '2026:11:08 21:00:00', OffsetTimeOriginal: '+08:00' },
    });
  });

  it('closing the gallery stays on the day and saves nothing', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    await fireEvent.press(await screen.findByTestId('gallery-close'));
    await waitFor(() => expect(screen.queryByTestId('gallery-grid')).toBeNull());
    expect(screen).toHavePathname('/day/2026-11-08');
    expect(saveGalleryPhoto).not.toHaveBeenCalled();
    expect(usePendingCrop.getState().pending).toBeNull();
  });

  it('a day with no photos offers Show all photos, and no camera', async () => {
    jest
      .mocked(loadLibraryPhotos)
      .mockImplementation(async (_offset, _limit, range) =>
        range ? [] : [libraryPhoto('2026-11-10T09:00:00+08:00', 'ph://later')],
      );
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    expect(await screen.findByTestId('gallery-day-empty')).toBeTruthy();
    expect(screen.getByTestId('gallery-show-all')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /camera/i })).toBeNull();
  });

  it('asks the library for access (once while undecided); without it, Apple’s picker opens', async () => {
    jest.mocked(askLibraryAccess).mockResolvedValue(null);
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-ootd'));
    await waitFor(() => expect(pickFromGallery).toHaveBeenCalledTimes(1));
    expect(askLibraryAccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('gallery-grid')).toBeNull();
    expect(screen).toHavePathname('/day/2026-11-08');
  });

  it('a filled tile opens the moment preview for that day', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByTestId('tile-evening'));
    expect(screen).toHavePathname('/moment/preview');
    expect(screen.getByText('preview 2026-11-08 evening')).toBeTruthy();
  });

  it('offers Publish for an unpublished jar and opens that day’s review', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    const publish = screen.getByTestId('today-publish');
    expect(publish.props.accessibilityHint).toBe('Review this day’s jar and choose who can see it');
    await fireEvent.press(publish);
    expect(screen).toHavePathname('/publish');
    expect(screen.getByText('publish 2026-11-08 none')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Close publish' }));
    await act(async () => {});
    expect(screen).toHavePathname('/day/2026-11-08');
  });

  it('a published jar shows Published instead of Publish', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-07', wrapper });
    expect(screen.queryByTestId('today-publish')).toBeNull();
    expect(screen.getByTestId('today-published')).toBeTruthy();
  });

  it('a published jar offers View jar, which opens its jar page (D-153)', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-07', wrapper });
    const viewJar = screen.getByRole('button', { name: 'View jar' });
    expect(viewJar.props.accessibilityHint).toBe('Opens this day’s jar page');
    await fireEvent.press(viewJar);
    expect(screen).toHavePathname('/jar/jar-7');
    expect(screen.getByText('jar jar-7')).toBeTruthy();
  });

  it('an unpublished jar has no View jar', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    expect(screen.queryByRole('button', { name: 'View jar' })).toBeNull();
  });

  it('a day without a jar has nothing to publish yet', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-03', wrapper });
    expect(screen.getByTestId('today-publish').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('tile-whereami'));
    expect(await screen.findByTestId('gallery-grid')).toBeTruthy();
    expect(screen).toHavePathname('/day/2026-11-03');
  });

  it('Back with no history lands on My days', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen).toHavePathname('/my-days');
  });

  it('publishing that day’s jar comes back to a celebration on the day page, once (D-58)', async () => {
    await renderRouter(routes, { initialUrl: '/day/2026-11-08', wrapper });
    expect(screen.queryByTestId('publish-burst')).toBeNull();
    await fireEvent.press(screen.getByTestId('today-publish'));
    expect(screen).toHavePathname('/publish');
    await act(async () => markJarPublished('jar-8'));
    await fireEvent.press(screen.getByRole('button', { name: 'Close publish' }));
    expect(screen).toHavePathname('/day/2026-11-08');
    expect(screen.getByTestId('publish-burst')).toBeTruthy();
  });
});
