import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
// After the testing library, which brings gesture-handler's jest mocks and its own Reanimated mock.
import './mockReanimated';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import EditScreen from '../../../../app/edit/[momentId]';
import { editsSchema } from '../edits';
import { filterIdSchema, filterMatrices } from '../filters';
import { kape } from './stickerFixture';
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { getItem, releaseEditing, saveEdits, type QueueItem } from '@/lib/queue/store';
import { saveMomentEdits } from '@/features/moment/momentActions';
import { trackMomentAdded } from '@/features/capture/momentAnalytics';
import { editableMomentQueryKey } from '@/features/moment/useEditableMoment';
import { useAuthStore } from '@/lib/authStore';
import type { Session } from '@supabase/supabase-js';

// Editor (FR-CAP-04, FR-CAP-08, FR-CAP-09): loads the queued photo, draws it with the selected filter's
// matrix, switches tools, and saves the caption, privacy and edits into the queue item. Skia's native
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
    useImage: jest.fn((uri: string | undefined) => (uri ? { uri } : null)),
  };
});

jest.mock('@/lib/queue/store', () => ({ getItem: jest.fn(), saveEdits: jest.fn(), releaseEditing: jest.fn() }));
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
  isPrivate: false,
  edits: {},
  createdAt: Date.parse('2026-11-11T06:14:00.000Z'),
  jarId: null,
  momentId: null,
  prepared: true,
  editingSince: Date.parse('2026-11-11T06:14:05.000Z'),
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
  'edit/[momentId]': EditScreen,
};

async function push(url: string) {
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push(url);
  });
}

async function openEditor(url: string) {
  await renderRouter(routes, { initialUrl: '/today', wrapper });
  await push(url);
}

const matrixIn = (testID: string) =>
  JSON.parse(within(screen.getByTestId(testID)).getByTestId('color-matrix').props.accessibilityValue.text) as number[];
const filterButton = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  queryClient = new QueryClient();
  rows.clear();
  rows.set(7, item);
  jest.mocked(getItem).mockReset();
  jest.mocked(getItem).mockImplementation(async (id) => rows.get(id) ?? null);
  jest.mocked(saveEdits).mockReset();
  jest.mocked(saveEdits).mockImplementation(async (id, input) => {
    const row = rows.get(id);
    if (!row) throw new Error(`No queued moment ${id}`);
    const saved = { ...row, ...input, editingSince: null };
    rows.set(id, saved);
    return saved;
  });
  jest.mocked(releaseEditing).mockReset();
  jest.mocked(releaseEditing).mockImplementation(async (id) => {
    const row = rows.get(id);
    if (row) rows.set(id, { ...row, editingSince: null });
  });
  jest.mocked(requestUploads).mockClear();
  jest.mocked(captureError).mockClear();
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
    expect(screen.getByTestId('camera-slot-tag').props.accessibilityLabel).toBe('#afternoon, today at 2:14 PM');
  });

  it('shows eleven thumbnails, each previewing the real photo through its own filter', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    for (const id of filterIdSchema.options) {
      const thumb = screen.getByTestId(`editor-filter-${id}`);
      expect(within(thumb).getByTestId('skia-image').props.accessibilityHint).toBe(item.photoUri);
      expect(matrixIn(`editor-filter-${id}`)).toEqual(filterMatrices[id]);
    }
    expect(within(screen.getByTestId('editor-filters')).getAllByRole('button')).toHaveLength(11);
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

  it('Close returns to where the editor was opened from, keeps the photo queued unedited and lets it upload', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'not kept');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
    await act(async () => {});
    expect(saveEdits).not.toHaveBeenCalled();
    expect(releaseEditing).toHaveBeenCalledWith(7);
    expect(requestUploads).toHaveBeenCalled();
    // The order matters: the hold ends before the worker looks at the queue.
    expect(jest.mocked(releaseEditing).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requestUploads).mock.invocationCallOrder[0] ?? 0,
    );
    expect(rows.get(7)).toMatchObject({ caption: null, edits: {}, editingSince: null });
    // Closed as it is, the photo is still added: public, as queued (NFR-ANL-01).
    expect(jest.mocked(trackMomentAdded).mock.calls).toEqual([[expect.objectContaining({ id: 7 }), false]]);
  });

  it.each(['/edit/abc', '/edit/0', '/edit/1.5'])(
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
const privateSwitch = () => screen.getByRole('switch', { name: 'Keep this moment private. Only you will see it' });

describe('Caption, privacy, Undo and save (M2-12)', () => {
  it('shows the empty caption with its counter, privacy off, no Undo, and "Add to #slot" for a photo just taken', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    const field = screen.getByLabelText('Caption');
    expect(field.props.value).toBe('');
    expect(field.props.maxLength).toBe(150);
    expect(screen.getByText('0 / 150')).toBeTruthy();
    expect(privateSwitch().props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(saveButton().props.accessibilityLabel).toBe('Add to #afternoon');
  });

  it('counts the caption as it is typed', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
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

  it('Add to #slot saves caption, privacy and edits (as data) into the queue item, returns to Today and wakes the uploader', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Kalamansi'));
    await fireEvent.changeText(screen.getByLabelText('Caption'), '  Lunch break, finally!  ');
    await fireEvent.press(privateSwitch());
    expect(privateSwitch().props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(saveButton());
    await act(async () => {});

    expect(saveEdits).toHaveBeenCalledTimes(1);
    // The photo file is not part of the save: the filter is stored as data, never applied to the file.
    expect(saveEdits).toHaveBeenCalledWith(7, {
      caption: 'Lunch break, finally!',
      isPrivate: true,
      edits: { v: 1, filter: 'kalamansi', overlays: [] },
    });
    expect(rows.get(7)?.photoUri).toBe(item.photoUri);
    expect(screen).toHavePathname('/today');
    expect(requestUploads).toHaveBeenCalled();
    expect(jest.mocked(saveEdits).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(requestUploads).mock.invocationCallOrder[0] ?? 0,
    );
    // Added once, with the privacy chosen here (leaving the editor afterwards adds nothing more).
    expect(jest.mocked(trackMomentAdded).mock.calls).toEqual([[expect.objectContaining({ id: 7 }), true]]);
  });

  it('saves an empty or blank caption as no caption', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.changeText(screen.getByLabelText('Caption'), '   ');
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveEdits).toHaveBeenCalledWith(7, expect.objectContaining({ caption: null, isPrivate: false }));
  });

  it('a failed save stays in the editor with the edits intact and says so', async () => {
    jest.mocked(saveEdits).mockRejectedValueOnce(new Error('disk full'));
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Mono'));
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

  it('reopening restores the saved filter, caption and privacy, and offers Done', async () => {
    rows.set(7, {
      ...item,
      editingSince: null,
      caption: 'Sinigang at the office pantry',
      isPrivate: true,
      edits: { v: 1, filter: 'merienda', overlays: [] },
    });
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.merienda);
    expect(filterButton('Merienda').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Caption').props.value).toBe('Sinigang at the office pantry');
    expect(privateSwitch().props.accessibilityState).toMatchObject({ checked: true });
    expect(saveButton().props.accessibilityLabel).toBe('Done');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('save, then reopen in the same app run: shows what was saved, not the copy read before', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(filterButton('Dusk'));
    await fireEvent.changeText(screen.getByLabelText('Caption'), 'evening walk');
    await fireEvent.press(privateSwitch());
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(screen).toHavePathname('/today');

    await push('/edit/7');
    await screen.findByTestId('editor-screen');
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.dusk);
    expect(screen.getByLabelText('Caption').props.value).toBe('evening walk');
    expect(privateSwitch().props.accessibilityState).toMatchObject({ checked: true });
    expect(saveButton().props.accessibilityLabel).toBe('Done');
    // Editing it again is not another added moment.
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(trackMomentAdded).toHaveBeenCalledTimes(1);
  });

  it('Save sits in the fixed top toolbar (FR-CAP-09), not below the panel, and is disabled while saving', async () => {
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
    expect(screen.getAllByTestId('editor-save')).toHaveLength(1);
    expect(within(screen.getByTestId('editor-toolbar')).getByTestId('editor-save')).toBe(saveButton());
    expect(within(screen.getByTestId('editor-screen')).queryByTestId('editor-save')).toBeNull();

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

    await fireEvent.press(screen.getByRole('button', { name: 'Add to #afternoon' }));
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays).toEqual([
      expect.objectContaining({ type: 'bubble', shape: 'speech', color: 'butter', text: 'Lunch break, finally!' }),
    ]);
  });
});

describe('Text tool (M2-17)', () => {
  it('Text tab: type, Add text, restyle, Undo, and Done saves the text and its style as data', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('tab', { name: 'Text' }));
    expect(screen.getByTestId('editor-panel-text')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Your text'), 'sinigang szn');
    await fireEvent.press(screen.getByRole('button', { name: 'Add text' }));
    const drawn = screen.getByRole('button', { name: 'Text: sinigang szn' });
    expect(within(drawn).getByText('sinigang szn')).toBeTruthy();
    expect(screen.getByTestId(`${drawn.props.testID as string}-selected`)).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Serif font' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Sky blue' }));
    await fireEvent.press(screen.getByTestId('editor-undo')); // takes back the color only
    expect(screen.getByRole('radio', { name: 'Sky blue' }).props.accessibilityState).toMatchObject({ checked: false });

    await fireEvent.press(saveButton());
    await act(async () => {});
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays).toEqual([
      expect.objectContaining({
        type: 'text',
        text: 'sinigang szn',
        font: 'serif',
        color: 'white',
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
    is_private: false,
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

  it('opens with this opening’s fetch, not a cached copy, caption focused; Done saves on the server', async () => {
    // A copy from an earlier opening, restored from the persisted cache (JSON: no Date objects).
    queryClient.setQueryData(editableMomentQueryKey(USER, MOMENT), {
      id: MOMENT,
      jarId: JAR,
      slot: 'ootd',
      caption: 'before the last edit',
      edits: {},
      isPrivate: false,
      shotAt: '2026-11-08T23:30:00.000Z',
      tz: 'Asia/Manila',
      photoUrl: 'https://photos.test/expired.webp',
    });
    await openEditor(`/edit/${MOMENT}?focus=caption`);
    await screen.findByTestId('editor-screen');

    expect(mockServer.reads).toBe(1);
    const caption = screen.getByLabelText('Caption');
    expect(caption.props.value).toBe('fresh from the server');
    expect(caption.props.autoFocus).toBe(true);
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.mono);
    expect(screen.getAllByTestId('skia-image')[0]?.props.accessibilityHint).toBe(`https://photos.test/${MOMENT}.webp`);
    expect(screen.getByText(/7:30/)).toBeTruthy();
    expect(saveButton().props.accessibilityLabel).toBe('Done');

    await fireEvent.changeText(caption, 'Green shirt day');
    await fireEvent.press(saveButton());
    await act(async () => {});
    expect(saveMomentEdits).toHaveBeenCalledWith(
      expect.anything(),
      { kind: 'server', momentId: MOMENT, jarId: JAR },
      { caption: 'Green shirt day', isPrivate: false, edits: { v: 1, filter: 'mono', overlays: [] } },
    );
    expect(screen).toHavePathname('/today');
    // A queued photo's hold and upload are not involved.
    expect(releaseEditing).not.toHaveBeenCalled();
  });

  it('says it couldn’t open a removed moment', async () => {
    mockServer.row = { ...serverRow, status: 'removed' };
    await openEditor(`/edit/${MOMENT}`);
    expect(await screen.findByTestId('editor-missing')).toHaveTextContent(
      'Couldn’t open this moment. Check your connection and try again.',
    );
  });
});
