import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import EditScreen from '../../../../app/edit/[momentId]';
import { filterMatrices } from '../filters';
import { getItem, type QueueItem } from '@/lib/queue/store';

// Editor shell (FR-CAP-04): loads the queued photo, draws it with the selected filter's matrix, and
// switches tools. Skia's native canvas is replaced by plain views that expose what would be drawn.

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

jest.mock('@/lib/queue/store', () => ({ getItem: jest.fn() }));

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
  state: 'queued',
  attempts: 0,
  nextAttemptAt: null,
  lastError: null,
};

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
  'edit/[momentId]': EditScreen,
};

async function openEditor(url: string) {
  await renderRouter(routes, { initialUrl: '/today', wrapper });
  await act(async () => {
    const { router } = jest.requireActual<typeof import('expo-router')>('expo-router');
    router.push(url);
  });
}

const matrixIn = (testID: string) =>
  JSON.parse(within(screen.getByTestId(testID)).getByTestId('color-matrix').props.accessibilityValue.text) as number[];
const filterButton = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  jest.mocked(getItem).mockReset();
  jest.mocked(getItem).mockImplementation(async (id) => (id === 7 ? item : null));
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

  it('shows five thumbnails, each previewing the real photo through its own filter', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    for (const id of ['original', 'kalamansi', 'merienda', 'mono', 'dusk'] as const) {
      const thumb = screen.getByTestId(`editor-filter-${id}`);
      expect(within(thumb).getByTestId('skia-image').props.accessibilityHint).toBe(item.photoUri);
      expect(matrixIn(`editor-filter-${id}`)).toEqual(filterMatrices[id]);
    }
    expect(within(screen.getByTestId('editor-filters')).getAllByRole('button')).toHaveLength(5);
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
    expect(screen.getByTestId('editor-panel-stickers')).toBeTruthy();
    expect(screen.queryByTestId('editor-filters')).toBeNull();
    expect(matrixIn('editor-photo')).toEqual(filterMatrices.kalamansi);

    await fireEvent.press(screen.getByRole('tab', { name: 'Filters' }));
    expect(filterButton('Kalamansi').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('Close returns to where the editor was opened from', async () => {
    await openEditor('/edit/7');
    await screen.findByTestId('editor-screen');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen).toHavePathname('/today');
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
