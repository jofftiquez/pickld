import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
// After the testing library, which brings gesture-handler's jest mocks and its own Reanimated mock.
import './mockReanimated';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import EditScreen from '../../../../app/edit/[momentId]';
import { editsSchema } from '../edits';
import { stickerArt } from '../stickers/stickerArt';
import { stickerRows, type Viewer } from './stickerRows';
import { useAuthStore } from '@/lib/authStore';
import { getItem, releaseEditing, saveEdits, type QueueItem } from '@/lib/queue/store';

// The Stickers tool in the editor (FR-CAP-05, FR-STK-01..03; design: Stickers): the catalog read from
// Supabase (a fake answering with 0012's rows and usable flags), the "For #slot" row first, tapping a
// sticker adds it at the centre as one Undo step, and Done saves it as data. Skia and the queue are
// replaced as in EditScreen.test.

jest.mock('@shopify/react-native-skia', () => {
  const { View: MockView } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Canvas: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
      <MockView testID={testID}>{children}</MockView>
    ),
    Image: ({ children }: { children?: ReactNode }) => <MockView>{children}</MockView>,
    ColorMatrix: () => <MockView />,
    useImage: jest.fn((uri: string | undefined) => (uri ? { uri } : null)),
  };
});

jest.mock('@/lib/queue/store', () => ({ getItem: jest.fn(), saveEdits: jest.fn(), releaseEditing: jest.fn() }));
jest.mock('@/lib/queue/runner', () => ({ requestUploads: jest.fn(async () => undefined) }));
jest.mock('@/lib/monitoring', () => ({ captureError: jest.fn() }));

const mockBackend: { offline: boolean; viewer: Viewer; reads: string[] } = { offline: false, viewer: {}, reads: [] };

jest.mock('@/lib/supabase', () => {
  const { packRows: packs, stickerRows: stickers } =
    jest.requireActual<typeof import('./stickerRows')>('./stickerRows');
  const answer = (table: string) => {
    mockBackend.reads.push(table);
    if (mockBackend.offline) return { data: null, error: { message: 'TypeError: Network request failed' } };
    if (table === 'sticker_packs') return { data: packs(mockBackend.viewer), error: null };
    if (table === 'stickers') return { data: stickers(mockBackend.viewer), error: null };
    return { data: null, error: null }; // onboarding_answers: none
  };
  const client = {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        is: () => builder,
        maybeSingle: async () => answer(table),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(answer(table)).then(resolve, reject),
      };
      return builder;
    },
  };
  return { getSupabase: () => client };
});

const USER = '7b0b6a2e-3c1f-4f53-9a51-0c9a0b1d2e3f';

const item: QueueItem = {
  id: 7,
  userId: USER,
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

let queryClient = new QueryClient();
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/today': () => (
    <View>
      <Text>Today stub</Text>
    </View>
  ),
  'edit/[momentId]': EditScreen,
  'stickers/pack/[slug]': function PackStub() {
    const { slug } = jest.requireActual<typeof import('expo-router')>('expo-router').useLocalSearchParams();
    return <Text>{`Pack preview stub ${String(slug)}`}</Text>;
  },
  'stickers/shop': () => <Text>Shop stub</Text>,
};

async function openStickers() {
  await renderRouter(routes, { initialUrl: '/today', wrapper });
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push('/edit/7');
  });
  await screen.findByTestId('editor-screen');
  await fireEvent.press(screen.getByRole('tab', { name: 'Stickers' }));
}

const tabLabels = () =>
  within(screen.getByTestId('stickers-tabs'))
    .getAllByRole('tab')
    .map((tab) => tab.props.accessibilityLabel as string);
const optionLabels = () =>
  within(screen.getByTestId('stickers-grid'))
    .getAllByRole('button')
    .map((b) => b.props.accessibilityLabel as string);
// The overlays on the photo (OverlayItem: testID overlay-<id>), not the grid's buttons.
const stickerOverlays = () =>
  screen.queryAllByRole('button').filter((b) => String(b.props.testID).startsWith('overlay-'));

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mockBackend.offline = false;
  mockBackend.viewer = {};
  mockBackend.reads = [];
  useAuthStore.setState({ status: 'signedIn', session: { user: { id: USER } } as Session, error: null });
  jest.mocked(getItem).mockReset();
  jest.mocked(getItem).mockImplementation(async (id) => (id === item.id ? item : null));
  jest.mocked(saveEdits).mockReset();
  jest.mocked(saveEdits).mockImplementation(async (_id, input) => ({ ...item, ...input, editingSince: null }));
  jest.mocked(releaseEditing).mockReset();
  jest.mocked(releaseEditing).mockResolvedValue(undefined);
});

describe('Stickers tool', () => {
  it('leads with "For #afternoon", then the usable packs; unearned packs are not offered', async () => {
    await openStickers();
    await screen.findByTestId('stickers-panel');
    expect(tabLabels()).toEqual(['For #afternoon', 'Everyday', 'The Eight', 'Stamps']);
    expect(screen.getByRole('tab', { name: 'For #afternoon' }).props.accessibilityState).toEqual({ selected: true });
    expect(optionLabels()).toEqual([
      'Add the Lunch break sticker',
      'Add the Merienda time sticker',
      'Add the Afternoon slump sticker',
      'Add the Siesta? sticker',
      'Add the Halfway there sticker',
    ]);
    expect(screen.queryByText('Noche Buena')).toBeNull();

    await fireEvent.press(screen.getByRole('tab', { name: 'Everyday' }));
    expect(optionLabels()).toHaveLength(15);
    expect(optionLabels()[0]).toBe('Add the Kape muna sticker');
  });

  it('shows a pack on sale that the user lacks as a locked tab that opens Pack preview, never its stickers (FR-STK-06)', async () => {
    await openStickers();
    await screen.findByTestId('stickers-panel');
    const locked = screen.getByRole('button', { name: 'Christmas, locked' });
    // After the usable packs, and not a tab: it never shows its stickers in the grid.
    expect(within(screen.getByTestId('stickers-tabs')).getAllByRole('tab')).toHaveLength(4);
    await fireEvent.press(locked);
    expect(await screen.findByText('Pack preview stub christmas')).toBeTruthy();
  });

  it('links to the shop under the grid while a pack is for sale', async () => {
    await openStickers();
    await screen.findByTestId('stickers-panel');
    // The pack on sale here is premium, not seasonal, so the banner doesn't name it.
    expect(screen.getByRole('link', { name: 'More sticker packs' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'More sticker packs' }));
    expect(await screen.findByText('Shop stub')).toBeTruthy();
  });

  it('fades the grid’s bottom edge while more rows remain below, and drops the fade at the end', async () => {
    await openStickers();
    await screen.findByTestId('stickers-panel');
    await fireEvent.press(screen.getByRole('tab', { name: 'Everyday' }));
    const grid = screen.getByTestId('stickers-grid');
    const fade = () => screen.queryByTestId('stickers-grid-fade', { includeHiddenElements: true });
    // Five rows of 58 behind a 145-tall window (two and a half rows).
    await fireEvent(grid, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 145 } } });
    await fireEvent(grid, 'contentSizeChange', 320, 282);
    expect(fade()).toBeTruthy();
    await fireEvent.scroll(grid, { nativeEvent: { contentOffset: { x: 0, y: 137 } } });
    expect(fade()).toBeNull();
  });

  it('shows the Milestones pack with only the stickers earned', async () => {
    mockBackend.viewer = { earned: ['first_full_jar'] };
    await openStickers();
    await screen.findByTestId('stickers-panel');
    expect(tabLabels()).toEqual(['For #afternoon', 'Everyday', 'The Eight', 'Stamps', 'Milestones']);
    await fireEvent.press(screen.getByRole('tab', { name: 'Milestones' }));
    expect(optionLabels()).toEqual(['Add the First full jar sticker']);
  });

  it('tapping a sticker adds its art at the centre, selected; Undo takes it back in one step; Done saves it as data', async () => {
    await openStickers();
    await screen.findByTestId('stickers-panel');
    expect(screen.queryByTestId('editor-undo')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add the Siesta? sticker' }));
    const [overlay] = stickerOverlays();
    expect(stickerOverlays()).toHaveLength(1);
    expect(overlay?.props.accessibilityLabel).toBe('Siesta? sticker');
    expect(overlay?.props.accessibilityState).toEqual({ selected: true });
    const art = within(overlay as NonNullable<typeof overlay>).getByTestId(/^sticker-/);
    expect(JSON.stringify(art.props.source)).toContain(
      JSON.stringify(stickerArt['stickers/the-eight/siesta.png']?.source),
    );

    await fireEvent.press(screen.getByTestId('editor-undo'));
    expect(stickerOverlays()).toHaveLength(0);
    expect(screen.queryByTestId('editor-undo')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Add the Siesta? sticker' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add the Lunch break sticker' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Add to #afternoon' }));
    const edits = editsSchema.parse(jest.mocked(saveEdits).mock.calls[0]?.[1].edits);
    expect(edits.overlays).toHaveLength(2);
    expect(edits.overlays[0]).toMatchObject({
      type: 'sticker',
      stickerId: stickerRows().find((s) => s.label === 'Siesta?')?.id,
      asset: 'stickers/the-eight/siesta.png',
      label: 'Siesta?',
      x: 0.5,
      y: 0.5,
      rotation: 0,
    });
    expect(edits.overlays[1]).toMatchObject({ asset: 'stickers/everyday/lunch-break.png' });
    expect(edits.overlays[0]?.id).not.toBe(edits.overlays[1]?.id);
  });

  it('auto stamps show the photo’s own time, date and weekday, in the grid and on the photo', async () => {
    await openStickers();
    await fireEvent.press(await screen.findByRole('tab', { name: 'Stamps' }));
    const grid = within(screen.getByTestId('stickers-grid'));
    expect(grid.getByText('2:14 PM')).toBeTruthy();
    expect(grid.getByText('NOV 11')).toBeTruthy();
    expect(grid.getByText('WEDNESDAY')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Add the Time sticker' }));
    const [overlay] = stickerOverlays();
    expect(within(overlay as NonNullable<typeof overlay>).getByText('2:14 PM')).toBeTruthy();
    const edits = editsSchema.parse((await saveAndRead()).edits);
    expect(edits.overlays[0]).toMatchObject({ stamp: 'time', asset: 'stickers/stamps/time.png' });
  });

  it('offline with nothing cached says so; Try again loads it once back online', async () => {
    mockBackend.offline = true;
    await openStickers();
    expect(await screen.findByTestId('stickers-unavailable')).toBeTruthy();
    expect(screen.getByText('Stickers need a connection the first time. Try again when you’re online.')).toBeTruthy();

    mockBackend.offline = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('stickers-panel')).toBeTruthy();
    expect(tabLabels()[0]).toBe('For #afternoon');
  });

  it('opens from the cached catalog without waiting on the network', async () => {
    mockBackend.offline = true;
    queryClient.setQueryData(['stickerCatalog', USER], {
      packs: [
        {
          id: 'p',
          slug: 'everyday',
          name: 'Everyday',
          stickers: [
            {
              id: 's',
              label: 'Kape muna',
              asset: 'stickers/everyday/kape-muna.png',
              tags: [],
              slotHint: null,
              stamp: null,
            },
          ],
        },
      ],
      interests: [],
    });
    await openStickers();
    expect(screen.getByTestId('stickers-panel')).toBeTruthy();
    expect(tabLabels()).toEqual(['Everyday']);
    expect(optionLabels()).toEqual(['Add the Kape muna sticker']);
  });
});

async function saveAndRead() {
  await fireEvent.press(screen.getByRole('button', { name: 'Add to #afternoon' }));
  const input = jest.mocked(saveEdits).mock.calls.at(-1)?.[1];
  if (!input) throw new Error('not saved');
  return input;
}
