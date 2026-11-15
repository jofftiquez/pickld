import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, type Href } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';
// After the testing library, which brings gesture-handler's jest mocks and its own Reanimated mock.
import './mockReanimated';
import type { ReactNode } from 'react';
import { Skia, type SkData } from '@shopify/react-native-skia';
import { Text, View } from 'react-native';

import EditScreen from '../../../../app/edit/[momentId]';
import { editsSchema } from '../edits';
import { filterIdSchema, filterMatrices } from '../filters';
import { kape } from './stickerFixture';
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { discardItem, getItem, keepAsDraft, saveEdits, type QueueItem } from '@/lib/queue/store';
import { saveMomentEdits } from '@/features/moment/momentActions';
import { preparePhoto } from '@/lib/image/pipeline';
import { trackMomentAdded } from '@/features/capture/momentAnalytics';
import { editableMomentQueryKey } from '@/features/moment/useEditableMoment';
import { useAuthStore } from '@/lib/authStore';
import { setDeviceOnline } from '@/lib/connectivity';
import { useToastStore } from '@/lib/toast';
import type { Session } from '@supabase/supabase-js';

// Editor (FR-CAP-04, FR-CAP-08, FR-CAP-09; D-103): loads the queued photo, draws it with the selected
// filter's matrix and switches tools on the photo step, then Next opens the details step, whose Save stores
// the caption, visibility and edits into the queue item. Skia's native
// canvas is replaced by plain views that expose what would be drawn. The queue is an in-memory fake
// with the store's save semantics (the store's own test runs them on real SQLite).

jest.mock('@shopify/react-native-skia', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Canvas: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
      <MockView testID={testID}>{children}</MockView>
    ),
    Image: ({ children, image }: { children?: ReactNode; image: { uri: string } }) => (
      <MockView testID="skia-image" accessibilityHint={image.uri}>
        {children}
      </MockView>
    ),
    // The matrix travels as JSON in accessibilityValue so the test can read it off the host view.
    ColorMatrix: ({ matrix }: { matrix: number[] }) => (
      <MockView testID="color-matrix" accessibilityValue={{ text: JSON.stringify(matrix) }} />
    ),
    // Like Skia: no HEIC decoder.
    useImage: jest.fn((uri: string | undefined) => (uri && mockDecodable(uri) ? { uri } : null)),
    Skia: {
      Data: { fromURI: jest.fn(async (uri: string) => ({ uri })) },
      Image: { MakeImageFromEncoded: ({ uri }: { uri: string }) => (mockDecodable(uri) ? { uri } : null) },
    },
  };
});
const mockDecodable = (uri: string) => !/\.heic$/i.test(uri);

// The editor's JPEG copy of a photo Skia can't decode: `<name>-editor.jpg` next to it.
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: (uri: string) => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: async () => ({ uri: uri.replace(/\.heic$/i, '-editor.jpg') }),
          release: () => undefined,
        }),
        release: () => undefined,
      };
      return context;
    },
  },
}));

/** Who listens to queue changes (the store's notify), so a test can announce one. */
const mockQueueListeners = new Set<(change: 'added' | 'status' | 'removed') => void>();
jest.mock('@/lib/queue/store', () => ({
  getItem: jest.fn(),
  saveEdits: jest.fn(),
  keepAsDraft: jest.fn(),
  discardItem: jest.fn(),
  subscribeQueue: (listener: (change: 'added' | 'status' | 'removed') => void) => {
    mockQueueListeners.add(listener);
    return () => mockQueueListeners.delete(listener);
  },
}));
// Rotate and Flip make the changed photo with the preparation pipeline: here it names the file after the adjust.
jest.mock('@/lib/image/pipeline', () => ({
  preparePhoto: jest.fn(async (_uri: string, a: { rotate: number; flip: boolean }) => {
    const name = `file:///cache/turned-${a.rotate}${a.flip ? 'f' : ''}`;
    return {
      full: { uri: `${name}.webp`, width: 1440, height: 1920 },
      thumb: { uri: `${name}-thumb.webp`, width: 480, height: 640 },
    };
  }),
}));
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn(async () => undefined) }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));
jest.mock('@/features/capture/momentAnalytics', () => ({ trackMomentAdded: jest.fn(async () => undefined) }));
// Uploaded moments (M2-23) are read from Supabase and saved through momentActions.
const mockServer: { row: Record<string, unknown> | null; reads: number } = { row: null, reads: 0 };
jest.mock('@/lib/supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => {
      mockServer.reads += 1;
      return { data: mockServer.row, error: null };
    },
  };
  return {
    getSupabase: () => ({
      from: () => query,
      functions: {
        invoke: async (_name: string, { body }: { body: { momentIds: string[] } }) => ({
          data: {
            data: {
              moments: body.momentIds.map((id) => ({ id, full: `https://photos.test/${id}.webp`, thumb: null })),
            },
          },
          error: null,
        }),
      },
    }),
  };
});
jest.mock('@/features/moment/momentActions', () => ({ saveMomentEdits: jest.fn(async () => undefined) }));

const item: QueueItem = {
  id: 7,
  userId: '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f',
  photoUri: 'file:///docs/queue/7.webp',
  thumbUri: null,
  slot: 'afternoon',
  localDate: '2026-11-11',
  tz: 'Asia/Manila',
  capturedAt: '2026-11-11T06:14:00.000Z',
  caption: null,
  visibility: 'readers',
  edits: {},
  createdAt: Date.parse('2026-11-11T06:14:00.000Z'),
  jarId: null,
  momentId: null,
  prepared: true,
  editingSince: Date.parse('2026-11-11T06:14:05.000Z'),
  draft: false,
  crop: null,
  replace: false,
  state: 'queued',
  attempts: 0,
  nextAttemptAt: null,
  lastError: null,
};

// One query client per test, shared across navigations like the app's.
let queryClient = new QueryClient();
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** The queue as the fake store sees it: id → row. */
const rows = new Map<number, QueueItem>();

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
  'day/[date]': () => (
    <View>
      <Text>Day stub</Text>
    </View>
  ),
  'shared-photo': () => (
    <View>
      <Text>Slot choice stub</Text>
    </View>
  ),
  'edit/[momentId]': EditScreen,
};

async function push(url: Href) {
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push(url);
  });
}

async function openEditor(url: Href) {
  await renderRouter(routes, { initialUrl: '/today', wrapper });
  await push(url);
}

const matrixIn = (testID: string) =>
  JSON.parse(within(screen.getByTestId(testID)).getByTestId('color-matrix').props.accessibilityValue.text) as number[];
const filterButton = (name: string) => screen.getByRole('button', { name });
/** The photo step's Next (D-103): opens the details step with the caption and visibility. */
async function goToDetails() {
  await fireEvent.press(screen.getByTestId('editor-next'));
  expect(screen.getByTestId('editor-details')).toBeTruthy();
}

beforeEach(() => {
  queryClient = new QueryClient();
  rows.clear();
  rows.set(7, item);
  jest.mocked(getItem).mockReset();
  jest.mocked(getItem).mockImplementation(async (id) => rows.get(id) ?? null);
  jest.mocked(saveEdits).mockReset();
  jest.mocked(saveEdits).mockImplementation(async (id, input, _photo, options) => {
    const row = rows.get(id);
    if (!row) throw new Error(`No queued moment ${id}`);
    const saved = { ...row, ...input, editingSince: null, draft: options?.draft ?? false };
    rows.set(id, saved);
    return saved;
  });
  jest.mocked(keepAsDraft).mockReset();
  jest.mocked(keepAsDraft).mockImplementation(async (id: number) => {
    const row = rows.get(id);
    if (row) rows.set(id, { ...row, editingSince: null, draft: true });
  });
  jest.mocked(discardItem).mockReset();
  jest.mocked(discardItem).mockImplementation(async (id) => {
    rows.delete(id);
  });
  jest.mocked(requestUploads).mockClear();
  jest.mocked(captureError).mockClear();
  jest.mocked(Skia.Data.fromURI).mockImplementation(async (uri) => ({ uri }) as unknown as SkData);
  jest.mocked(trackMomentAdded).mockClear();
});

describe('Editor', () => {
  it('opens the queued photo with Original selected and the identity matrix on the canvas', async () => {
    await openEditor('/edit/7');
    expect(await screen.findByTestId('editor-screen')).toBeTruthy();
    expect(getItem).toHaveBeenCalledWith(7);
    expect(within(screen.getByTestId('editor-photo')).getByTestId('skia-image').props.accessibilityHint).toBe(
      item.photoUri,
    );
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.original);
    expect(filterButton('Original').props.accessibilityState).toMatchObject({ selected: true });
  });

  describe('the slot tag (D-156)', () => {
    // 3:00 PM on Wed, Nov 11 in Manila.
    beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-11T07:00:00Z'), advanceTimers: true }));
    afterEach(() => jest.useRealTimers());
    const tag = () => screen.getByTestId('camera-slot-tag');

    it('a photo taken today for today’s jar says "Today · 2:14 PM"', async () => {
      await openEditor('/edit/7');
      await screen.findByTestId('editor-screen');
      expect(tag().props.accessibilityLabel).toBe('#afternoon, today at 2:14 PM');
      expect(within(tag()).getByText('Today · 2:14 PM')).toBeTruthy();
    });

    it('a photo from an earlier day going into today’s jar names its own day, not Today', async () => {
      rows.set(7, { ...item, capturedAt: '2026-11-09T01:30:00.000Z' });
      await openEditor('/edit/7');
      await screen.findByTestId('editor-screen');
      expect(tag().props.accessibilityLabel).toBe('#afternoon, Mon, Nov 9 at 9:30 AM');
    });

    it('a photo going into a past day’s jar names that day, not the photo’s own date or Today', async () => {
      // Shot on Nov 5, filling Sun, Nov 8.
      rows.set(7, { ...item, localDate: '2026-11-08', capturedAt: '2026-11-05T01:30:00.000Z' });
      await openEditor('/edit/7');
      await screen.findByTestId('editor-screen');
      expect(tag().props.accessibilityLabel).toBe('#afternoon, for Sun, Nov 8');
      expect(within(tag()).getByText('For Sun, Nov 8')).toBeTruthy();
      expect(within(tag()).queryByText(/Today|Nov 5/)).toBeNull();
    });
  });

  it('shows all sixteen thumbnails, each previewing the real photo through its own filter', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    for (const id of filterIdSchema.options) {
      const thumb = screen.getByTestId(`editor-filter-${id}`);
      expect(within(thumb).getByTestId('skia-image').props.accessibilityHint).toBe(item.photoUri);
      expect(matrixIn(`editor-filter-${id}`)).toEqual(filterMatrices[id]);
    }
    expect(within(screen.getByTestId('editor-filters')).getAllByRole('button')).toHaveLength(16);
  });

  it('selecting a filter marks it selected and draws the photo with its matrix right away', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');

    await fireEvent.press(filterButton('Mono'));
    expect(filterButton('Mono').props.accessibilityState).toMatchObject({ selected: true });
    expect(filterButton('Original').props.accessibilityState).toMatchObject({ selected: false });
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.mono);
    expect(screen.getByRole('image', { name: 'Photo with the Mono filter' })).toBeTruthy();

    await fireEvent.press(filterButton('Dusk'));
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.dusk);
    expect(filterButton('Mono').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('shows all four tool tabs; the later tools open an empty panel and keep the chosen filter', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Kalamansi'));

    const tabs = within(screen.getByTestId('editor-tools')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Filters', 'Stickers', 'Bubble', 'Text']);
    expect(screen.getByRole('tab', { name: 'Filters' }).props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole('tab', { name: 'Stickers' }));
    expect(screen.getByRole('tab', { name: 'Stickers' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('stickers-loading')).toBeTruthy(); // no session in this test: the catalog isn't read
    expect(screen.queryByTestId('editor-filters')).toBeNull();
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.kalamansi);

    await fireEvent.press(screen.getByRole('tab', { name: 'Filters' }));
    expect(filterButton('Kalamansi').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('Close on a new photo asks first: Keep editing stays, and nothing uploads', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Save this photo as a draft?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Save this photo as a draft?')).toBeNull();
    expect(screen).toHavePathname('/edit/7');
    expect(requestUploads).not.toHaveBeenCalled();
    expect(saveEdits).not.toHaveBeenCalled();
  });

  it('Save draft keeps the photo and its edits on the phone as a draft, without uploading or counting it', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Mono'));
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'finish later');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(saveEdits).toHaveBeenCalledWith(
      7,
      { caption: 'finish later', visibility: 'readers', edits: { v: 1, filter: 'mono', overlays: [] } },
      undefined,
      { draft: true },
    );
    expect(rows.get(7)).toMatchObject({ caption: 'finish later', draft: true, editingSince: null });
    expect(requestUploads).not.toHaveBeenCalled();
    expect(trackMomentAdded).not.toHaveBeenCalled();
    expect(useToastStore.getState().current?.key).toBe('draftSaved');
  });

  it('Discard deletes the photo and its row', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Discard photo' }));
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(discardItem).toHaveBeenCalledWith(7);
    expect(rows.has(7)).toBe(false);
    expect(keepAsDraft).not.toHaveBeenCalled();
    expect(requestUploads).not.toHaveBeenCalled();
    expect(trackMomentAdded).not.toHaveBeenCalled();
  });

  it('any other way out (Android back, a parent dismissing it) asks too, then goes where it was going', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    await act(async () => router.back());
    expect(screen).toHavePathname('/edit/7');
    expect(screen.getByText('Save this photo as a draft?')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(rows.get(7)).toMatchObject({ draft: true });
    expect(requestUploads).not.toHaveBeenCalled();
  });

  it('a draft reopens as a new photo: Add to #slot finishes and uploads it', async () => {
    rows.set(7, { ...item, editingSince: null, draft: true, caption: 'finish later' });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    expect(screen.getByLabelText('Caption').props.value).toBe('finish later');
    expect(saveButton().props.accessibilityLabel).toBe('Add to #afternoon');
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(rows.get(7)).toMatchObject({ draft: false });
    expect(requestUploads).toHaveBeenCalled();
    expect(trackMomentAdded).toHaveBeenCalledTimes(1);
  });

  it('opened by Crop (`via=crop`), saving goes back past the camera below it, to where the camera was opened', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await push('/camera');
    await push('/edit/7?via=crop');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/today');
    expect(screen.queryByText('Camera stub')).toBeNull();
  });

  it('opened by Crop from a past day’s page (D-153), saving goes back to that day', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await push('/day/2026-11-08');
    await push('/edit/7?via=crop');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledTimes(1);
    expect(screen).toHavePathname('/day/2026-11-08');
    expect(screen.getByText('Day stub')).toBeTruthy();
  });

  it('moves to the prepared photo when background preparation replaces the raw file it opened on', async () => {
    const rawUri = 'file:///docs/queue/7-raw.jpg';
    rows.set(7, { ...item, photoUri: rawUri, prepared: false });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    const drawn = () =>
      within(screen.getByTestId('editor-photo')).getByTestId('skia-image').props.accessibilityHint as string;
    expect(drawn()).toBe(rawUri);
    // Preparation swaps in the cropped WebP and deletes the raw file, then announces the change.
    rows.set(7, { ...item, prepared: true });
    await act(async () => mockQueueListeners.forEach((listener) => listener('status')));
    await waitFor(() => expect(drawn()).toBe(item.photoUri));
    expect(within(screen.getByTestId('editor-filter-mono')).getByTestId('skia-image').props.accessibilityHint).toBe(
      item.photoUri,
    );
    await goToDetails();
    expect(screen.getByTestId('moment-view-photo').props.source).toEqual([{ uri: item.photoUri }]);
  });

  it("draws a raw HEIC photo (Photos' original, 3:4 so it skipped Crop) from a JPEG copy until it is prepared", async () => {
    const rawUri = 'file:///docs/queue/7-raw.HEIC';
    rows.set(7, { ...item, photoUri: rawUri, prepared: false });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    const drawn = (testID: string) =>
      within(screen.getByTestId(testID)).queryByTestId('skia-image')?.props.accessibilityHint as string | undefined;
    // Skia can't decode HEIC: without the copy the canvas and every thumbnail stayed blank.
    await waitFor(() => expect(drawn('editor-photo')).toBe('file:///docs/queue/7-raw-editor.jpg'));
    expect(drawn('editor-filter-mono')).toBe('file:///docs/queue/7-raw-editor.jpg');
    rows.set(7, { ...item, prepared: true });
    await act(async () => mockQueueListeners.forEach((listener) => listener('status')));
    await waitFor(() => expect(drawn('editor-photo')).toBe(item.photoUri));
  });

  it('a late load of the raw file never replaces the prepared photo (D-155)', async () => {
    const rawUri = 'file:///docs/queue/7-raw.jpg';
    const loads = new Map<string, () => void>();
    jest
      .mocked(Skia.Data.fromURI)
      .mockImplementation(
        (uri) => new Promise<SkData>((resolve) => loads.set(uri, () => resolve({ uri } as unknown as SkData))),
      );
    rows.set(7, { ...item, photoUri: rawUri, prepared: false });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    rows.set(7, { ...item, prepared: true });
    await act(async () => mockQueueListeners.forEach((listener) => listener('status')));
    await waitFor(() => expect(loads.has(item.photoUri)).toBe(true));
    await act(async () => loads.get(item.photoUri)?.());
    await act(async () => loads.get(rawUri)?.());
    expect(within(screen.getByTestId('editor-photo')).getByTestId('skia-image').props.accessibilityHint).toBe(
      item.photoUri,
    );
  });

  it('opened from a share (`via=share`), Back drops the draft and returns to the slot choice', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await push('/shared-photo');
    await push('/edit/7?via=share');
    await screen.findByTestId('editor-screen');
    expect(screen.queryByTestId('editor-close')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-choose-slot'));
    await act(async () => {});
    expect(discardItem).toHaveBeenCalledWith(7);
    expect(screen).toHavePathname('/shared-photo');
    // It never became a moment.
    expect(trackMomentAdded).not.toHaveBeenCalled();
  });

  it('opened from a share, saving leaves the slot choice too', async () => {
    await renderRouter(routes, { initialUrl: '/today', wrapper });
    await push('/shared-photo');
    await push('/edit/7?via=share');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledTimes(1);
    expect(discardItem).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/today');
    expect(screen.queryByText('Slot choice stub')).toBeNull();
  });

  it.each<Href>(['/edit/abc', '/edit/0', '/edit/1.5'])(
    'rejects a malformed id (%s) without reading the queue',
    async (url) => {
      await openEditor(url);
      expect(await screen.findByTestId('editor-missing')).toBeTruthy();
      expect(getItem).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      expect(screen).toHavePathname('/today');
    },
  );

  it('says the photo is gone when the queue no longer has it', async () => {
    await openEditor('/edit/8');
    expect(await screen.findByText('This photo is no longer waiting to be edited.')).toBeTruthy();
    expect(screen.queryByTestId('editor-screen')).toBeNull();
  });
});

const saveButton = () => screen.getByTestId('editor-save');
const visibilityTab = (name: 'Readers' | 'Everyone' | 'Only me') => screen.getByRole('tab', { name });
const selectedVisibility = () =>
  (['Readers', 'Everyone', 'Only me'] as const).filter(
    (name) => visibilityTab(name).props.accessibilityState?.selected,
  );

describe('Caption, visibility, Undo and save (M2-12)', () => {
  it('shows the empty caption with its counter, the default visibility, no Undo, and "Add to #slot" for a photo just taken', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await goToDetails();
    const field = screen.getByLabelText('Caption');
    expect(field.props.value).toBe('');
    expect(field.props.maxLength).toBe(150);
    // The slot's own question gives the empty caption something to answer.
    expect(field.props.placeholder).toBe('How’s your afternoon going?');
    expect(screen.getByText('0 / 150')).toBeTruthy();
    // Starts at the queued visibility (the owner's default, D-48).
    expect(screen.getByTestId('editor-visibility').props.accessibilityLabel).toBe('Who can see this moment');
    expect(selectedVisibility()).toEqual(['Readers']);
    expect(saveButton().props.accessibilityLabel).toBe('Add to #afternoon');
  });

  it('counts the caption as it is typed', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'Sinigang at the office pantry');
    expect(screen.getByText('29 / 150')).toBeTruthy();
  });

  it('Undo appears after a filter change and steps back one change at a time', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Mono'));
    await fireEvent.press(filterButton('Dusk'));

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.mono);
    expect(filterButton('Mono').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.original);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('Add to #slot saves caption, visibility and edits (as data) into the queue item, returns to Today and wakes the uploader', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Kalamansi'));
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), '  Lunch break, finally!  ');
    await fireEvent.press(visibilityTab('Only me'));
    expect(selectedVisibility()).toEqual(['Only me']);

    await fireEvent.press(saveButton());
    await act(async () => {});

    expect(saveEdits).toHaveBeenCalledTimes(1);
    // The photo file is not part of the save: the filter is stored as data, never applied to the file.
    expect(saveEdits).toHaveBeenCalledWith(7, {
      caption: 'Lunch break, finally!',
      visibility: 'only_me',
      edits: { v: 1, filter: 'kalamansi', overlays: [] },
    });
    expect(rows.get(7)?.photoUri).toBe(item.photoUri);
    expect(screen).toHavePathname('/today');
    expect(requestUploads).toHaveBeenCalled();
    expect(jest.mocked(saveEdits).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requestUploads).mock.invocationCallOrder[0] ?? 0,
    );
    // Added once, with the visibility chosen here (leaving the editor afterwards adds nothing more).
    expect(jest.mocked(trackMomentAdded).mock.calls).toEqual([[expect.objectContaining({ id: 7 }), 'only_me']]);
  });

  it('saves an empty or blank caption as no caption', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), '   ');
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledWith(7, expect.objectContaining({ caption: null, visibility: 'readers' }));
  });

  it('confirms a new photo with a toast (D-63): added to its slot, or saved to upload later when offline', async () => {
    useToastStore.setState({ current: null });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(useToastStore.getState().current).toMatchObject({ key: 'momentAdded', params: { slot: '#afternoon' } });

    rows.set(8, { ...item, id: 8 });
    setDeviceOnline(false);
    try {
      await openEditor('/edit/8');
      await screen.findByTestId('editor-screen');
      await goToDetails();
      await fireEvent.press(saveButton());
      await act(async () => {});
      expect(useToastStore.getState().current?.key).toBe('momentSavedOffline');
    } finally {
      setDeviceOnline(true);
    }
  });

  it('a failed save stays in the editor with the edits intact and says so', async () => {
    jest.mocked(saveEdits).mockRejectedValueOnce(new Error('disk full'));
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Mono'));
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'keep me');
    await fireEvent.press(saveButton());
    await act(async () => {});

    expect(screen).toHavePathname('/edit/7');
    expect(screen.getByText('Couldn’t save your changes. Try again.')).toBeTruthy();
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { area: 'edit' });
    expect(screen.getByLabelText('Caption').props.value).toBe('keep me');
    expect(saveButton().props.accessibilityState).toMatchObject({ disabled: false });

    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(screen).toHavePathname('/today');
    expect(rows.get(7)).toMatchObject({ caption: 'keep me', edits: { v: 1, filter: 'mono', overlays: [] } });
  });

  it('reopening restores the saved filter, caption and visibility, and offers Done', async () => {
    rows.set(7, {
      ...item,
      editingSince: null,
      caption: 'Sinigang at the office pantry',
      visibility: 'only_me',
      edits: { v: 1, filter: 'merienda', overlays: [] },
    });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.merienda);
    expect(filterButton('Merienda').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    await goToDetails();
    expect(screen.getByLabelText('Caption').props.value).toBe('Sinigang at the office pantry');
    expect(selectedVisibility()).toEqual(['Only me']);
    expect(saveButton().props.accessibilityLabel).toBe('Done');
  });

  it('save, then reopen in the same app run: shows what was saved, not the copy read before', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Dusk'));
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'evening walk');
    await fireEvent.press(visibilityTab('Only me'));
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(screen).toHavePathname('/today');

    await push('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.dusk);
    await goToDetails();
    expect(screen.getByLabelText('Caption').props.value).toBe('evening walk');
    expect(selectedVisibility()).toEqual(['Only me']);
    expect(saveButton().props.accessibilityLabel).toBe('Done');
    // Editing it again is not another added moment.
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(trackMomentAdded).toHaveBeenCalledTimes(1);
  });

  it('Next, then Save, sit in the fixed top toolbar (FR-CAP-09), not in the content; Save is disabled while saving', async () => {
    let finish = () => {};
    jest.mocked(saveEdits).mockImplementationOnce(
      (id, input) =>
        new Promise<QueueItem>((resolve) => {
          finish = () => {
            const saved = { ...(rows.get(id) ?? item), ...input };
            rows.set(id, saved);
            resolve(saved);
          };
        }),
    );
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(within(screen.getByTestId('editor-toolbar')).getByTestId('editor-next')).toBeTruthy();
    expect(screen.queryByTestId('editor-save')).toBeNull();
    await goToDetails();
    expect(screen.queryByTestId('editor-next')).toBeNull();
    expect(screen.getAllByTestId('editor-save')).toHaveLength(1);
    expect(within(screen.getByTestId('editor-toolbar')).getByTestId('editor-save')).toBe(saveButton());
    expect(within(screen.getByTestId('editor-details')).queryByTestId('editor-save')).toBeNull();

    await fireEvent.press(saveButton());
    expect(saveButton().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(saveButton());
    expect(saveEdits).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(screen).toHavePathname('/today');
  });

  it('reads old or broken stored edits as Original without crashing', async () => {
    rows.set(7, { ...item, edits: { filter: 'warm', overlays: 'x' } });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.original);
    expect(filterButton('Original').props.accessibilityState).toMatchObject({ selected: true });
  });
});

describe('Overlays (M2-13)', () => {
  const savedEdits = {
    v: 1,
    filter: 'original',
    overlays: [
      { id: 's1', type: 'sticker', ...kape, x: 0.5, y: 0.5, scale: 0.3, rotation: 0 },
      { id: 's2', type: 'sticker', ...kape, x: 0.25, y: 0.75, scale: 0.2, rotation: 0.5 },
    ],
  };

  it('reopening draws the saved overlays; a change is one Undo step and Done saves it as data', async () => {
    rows.set(7, { ...item, edits: savedEdits, editingSince: null });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(screen.getByTestId('overlay-s1')).toBeTruthy();
    expect(screen.getByTestId('overlay-s2')).toBeTruthy();
    expect(screen.queryByTestId('editor-undo')).toBeNull();

    // Through the accessibility actions (the gestures have their own test): move s1 right, then delete s2.
    await fireEvent(screen.getByTestId('overlay-s1'), 'accessibilityAction', { nativeEvent: { actionName: 'right' } });
    expect(screen.getByTestId('overlay-s1-selected')).toBeTruthy();
    await fireEvent(screen.getByTestId('overlay-s2'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(screen.queryByTestId('overlay-s2')).toBeNull();
    await fireEvent.press(screen.getByTestId('editor-undo'));
    expect(screen.getByTestId('overlay-s2')).toBeTruthy();
    await fireEvent(screen.getByTestId('overlay-s2'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });

    await goToDetails();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(saveEdits).toHaveBeenCalledTimes(1);
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays).toHaveLength(1);
    expect(edits.overlays[0]).toMatchObject({ id: 's1', type: 'sticker', y: 0.5, scale: 0.3, rotation: 0 });
    expect(edits.overlays[0]?.x).toBeCloseTo(0.55, 10);
  });
});

describe('Bubble tool (M2-16)', () => {
  it('the Bubble tab adds a bubble by typing, draws it on the photo and Add to #slot saves it as data', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('tab', { name: 'Bubble' }));
    expect(screen.getByTestId('editor-panel-bubble')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('bubble-color-butter'));
    await fireEvent.changeText(screen.getByLabelText('Bubble text'), 'Lunch break, finally!');
    expect(screen.getByRole('button', { name: 'Speech bubble: Lunch break, finally!' })).toBeTruthy();

    await goToDetails();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to #afternoon' }));
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays).toEqual([
      expect.objectContaining({ type: 'bubble', shape: 'speech', color: 'butter', text: 'Lunch break, finally!' }),
    ]);
  });
});

describe('Text tool (M2-17)', () => {
  it('Text tab: typing shows the text, restyle, Undo, and Done saves the text and its style as data', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('tab', { name: 'Text' }));
    expect(screen.getByTestId('editor-panel-text')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Your text'), 'sinigang szn');
    const drawn = screen.getByRole('button', { name: 'Text: sinigang szn' });
    expect(within(drawn).getByText('sinigang szn')).toBeTruthy();
    expect(screen.getByTestId(`${drawn.props.testID as string}-selected`)).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Serif font' }));
    await fireEvent.press(screen.getByTestId('editor-text-background'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Sky blue' }));
    await fireEvent.press(screen.getByTestId('editor-undo')); // takes back the color only
    expect(screen.getByRole('radio', { name: 'Sky blue' }).props.accessibilityState).toMatchObject({ checked: false });

    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays).toEqual([
      expect.objectContaining({
        type: 'text',
        text: 'sinigang szn',
        font: 'serif',
        color: 'white',
        background: 'solid',
        size: 30,
        align: 'center',
        x: 0.5,
        y: 0.4,
      }),
    ]);
  });

  it('reopening draws saved text; selecting it on the Text tab edits it', async () => {
    const text = {
      id: 't1',
      type: 'text',
      x: 0.5,
      y: 0.4,
      scale: 0.5,
      rotation: 0,
      text: 'lola’s kitchen',
      font: 'type',
      color: 'butter',
      size: 30,
      align: 'left',
    };
    rows.set(7, { ...item, edits: { v: 1, filter: 'original', overlays: [text] }, editingSince: null });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(within(screen.getByTestId('overlay-t1')).getByText('lola’s kitchen')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: 'Text' }));
    await fireEvent(screen.getByTestId('overlay-t1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(screen.getByLabelText('Your text').props.value).toBe('lola’s kitchen');
    expect(screen.getByRole('radio', { name: 'Type font' }).props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.changeText(screen.getByLabelText('Your text'), 'lola’s kitchen ❤️');
    await fireEvent(screen.getByLabelText('Your text'), 'endEditing');
    expect(screen.getByRole('button', { name: 'Text: lola’s kitchen ❤️' })).toBeTruthy();

    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays[0]).toMatchObject({ id: 't1', text: 'lola’s kitchen ❤️', font: 'type', color: 'butter' });
  });
});

describe('An uploaded moment, from Moment options (M2-23)', () => {
  const USER = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';
  const MOMENT = '0f1e2d3c-4b5a-4968-8776-655443322110';
  const JAR = '11111111-2222-4333-8444-555555555555';
  const serverRow = {
    id: MOMENT,
    jar_id: JAR,
    slot: 'ootd',
    status: 'live',
    caption: 'fresh from the server',
    edits: { v: 1, filter: 'mono', overlays: [] },
    visibility: 'readers',
    captured_at: '2026-11-08T23:30:00Z', // 7:30 AM in Manila
    added_at: '2026-11-08T23:31:00Z',
    jars: { tz: 'Asia/Manila' },
  };

  beforeEach(() => {
    useAuthStore.getState().setSession({ user: { id: USER } } as Session);
    mockServer.row = serverRow;
    mockServer.reads = 0;
    jest.mocked(saveMomentEdits).mockClear();
  });

  it('opens with this opening’s fetch, not a cached copy, on the details step with the caption focused; Done saves on the server', async () => {
    // A copy from an earlier opening, restored from the persisted cache (JSON: no Date objects).
    queryClient.setQueryData(editableMomentQueryKey(USER, MOMENT), {
      id: MOMENT,
      jarId: JAR,
      slot: 'ootd',
      caption: 'before the last edit',
      edits: {},
      visibility: 'readers',
      shotAt: '2026-11-08T23:30:00.000Z',
      tz: 'Asia/Manila',
      photoUrl: 'https://photos.test/expired.webp',
    });
    await openEditor(`/edit/${MOMENT}?focus=caption`);
    await screen.findByTestId('editor-details');

    expect(mockServer.reads).toBe(1);
    // Edit caption opens straight on the details step (D-104): the photo step is behind it.
    expect(screen.queryByTestId('editor-screen')).toBeNull();
    expect(screen.getByTestId('editor-back')).toBeTruthy();
    const caption = screen.getByLabelText('Caption');
    expect(caption.props.value).toBe('fresh from the server');
    expect(caption.props.autoFocus).toBe(true);
    expect(matrixIn('editor-preview')).toEqual(filterMatrices.mono);
    expect(within(screen.getByTestId('editor-preview')).getByTestId('skia-image').props.accessibilityHint).toBe(
      `https://photos.test/${MOMENT}.webp`,
    );
    // Taken on another day: the slot tag names that day, not "Today".
    expect(screen.getByText('7:30 AM · Mon,\u00a0Nov\u00a09')).toBeTruthy();
    expect(screen.getByTestId('camera-slot-tag').props.accessibilityLabel).toBe('#ootd, Mon, Nov 9 at 7:30 AM');
    expect(saveButton().props.accessibilityLabel).toBe('Done');

    await fireEvent.changeText(caption, 'Green shirt day');
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveMomentEdits).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'server', momentId: MOMENT, jarId: JAR },
      { caption: 'Green shirt day', visibility: 'readers', edits: { v: 1, filter: 'mono', overlays: [] } },
    );
    expect(screen).toHavePathname('/today');
    expect(useToastStore.getState().current?.key).toBe('changesSaved');
    // A queued photo's hold and upload are not involved.
    expect(keepAsDraft).not.toHaveBeenCalled();
  });

  it('from the photo step: a filter, Next, Everyone, and Done saves the edits, caption and visibility on the server', async () => {
    await openEditor(`/edit/${MOMENT}`);
    await screen.findByTestId('editor-screen');
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.mono);
    // Its photo is changed with Moment options' Re-crop, not here.
    expect(screen.queryByTestId('editor-photo-tools')).toBeNull();
    await fireEvent.press(filterButton('Ube'));
    await goToDetails();
    expect(matrixIn('editor-preview')).toEqual(filterMatrices.ube);
    expect(screen.getByLabelText('Caption').props.autoFocus).toBe(false);
    await fireEvent.press(visibilityTab('Everyone'));
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveMomentEdits).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'server', momentId: MOMENT, jarId: JAR },
      { caption: 'fresh from the server', visibility: 'everyone', edits: { v: 1, filter: 'ube', overlays: [] } },
    );
    expect(screen).toHavePathname('/today');
  });

  it('says it couldn’t open a removed moment', async () => {
    mockServer.row = { ...serverRow, status: 'removed' };
    await openEditor(`/edit/${MOMENT}`);
    expect(await screen.findByTestId('editor-missing')).toHaveTextContent(
      'Couldn’t open this moment. Check your connection and try again.',
    );
  });
});

describe('Two steps: photo, then details (D-103)', () => {
  it('the photo step has the photo and its tools, Close and Next, but no caption, visibility or Save', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(screen.getByTestId('editor-photo')).toBeTruthy();
    expect(screen.getByTestId('editor-tools')).toBeTruthy();
    expect(screen.queryByLabelText('Caption')).toBeNull();
    expect(screen.queryByTestId('editor-visibility')).toBeNull();
    expect(screen.queryByTestId('editor-hashtag')).toBeNull();
    expect(screen.queryByTestId('editor-save')).toBeNull();
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.getByTestId('editor-next').props.accessibilityLabel).toBe('Next');
  });

  it('Next opens the details step with the edited photo drawn small, the slot hashtag and Back', async () => {
    rows.set(7, {
      ...item,
      edits: {
        v: 1,
        filter: 'original',
        overlays: [{ id: 's1', type: 'sticker', ...kape, x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }],
      },
    });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Mono'));
    await goToDetails();

    // The photo step is behind the details step, out of reach of touch and screen readers.
    expect(screen.queryByTestId('editor-screen')).toBeNull();
    expect(screen.queryByTestId('editor-tools')).toBeNull();
    expect(matrixIn('editor-preview')).toEqual(filterMatrices.mono);
    expect(within(screen.getByTestId('editor-preview')).getByTestId('skia-image').props.accessibilityHint).toBe(
      item.photoUri,
    );
    expect(within(screen.getByTestId('editor-preview')).getByTestId('moment-overlay-s1')).toBeTruthy();
    expect(screen.getByTestId('editor-hashtag').props.accessibilityLabel).toBe('Hashtag: #afternoon. Set by the slot.');
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(saveButton().props.accessibilityLabel).toBe('Add to #afternoon');
    expect(saveEdits).not.toHaveBeenCalled();
  });

  it('Back returns to the photo step with every edit kept; Next again keeps the caption and visibility', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Gabi'));
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'rainy commute');
    await fireEvent.press(visibilityTab('Only me'));

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('editor-screen')).toBeTruthy();
    expect(screen.queryByLabelText('Caption')).toBeNull();
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.gabi);
    expect(filterButton('Gabi').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(saveEdits).not.toHaveBeenCalled();
    expect(screen).toHavePathname('/edit/7');

    await fireEvent.press(filterButton('Luma'));
    await goToDetails();
    expect(screen.getByLabelText('Caption').props.value).toBe('rainy commute');
    expect(selectedVisibility()).toEqual(['Only me']);
    expect(matrixIn('editor-preview')).toEqual(filterMatrices.luma);

    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledWith(7, {
      caption: 'rainy commute',
      visibility: 'only_me',
      edits: { v: 1, filter: 'luma', overlays: [] },
    });
    expect(screen).toHavePathname('/today');
  });

  it('tapping the photo on the details step goes back to editing it, keeping the caption', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await goToDetails();
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'rainy commute');

    await fireEvent.press(screen.getByRole('button', { name: 'Edit photo' }));
    expect(screen.getByTestId('editor-screen')).toBeTruthy();
    expect(screen.queryByTestId('editor-details')).toBeNull();
    await goToDetails();
    expect(screen.getByLabelText('Caption').props.value).toBe('rainy commute');
    expect(saveEdits).not.toHaveBeenCalled();
  });

  it('`focus=caption` on a queued photo opens on the details step with the caption focused; Back goes to the photo step', async () => {
    rows.set(7, { ...item, editingSince: null, caption: 'merienda time' });
    await openEditor('/edit/7?focus=caption');
    await screen.findByTestId('editor-details');
    expect(screen.queryByTestId('editor-screen')).toBeNull();
    expect(screen.getByLabelText('Caption').props.autoFocus).toBe(true);
    expect(screen.getByLabelText('Caption').props.value).toBe('merienda time');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('editor-screen')).toBeTruthy();
    expect(screen).toHavePathname('/edit/7');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
    expect(saveEdits).not.toHaveBeenCalled();
  });
});

describe('Quick photo buttons (FR-CAP-04)', () => {
  const shown = (testID: string) =>
    within(screen.getByTestId(testID)).getByTestId('skia-image').props.accessibilityHint as string;

  beforeEach(() => jest.mocked(preparePhoto).mockClear());

  it('Rotate turns the photo at once with the overlays on it; Undo turns it back; Done saves the turned files with the edits', async () => {
    rows.set(7, {
      ...item,
      edits: {
        v: 1,
        filter: 'original',
        overlays: [{ id: 's1', type: 'sticker', ...kape, x: 0.5, y: 0.375, scale: 0.3, rotation: 0 }],
      },
    });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate photo' }));
    await act(async () => {});

    expect(preparePhoto).toHaveBeenCalledWith(item.photoUri, { rotate: 90, flip: false });
    expect(shown('editor-photo')).toBe('file:///cache/turned-90.webp');
    expect(shown('editor-filter-mono')).toBe('file:///cache/turned-90.webp');

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(shown('editor-photo')).toBe(item.photoUri);
    // Made once: turning again shows the same photo without making it again.
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate photo' }));
    await act(async () => {});
    expect(preparePhoto).toHaveBeenCalledTimes(1);
    expect(shown('editor-photo')).toBe('file:///cache/turned-90.webp');

    await goToDetails();
    expect(within(screen.getByTestId('editor-preview')).getByTestId('moment-view-photo')).toHaveProp('source', [
      { uri: 'file:///cache/turned-90.webp' },
    ]);
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledTimes(1);
    const [id, input, photo] = jest.mocked(saveEdits).mock.calls[0]!;
    expect(id).toBe(7);
    expect(photo).toEqual({ photoUri: 'file:///cache/turned-90.webp', thumbUri: 'file:///cache/turned-90-thumb.webp' });
    // The sticker above the middle is now right of the middle, still level.
    const sticker = (input.edits as { overlays: { x: number; y: number; rotation: number }[] }).overlays[0]!;
    expect(sticker.x).toBeCloseTo(0.5 + 320 / 1440);
    expect(sticker.y).toBeCloseTo(0.5);
    expect(sticker.rotation).toBe(0);
  });

  it('Flip after Rotate makes the photo from the opened one, with both', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate photo' }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Flip photo' }));
    await act(async () => {});
    expect(jest.mocked(preparePhoto).mock.calls.at(-1)).toEqual([item.photoUri, { rotate: 90, flip: true }]);
    expect(shown('editor-photo')).toBe('file:///cache/turned-90f.webp');
  });

  it('a photo that wasn’t changed saves without new files', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Flip photo' }));
    await act(async () => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Flip photo' }));
    await goToDetails();
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(jest.mocked(saveEdits).mock.calls[0]).toHaveLength(2);
  });

  it('says so and keeps the photo when it can’t be changed', async () => {
    jest.mocked(preparePhoto).mockRejectedValueOnce(new Error('decode failed'));
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Rotate photo' }));
    await act(async () => {});
    expect(screen.getByText('Couldn’t change the photo. Try again.')).toBeTruthy();
    expect(shown('editor-photo')).toBe(item.photoUri);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('waits for a just-taken photo to be prepared', async () => {
    rows.set(7, { ...item, photoUri: 'file:///cache/raw.jpg', prepared: false });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(screen.getByRole('button', { name: 'Rotate photo' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByRole('button', { name: 'Crop photo' }).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
