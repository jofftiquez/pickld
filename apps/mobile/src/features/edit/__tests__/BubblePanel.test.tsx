// Gesture-handler's own jest mocks for its native module (not in the shared jest setup).
import 'react-native-gesture-handler/jestSetup';

import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BubblePanel } from '../bubble/BubblePanel';
import { registerBubbleRenderer } from '../bubble/BubbleOverlay';
import { editsSchema, type Edits } from '../edits';
import { OverlayLayer } from '../overlays/OverlayLayer';
import { unregisterOverlayRenderer } from '../overlays/registry';
import { useEditorState } from '../useEditorState';

// The Bubble panel (FR-CAP-06, design: Bubble) wired to the real editor state and overlay layer, so each
// tap and keystroke is checked on the edits that get saved, the bubble drawn on the photo and Undo.
jest.mock('react-native-reanimated', () => jest.requireActual('./reanimatedStandIn'));

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: mockFontScale }),
}));

const EMPTY: Edits = { v: 1, filter: 'original', overlays: [] };
let ids = 0;
const newId = () => `nb${(ids += 1)}`;

function Harness({ initial = EMPTY }: { initial?: Edits }) {
  const editor = useEditorState(initial);
  return (
    <GestureHandlerRootView>
      <OverlayLayer
        overlays={editor.edits.overlays}
        selectedId={editor.selectedId}
        width={300}
        height={400}
        onSelect={editor.selectOverlay}
        onTransform={editor.transformOverlay}
        onBringToFront={editor.bringToFront}
        onDelete={editor.deleteOverlay}
      />
      <BubblePanel
        overlays={editor.edits.overlays}
        selectedId={editor.selectedId}
        onAdd={editor.addOverlay}
        onUpdate={editor.updateOverlay}
        newId={newId}
      />
      <Pressable accessibilityLabel="Undo" onPress={editor.undo} testID="undo" />
      <Pressable accessibilityLabel="Deselect" onPress={() => editor.selectOverlay(null)} testID="deselect" />
      <Text testID="edits">{JSON.stringify(editor.edits)}</Text>
    </GestureHandlerRootView>
  );
}

const edits = (): Edits => editsSchema.parse(JSON.parse(String(screen.getByTestId('edits').props.children)));
const styleButton = (name: string) => within(screen.getByTestId('bubble-styles')).getByRole('button', { name });
const colorButton = (name: string) => within(screen.getByTestId('bubble-colors')).getByRole('button', { name });
const field = () => screen.getByLabelText('Bubble text');
const flat = (style: unknown): ViewStyle => (StyleSheet.flatten(style as ViewStyle) ?? {}) as ViewStyle;
const undo = () => fireEvent.press(screen.getByTestId('undo'));

beforeAll(() => registerBubbleRenderer());
afterAll(() => unregisterOverlayRenderer('bubble'));
beforeEach(() => {
  ids = 0;
  mockFontScale = 1;
});

describe('BubblePanel', () => {
  it('shows the four styles, six colors and the text field with its 60-character counter', async () => {
    await render(<Harness />);
    const styles = within(screen.getByTestId('bubble-styles')).getAllByRole('button');
    expect(styles.map((b) => b.props.accessibilityLabel)).toEqual(['Speech', 'Thought', 'Shout', 'Whisper']);
    expect(styleButton('Speech').props.accessibilityState).toMatchObject({ selected: true });
    const colors = within(screen.getByTestId('bubble-colors')).getAllByRole('button');
    expect(colors.map((b) => b.props.accessibilityLabel)).toEqual([
      'White',
      'Black',
      'Green',
      'Yellow',
      'Pink',
      'Blue',
    ]);
    expect(colorButton('White').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('Color', { includeHiddenElements: true })).toBeTruthy(); // visual label; each swatch speaks its own name
    expect(field().props.maxLength).toBe(60);
    expect(field().props.value).toBe('');
    expect(screen.getByText('0 / 60')).toBeTruthy();
  });

  it('every choice has a 44 × 44 touch area', async () => {
    await render(<Harness />);
    const swatch = colorButton('Yellow');
    const size = flat(swatch.props.style).width as number;
    expect(size + swatch.props.hitSlop.left + swatch.props.hitSlop.right).toBeGreaterThanOrEqual(44);
    expect(size + swatch.props.hitSlop.top + swatch.props.hitSlop.bottom).toBeGreaterThanOrEqual(44);
    expect(flat(styleButton('Shout').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('a style tap adds a bubble with the chosen color, selected on the photo; Undo removes it', async () => {
    await render(<Harness />);
    await fireEvent.press(colorButton('Yellow'));
    expect(edits().overlays).toEqual([]); // a color alone adds nothing
    await fireEvent.press(styleButton('Thought'));
    expect(edits().overlays).toEqual([
      {
        id: 'nb1',
        type: 'bubble',
        x: 0.5,
        y: 0.3,
        scale: 0.6,
        rotation: 0,
        shape: 'thought',
        color: 'butter',
        text: '',
      },
    ]);
    expect(screen.getByTestId('overlay-nb1-selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thought bubble, no text yet' })).toBeTruthy();
    await undo();
    expect(edits().overlays).toEqual([]);
  });

  it('typing with nothing selected adds a bubble with that text; the whole typing run is one Undo step', async () => {
    await render(<Harness />);
    await fireEvent.press(styleButton('Shout')); // adds nb1
    await fireEvent.press(screen.getByTestId('deselect'));
    expect(styleButton('Shout').props.accessibilityState).toMatchObject({ selected: true }); // remembered
    await fireEvent.changeText(field(), ' '); // blank: nothing added
    expect(edits().overlays).toHaveLength(1);
    await fireEvent.changeText(field(), 'H');
    await fireEvent.changeText(field(), 'Hi');
    await fireEvent.changeText(field(), 'Hi!');
    expect(edits().overlays[1]).toMatchObject({ id: 'nb2', shape: 'shout', color: 'white', text: 'Hi!' });
    expect(field().props.value).toBe('Hi!');
    expect(screen.getByText('3 / 60')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shout bubble: Hi!' })).toBeTruthy();
    expect(screen.getByText('Hi!')).toBeTruthy(); // drawn on the photo
    await undo();
    expect(edits().overlays.map((o) => o.id)).toEqual(['nb1']);
  });

  it('with a bubble selected, the panel shows and edits it in place', async () => {
    const saved: Edits = {
      ...EMPTY,
      overlays: [
        {
          id: 'old',
          type: 'bubble',
          x: 0.2,
          y: 0.8,
          scale: 0.5,
          rotation: 0.3,
          shape: 'whisper',
          color: 'sky',
          text: 'psst',
        },
      ],
    };
    await render(<Harness initial={saved} />);
    expect(field().props.value).toBe(''); // nothing selected yet
    await fireEvent(screen.getByTestId('overlay-old'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(field().props.value).toBe('psst');
    expect(styleButton('Whisper').props.accessibilityState).toMatchObject({ selected: true });
    expect(colorButton('Blue').props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.changeText(field(), 'psst, over here');
    await fireEvent.press(styleButton('Speech'));
    await fireEvent.press(colorButton('Pink'));
    expect(edits().overlays).toEqual([
      { ...saved.overlays[0], shape: 'speech', color: 'blush', text: 'psst, over here' },
    ]);
    await undo();
    await undo();
    expect(edits().overlays[0]).toMatchObject({ shape: 'whisper', color: 'sky', text: 'psst, over here' });
    await undo();
    expect(edits()).toEqual(saved);
  });

  it('enforces the 60-character limit on pasted text and turns line breaks into spaces', async () => {
    await render(<Harness />);
    await fireEvent.changeText(field(), `line one\nline two ${'x'.repeat(80)}`);
    const text = edits().overlays[0]?.type === 'bubble' ? (edits().overlays[0] as { text: string }).text : '';
    expect(text).toHaveLength(60);
    expect(text.startsWith('line one line two x')).toBe(true);
    expect(screen.getByText('60 / 60')).toBeTruthy();
  });

  it('a bubble transforms like a sticker: moved by its accessibility action, one Undo step', async () => {
    await render(<Harness />);
    await fireEvent.press(styleButton('Speech'));
    await fireEvent(screen.getByTestId('overlay-nb1'), 'accessibilityAction', { nativeEvent: { actionName: 'down' } });
    expect(edits().overlays[0]?.y).toBeCloseTo(0.35, 10);
    await undo();
    expect(edits().overlays[0]?.y).toBe(0.3);
  });

  it('lays the styles out in two columns with large text, four otherwise', async () => {
    await render(<Harness />);
    expect(flat(styleButton('Speech').props.style).flexBasis).toBe(0);
    mockFontScale = 2;
    await render(<Harness />);
    expect(flat(styleButton('Speech').props.style).flexBasis).toBe('45%');
  });
});
