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

  it('leads with the text, then the styles, the flip and the colors', async () => {
    await render(<Harness />);
    const order = ['bubble-text', 'bubble-styles', 'bubble-tail', 'bubble-colors'];
    type Node = { props: Record<string, unknown>; children: (Node | string)[] | null };
    const found: string[] = [];
    const walk = (n: Node | Node[] | string | null) => {
      if (n === null || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const id = n.props.testID;
      if (typeof id === 'string' && order.includes(id)) found.push(id);
      n.children?.forEach(walk);
    };
    walk(screen.toJSON() as Node | Node[] | null);
    expect([...new Set(found)]).toEqual(order);
  });

  it('typing the first letter shows a speech bubble with it on the photo straight away', async () => {
    await render(<Harness />);
    await fireEvent.changeText(field(), 'K');
    expect(edits().overlays).toMatchObject([{ id: 'nb1', shape: 'speech', color: 'white', text: 'K', tail: 'left' }]);
    expect(edits().overlays[0]).not.toHaveProperty('cloud');
    expect(screen.getByRole('button', { name: 'Speech bubble: K' })).toBeTruthy();
  });

  it('picking Thought for an older pill thought turns it into a cloud', async () => {
    const old = {
      id: 'p1',
      type: 'bubble' as const,
      x: 0.5,
      y: 0.5,
      scale: 0.5,
      rotation: 0,
      shape: 'thought' as const,
      color: 'white' as const,
      text: 'Hmm',
    };
    await render(<Harness initial={{ v: 1, filter: 'original', overlays: [old] }} />);
    expect(screen.queryByTestId('bubble-p1-cloud')).toBeNull();
    await fireEvent(screen.getByTestId('overlay-p1'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    await fireEvent.press(styleButton('Thought'));
    expect(edits().overlays[0]).toMatchObject({ id: 'p1', shape: 'thought', cloud: true, text: 'Hmm' });
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
        tail: 'left', // new bubbles save their side
        cloud: true, // new thoughts are clouds
      },
    ]);
    expect(screen.getByTestId('overlay-nb1-selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thought bubble, no text yet' })).toBeTruthy();
    expect(screen.getByTestId('bubble-nb1-cloud')).toBeTruthy();
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

  it('flips the selected bubble’s tail; a bubble saved without one reads as the left; each flip is one Undo step', async () => {
    const saved: Edits = {
      ...EMPTY,
      overlays: [
        {
          id: 'old',
          type: 'bubble',
          x: 0.5,
          y: 0.5,
          scale: 0.5,
          rotation: 0,
          shape: 'speech',
          color: 'white',
          text: 'hi',
        },
      ],
    };
    await render(<Harness initial={saved} />);
    await fireEvent(screen.getByTestId('overlay-old'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
    expect(screen.getByTestId('bubble-old-tail-left')).toBeTruthy();
    const flip = () => screen.getByTestId('bubble-tail');
    expect(flip().props.accessibilityLabel).toBe('Tail on the left, flip to the right');
    await fireEvent.press(flip());
    expect(edits().overlays).toEqual([{ ...saved.overlays[0], tail: 'right' }]);
    expect(flip().props.accessibilityLabel).toBe('Tail on the right, flip to the left');
    expect(screen.getByTestId('bubble-old-tail-right')).toBeTruthy(); // drawn on the photo
    await fireEvent.press(flip());
    expect(edits().overlays).toEqual([{ ...saved.overlays[0], tail: 'left' }]);
    await undo();
    expect(edits().overlays).toEqual([{ ...saved.overlays[0], tail: 'right' }]);
    await undo();
    expect(edits()).toEqual(saved);
  });

  it('with nothing selected, a flip sets the side of the next bubble', async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByTestId('bubble-tail'));
    expect(edits().overlays).toEqual([]); // a flip alone adds nothing
    expect(screen.getByTestId('bubble-tail').props.accessibilityLabel).toBe('Tail on the right, flip to the left');
    await fireEvent.changeText(field(), 'Hello');
    expect(edits().overlays[0]).toMatchObject({ id: 'nb1', text: 'Hello', tail: 'right' });
  });

  it('the flip button has a 44-point tall touch area and a visible label', async () => {
    await render(<Harness />);
    const button = screen.getByTestId('bubble-tail');
    const height = flat(button.props.style).minHeight as number;
    expect(height + button.props.hitSlop.top + button.props.hitSlop.bottom).toBeGreaterThanOrEqual(44);
    expect(flat(button.props.style).minWidth).toBeGreaterThanOrEqual(44);
    expect(within(button).getByText('Flip')).toBeTruthy();
    expect(screen.getByText('Tail', { includeHiddenElements: true })).toBeTruthy();
    expect(button.props.accessibilityHint).toBe('Changes the selected bubble, or the next one');
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
