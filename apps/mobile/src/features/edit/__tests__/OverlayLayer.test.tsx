// Gesture-handler's own jest mocks for its native module (not in the shared jest setup).
import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController } from 'react-native-gesture-handler/jest-utils';

import { editsSchema, type Edits } from '../edits';
import { OverlayLayer } from '../overlays/OverlayLayer';
import { registerPlaceholderRenderers } from '../overlays/PlaceholderOverlay';
import { unregisterOverlayRenderer } from '../overlays/registry';
import { useEditorState } from '../useEditorState';
import { kape } from './stickerFixture';

// The overlay layer (FR-CAP-05, FR-CAP-08): gestures driven through gesture-handler's jest utils and the
// accessibility actions, wired to the real editor state so each change and its Undo are checked on the
// edits that get saved. Placeholder boxes (aspect 1 : 2) stand in for stickers, bubbles and text.
jest.mock('react-native-reanimated', () => jest.requireActual('./reanimatedStandIn'));

const PHOTO = { width: 300, height: 400 };
const textContent = { text: 'hi', font: 'bold', color: 'white', size: 30, align: 'center' } as const;

const start: Edits = {
  v: 1,
  filter: 'original',
  overlays: [
    { id: 'a', type: 'sticker', ...kape, x: 0.2, y: 0.2, scale: 0.3, rotation: 0 },
    { id: 'b', type: 'bubble', x: 0.6, y: 0.6, scale: 0.4, rotation: 0, shape: 'speech', color: 'white', text: '' },
  ],
};

function Harness({ initial = start }: { initial?: Edits }) {
  const editor = useEditorState(initial);
  return (
    <GestureHandlerRootView>
      <OverlayLayer
        overlays={editor.edits.overlays}
        selectedId={editor.selectedId}
        width={PHOTO.width}
        height={PHOTO.height}
        onSelect={editor.selectOverlay}
        onTransform={editor.transformOverlay}
        onBringToFront={editor.bringToFront}
        onDelete={editor.deleteOverlay}
      />
      <Pressable accessibilityLabel="Undo" onPress={editor.undo} testID="undo" />
      {/* The edits that Save would write, read back by the assertions. */}
      <Text testID="edits">{JSON.stringify(editor.edits)}</Text>
      <Text testID="steps">{editor.canUndo ? 'can undo' : 'nothing to undo'}</Text>
    </GestureHandlerRootView>
  );
}

const edits = (): Edits => editsSchema.parse(JSON.parse(String(screen.getByTestId('edits').props.children)));
const overlay = (id: string) => edits().overlays.find((o) => o.id === id);
const order = () => edits().overlays.map((o) => o.id);
const isSelected = (id: string) => screen.queryByTestId(`overlay-${id}-selected`) !== null;

async function tap(x: number, y: number) {
  const tapper = createGestureController('overlay-tap');
  await act(() => {
    tapper.begin({ x, y });
    tapper.activate({ x, y });
    tapper.end({ x, y });
  });
}

async function drag(at: { x: number; y: number }, by: { x: number; y: number }) {
  const pan = createGestureController('overlay-pan');
  await act(() => {
    pan.begin({ x: at.x, y: at.y, translationX: 0, translationY: 0 });
    pan.activate({ x: at.x, y: at.y, translationX: 0, translationY: 0 });
    pan.update({ x: at.x + by.x / 2, y: at.y + by.y / 2, translationX: by.x / 2, translationY: by.y / 2 });
    pan.update({ x: at.x + by.x, y: at.y + by.y, translationX: by.x, translationY: by.y });
    pan.end({ x: at.x + by.x, y: at.y + by.y, translationX: by.x, translationY: by.y });
  });
}

beforeAll(() => registerPlaceholderRenderers());
afterAll(() => {
  unregisterOverlayRenderer('sticker');
  unregisterOverlayRenderer('bubble');
  unregisterOverlayRenderer('text');
});

// Overlay a on a 300 × 400 photo: centre (60, 80), 90 × 45. Overlay b: centre (180, 240), 120 × 60.

describe('OverlayLayer', () => {
  it('draws each overlay with its content at its size, last on top, and nothing for unregistered kinds', async () => {
    unregisterOverlayRenderer('text');
    await render(
      <Harness
        initial={{
          ...start,
          overlays: [
            ...start.overlays,
            { id: 't', type: 'text', x: 0.5, y: 0.5, scale: 0.2, rotation: 0, ...textContent },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('overlay-placeholder-a')).toHaveStyle({ width: 90, height: 45 });
    expect(screen.getByTestId('overlay-placeholder-b')).toHaveStyle({ width: 120, height: 60 });
    expect(screen.queryByTestId('overlay-t')).toBeNull();
    const drawn = screen.getAllByTestId(/^overlay-[ab]$/).map((v) => v.props.testID as string);
    expect(drawn).toEqual(['overlay-a', 'overlay-b']);
    registerPlaceholderRenderers();
  });

  it('places each overlay by its normalized transform', async () => {
    await render(<Harness />);
    // Top-left corner = centre − half the size; rotation in radians.
    expect(screen.getByTestId('overlay-a')).toHaveStyle({
      width: 90,
      height: 45,
      transform: [{ translateX: 15 }, { translateY: 57.5 }, { rotate: '0rad' }],
    });
    expect(screen.getByTestId('overlay-b')).toHaveStyle({
      transform: [{ translateX: 120 }, { translateY: 210 }, { rotate: '0rad' }],
    });
  });

  it('selects by tap, shows the outline and controls on the selected one only, and deselects on the photo', async () => {
    await render(<Harness />);
    expect(isSelected('a')).toBe(false);
    await tap(60, 80);
    expect(isSelected('a')).toBe(true);
    expect(isSelected('b')).toBe(false);
    expect(screen.getByTestId('overlay-a')).toBeSelected();
    // b is 60 tall: 29 below its centre is still on it.
    await tap(180, 240 + 29);
    expect(isSelected('b')).toBe(true);
    await tap(280, 20);
    expect(isSelected('a')).toBe(false);
    expect(isSelected('b')).toBe(false);
    expect(screen.getByTestId('steps')).toHaveTextContent('nothing to undo');
  });

  it("deletes with a tap on the selected overlay's delete circle, and Undo brings it back", async () => {
    await render(<Harness />);
    await tap(60, 80);
    // a's delete circle: 2 points right of and above its top-right corner (105, 57.5).
    await tap(107, 55.5);
    expect(order()).toEqual(['b']);
    expect(screen.queryByTestId('overlay-a')).toBeNull();
    await fireEvent.press(screen.getByTestId('undo'));
    expect(edits()).toEqual(start);
  });

  it('a tap where the delete circle would be does not delete an unselected overlay', async () => {
    await render(<Harness />);
    await tap(107, 55.5);
    expect(order()).toEqual(['a', 'b']);
  });

  it('drags an overlay by its body, brings it to the front, and records one Undo step', async () => {
    await render(<Harness />);
    await drag({ x: 60, y: 80 }, { x: 30, y: -40 });
    // 30 px on a 300-wide photo = 0.1; −40 px on a 400-tall photo = −0.1.
    expect(overlay('a')?.x).toBeCloseTo(0.3, 10);
    expect(overlay('a')?.y).toBeCloseTo(0.1, 10);
    expect(overlay('a')?.scale).toBe(0.3);
    expect(order()).toEqual(['b', 'a']);
    expect(isSelected('a')).toBe(true);
    await fireEvent.press(screen.getByTestId('undo'));
    expect(edits()).toEqual(start);
    expect(screen.getByTestId('steps')).toHaveTextContent('nothing to undo');
  });

  it('keeps the centre on the photo however far it is dragged', async () => {
    await render(<Harness />);
    await drag({ x: 180, y: 240 }, { x: 900, y: -900 });
    expect(overlay('b')).toMatchObject({ x: 1, y: 0 });
  });

  it('a drag that starts on empty photo moves nothing', async () => {
    await render(<Harness />);
    await drag({ x: 280, y: 20 }, { x: -100, y: 100 });
    expect(edits()).toEqual(start);
    expect(screen.getByTestId('steps')).toHaveTextContent('nothing to undo');
  });

  it('pinches and twists the selected overlay together as one step, clamping the size', async () => {
    await render(<Harness />);
    await tap(180, 240);
    const pinch = createGestureController('overlay-pinch');
    const rotate = createGestureController('overlay-rotation');
    // The fingers' midpoint is off the overlay: two-finger gestures still work on the selected one.
    await act(() => {
      pinch.begin({ focalX: 20, focalY: 380, scale: 1 });
      pinch.activate({ focalX: 20, focalY: 380, scale: 1 });
      rotate.begin({ anchorX: 20, anchorY: 380, rotation: 0 });
      rotate.activate({ anchorX: 20, anchorY: 380, rotation: 0 });
      pinch.update({ focalX: 20, focalY: 380, scale: 1.5 });
      rotate.update({ anchorX: 20, anchorY: 380, rotation: 0.4 });
      pinch.end({ focalX: 20, focalY: 380, scale: 1.5 });
    });
    // One finger still down: nothing committed yet.
    expect(edits()).toEqual(start);
    await act(() => rotate.end({ anchorX: 20, anchorY: 380, rotation: 0.4 }));
    expect(overlay('b')?.scale).toBeCloseTo(0.6, 10);
    expect(overlay('b')?.rotation).toBeCloseTo(0.4, 10);
    expect(overlay('b')).toMatchObject({ x: 0.6, y: 0.6 });

    const big = createGestureController('overlay-pinch');
    await act(() => {
      big.begin({ focalX: 180, focalY: 240, scale: 1 });
      big.activate({ focalX: 180, focalY: 240, scale: 1 });
      big.update({ focalX: 180, focalY: 240, scale: 10 });
      big.end({ focalX: 180, focalY: 240, scale: 10 });
    });
    expect(overlay('b')?.scale).toBe(2);

    await fireEvent.press(screen.getByTestId('undo'));
    expect(overlay('b')?.scale).toBeCloseTo(0.6, 10);
    await fireEvent.press(screen.getByTestId('undo'));
    expect(edits()).toEqual(start);
  });

  it('pinching with nothing selected and the fingers off every overlay does nothing', async () => {
    await render(<Harness />);
    const pinch = createGestureController('overlay-pinch');
    await act(() => {
      pinch.begin({ focalX: 280, focalY: 20, scale: 1 });
      pinch.activate({ focalX: 280, focalY: 20, scale: 1 });
      pinch.update({ focalX: 280, focalY: 20, scale: 2 });
      pinch.end({ focalX: 280, focalY: 20, scale: 2 });
    });
    expect(edits()).toEqual(start);
  });

  it('the corner handle resizes and rotates about the centre with one finger', async () => {
    await render(<Harness />);
    await tap(60, 80);
    // a's handle sits 3 points past its bottom-right corner (105, 102.5): at (108, 105.5), i.e. (48, 25.5)
    // from the centre (60, 80). Moving it to (60 − 25.5·2, 80 + 48·2) doubles the distance and turns it a
    // quarter turn clockwise.
    await drag({ x: 108, y: 105.5 }, { x: 60 - 51 - 108, y: 80 + 96 - 105.5 });
    expect(overlay('a')?.scale).toBeCloseTo(0.6, 10);
    expect(overlay('a')?.rotation).toBeCloseTo(Math.PI / 2, 10);
    expect(overlay('a')).toMatchObject({ x: 0.2, y: 0.2 });
  });

  it('offers move, resize, rotate, bring to front and delete as accessibility actions', async () => {
    await render(<Harness />);
    const a = screen.getByTestId('overlay-a');
    expect(a).toHaveAccessibleName('sticker overlay');
    const names = (a.props.accessibilityActions as { name: string; label?: string }[]).map((x) => x.label ?? x.name);
    expect(names).toEqual([
      'activate',
      'Move left',
      'Move right',
      'Move up',
      'Move down',
      'Make bigger',
      'Make smaller',
      'Rotate left',
      'Rotate right',
      'Bring to front',
      'Delete',
    ]);

    await fireEvent(a, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(isSelected('a')).toBe(true);
    await fireEvent(screen.getByTestId('overlay-b'), 'accessibilityAction', { nativeEvent: { actionName: 'right' } });
    expect(overlay('b')?.x).toBeCloseTo(0.65, 10);
    expect(isSelected('b')).toBe(true);
    await fireEvent(screen.getByTestId('overlay-b'), 'accessibilityAction', { nativeEvent: { actionName: 'bigger' } });
    expect(overlay('b')?.scale).toBeCloseTo(0.5, 10);
    await fireEvent(screen.getByTestId('overlay-b'), 'accessibilityAction', {
      nativeEvent: { actionName: 'rotateLeft' },
    });
    expect(overlay('b')?.rotation).toBeCloseTo(-Math.PI / 12, 10);
    await fireEvent(screen.getByTestId('overlay-a'), 'accessibilityAction', {
      nativeEvent: { actionName: 'bringToFront' },
    });
    expect(order()).toEqual(['b', 'a']);
    await fireEvent(screen.getByTestId('overlay-a'), 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(order()).toEqual(['b']);

    for (let i = 0; i < 5; i += 1) await fireEvent.press(screen.getByTestId('undo'));
    expect(edits()).toEqual(start);
  });
});
