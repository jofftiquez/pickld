import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { editsSchema, type Edits } from '../edits';
import { TextPanel } from '../text/TextPanel';
import { applyTextChange, naturalScale, type TextOverlay } from '../text/textOverlay';
import { useEditorState } from '../useEditorState';

// The Text panel (FR-CAP-07, design: Text, after Instagram's stories) wired to the real editor state the
// way EditPhotoStep wires it, so each control is checked on the edits that get saved and on Undo.

function Harness({ initial }: { initial: Edits }) {
  const editor = useEditorState(initial);
  const selected =
    editor.edits.overlays.find((o): o is TextOverlay => o.type === 'text' && o.id === editor.selectedId) ?? null;
  return (
    <>
      <TextPanel
        selected={selected}
        textCount={editor.edits.overlays.filter((o) => o.type === 'text').length}
        onAdd={editor.addOverlay}
        onChange={(id, patch, group) =>
          editor.updateOverlay(id, (o) => (o.type === 'text' ? applyTextChange(o, patch) : o), group)
        }
        onDeselect={() => editor.selectOverlay(null)}
      />
      <Text onPress={() => editor.selectOverlay('old')} testID="select">
        select
      </Text>
      <Text testID="edits">{JSON.stringify(editor.edits)}</Text>
      <Text testID="selected">{String(editor.selectedId)}</Text>
      <Text onPress={editor.undo} testID="undo">
        {editor.canUndo ? 'can undo' : 'nothing to undo'}
      </Text>
    </>
  );
}

const empty: Edits = { v: 1, filter: 'original', overlays: [] };
// A text saved before backgrounds and outlines, in a color the panel no longer offers.
const saved: TextOverlay = {
  id: 'old',
  type: 'text',
  x: 0.3,
  y: 0.7,
  scale: 0.6,
  rotation: 0.2,
  text: 'sinigang szn',
  font: 'serif',
  color: 'butter',
  size: 40,
  align: 'left',
};
const withSaved: Edits = { ...empty, overlays: [saved] };

const PALETTE = [
  'White',
  'Black',
  'Gray',
  'Red',
  'Orange',
  'Yellow',
  'Pickle green',
  'Teal',
  'Blue',
  'Purple',
  'Pink',
  'Sky blue',
];
const FONTS = ['Clean', 'Bold', 'Type', 'Serif', 'Script', 'Strong', 'Marker', 'Hand'].map((f) => `${f} font`);

const edits = (): Edits => editsSchema.parse(JSON.parse(String(screen.getByTestId('edits').props.children)));
const texts = () => edits().overlays.filter((o): o is TextOverlay => o.type === 'text');
const field = () => screen.getByLabelText('Your text');
const radio = (name: string) => screen.getByRole('radio', { name });
const checked = (name: string) => radio(name).props.accessibilityState?.checked === true;
const isOn = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked === true;
const undo = () => fireEvent.press(screen.getByTestId('undo'));
const undoState = () => screen.getByTestId('undo').props.children;
const background = () => screen.getByTestId('editor-text-background');

describe('TextPanel writing a new text', () => {
  it('starts empty with the designed defaults, twelve colors and no size control', async () => {
    await render(<Harness initial={empty} />);
    expect(field().props.value).toBe('');
    expect(field().props.maxLength).toBe(80);
    expect(field().props.multiline).toBe(true);
    expect(FONTS.filter(checked)).toEqual(['Bold font']);
    expect(screen.getAllByRole('radio', { name: /font$/ })).toHaveLength(8);
    const colors = screen.getByTestId('editor-text-colors');
    expect(colors.props.accessibilityLabel).toBe('Text color');
    expect(PALETTE.map((c) => screen.getByTestId(`editor-text-color-${PALETTE_KEYS[c]}`))).toHaveLength(12);
    expect(PALETTE.filter((c) => isOn(`editor-text-color-${PALETTE_KEYS[c]}`))).toEqual(['White']);
    expect(screen.queryByTestId('editor-text-color-butter')).toBeNull();
    expect(['Align left', 'Align center'].filter(checked)).toEqual(['Align center']);
    expect(background().props.accessibilityLabel).toBe('No background');
    expect(isOn('editor-text-outline')).toBe(false);
    expect(screen.queryByTestId('editor-text-outline-colors')).toBeNull();
    expect(screen.queryByRole('adjustable')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add text' })).toBeNull();
    expect(screen.queryByTestId('editor-text-new')).toBeNull();
  });

  it('shows the text on the photo from the first letter, with the style set up first, and typing is one Undo step', async () => {
    await render(<Harness initial={empty} />);
    await fireEvent.press(radio('Serif font'));
    await fireEvent.press(screen.getByTestId('editor-text-color-pickle'));
    await fireEvent.press(radio('Align left'));
    await fireEvent.press(background());
    // Setting up the next text is not an edit yet.
    expect(undoState()).toBe('nothing to undo');
    expect(texts()).toHaveLength(0);

    await fireEvent.changeText(field(), 's');
    expect(texts()).toHaveLength(1);
    const id = texts()[0]?.id;
    expect(screen.getByTestId('selected').props.children).toBe(id);
    await fireEvent.changeText(field(), 'si');
    await fireEvent.changeText(field(), 'sinigang szn');
    expect(texts()).toHaveLength(1);
    const added = texts()[0];
    expect(added).toMatchObject({
      id,
      text: 'sinigang szn',
      font: 'serif',
      color: 'pickle',
      align: 'left',
      size: 30,
      background: 'solid',
      x: 0.5,
      y: 0.4,
    });
    expect(added).not.toHaveProperty('outline');
    expect(added?.scale).toBeCloseTo(
      naturalScale({ text: 'sinigang szn', font: 'serif', size: 30, background: 'solid' }),
      10,
    );
    expect(field().props.value).toBe('sinigang szn');
    // Once there is a text, New text starts another.
    expect(screen.getByTestId('editor-text-new')).toBeTruthy();

    await undo();
    expect(texts()).toHaveLength(0);
    expect(undoState()).toBe('nothing to undo');
    expect(field().props.value).toBe('');
  });

  it('fast typing before the new text comes back selected still makes one text', async () => {
    await render(<Harness initial={empty} />);
    // Both keystrokes land before the panel re-renders with the text it added.
    await act(() => {
      field().props.onChangeText('L');
      field().props.onChangeText('Laz');
    });
    expect(texts().map((t) => t.text)).toEqual(['Laz']);
  });

  it('keeps the lines typed with Return', async () => {
    await render(<Harness initial={empty} />);
    await fireEvent.changeText(field(), 'sinigang\nszn');
    expect(texts()[0]?.text).toBe('sinigang\nszn');
    expect(texts()[0]?.scale).toBeCloseTo(naturalScale({ text: 'sinigang\nszn', font: 'bold', size: 30 }), 10);
  });

  it('Done shows only while typing, since Return starts a new line', async () => {
    await render(<Harness initial={empty} />);
    expect(screen.queryByTestId('editor-text-done')).toBeNull();
    await fireEvent(field(), 'focus');
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    await fireEvent(field(), 'endEditing');
    expect(screen.queryByTestId('editor-text-done')).toBeNull();
  });

  it('a blank text is never added', async () => {
    await render(<Harness initial={empty} />);
    await fireEvent.changeText(field(), '    ');
    expect(texts()).toHaveLength(0);
    expect(field().props.value).toBe('    ');
  });

  it('New text lets go of the text, and the next one goes below it as its own Undo step', async () => {
    await render(<Harness initial={empty} />);
    await fireEvent.changeText(field(), 'one');
    await fireEvent.press(screen.getByTestId('editor-text-new'));
    expect(screen.getByTestId('selected').props.children).toBe('null');
    expect(field().props.value).toBe('');
    await fireEvent.changeText(field(), 'two');
    expect(texts().map((t) => [t.text, t.y])).toEqual([
      ['one', 0.4],
      ['two', 0.5],
    ]);
    expect(texts()[0]?.id).not.toBe(texts()[1]?.id);

    await undo();
    expect(texts().map((t) => t.text)).toEqual(['one']);
    await undo();
    expect(texts()).toHaveLength(0);
  });
});

describe('TextPanel editing a selected text', () => {
  async function open() {
    await render(<Harness initial={withSaved} />);
    await fireEvent.press(screen.getByTestId('select'));
  }

  it('shows the selected text and its settings, an old color selecting no swatch', async () => {
    await open();
    expect(field().props.value).toBe('sinigang szn');
    expect(checked('Serif font')).toBe(true);
    expect(checked('Align left')).toBe(true);
    expect(PALETTE.filter((c) => isOn(`editor-text-color-${PALETTE_KEYS[c]}`))).toEqual([]);
    expect(background().props.accessibilityLabel).toBe('No background');
  });

  it('font, color and alignment each change the text as one step, keeping its place and zoom', async () => {
    await open();
    await fireEvent.press(radio('Marker font'));
    await fireEvent.press(screen.getByTestId('editor-text-color-ink'));
    await fireEvent.press(radio('Align center'));
    expect(texts()[0]).toMatchObject({ id: 'old', font: 'marker', color: 'ink', align: 'center', size: 40 });
    expect(texts()[0]).toMatchObject({ x: 0.3, y: 0.7, rotation: 0.2 });
    const zoom = saved.scale / naturalScale(saved);
    expect(texts()[0]?.scale).toBeCloseTo(naturalScale({ ...saved, font: 'marker' }) * zoom, 10);

    for (const expected of [{ align: 'left' }, { color: 'butter' }, { font: 'serif' }]) {
      await undo();
      expect(texts()[0]).toMatchObject(expected);
    }
    expect(texts()[0]).toEqual(saved);
    expect(undoState()).toBe('nothing to undo');
  });

  it('the background cycles none, solid, soft and back; none is not saved', async () => {
    await open();
    await fireEvent.press(background());
    expect(texts()[0]?.background).toBe('solid');
    expect(background().props.accessibilityLabel).toBe('Solid background');
    expect(background().props.accessibilityHint).toBe('Changes to Soft background');
    await fireEvent.press(background());
    expect(texts()[0]?.background).toBe('soft');
    await fireEvent.press(background());
    expect(texts()[0]).toEqual(saved);
    expect(background().props.accessibilityLabel).toBe('No background');

    await undo();
    expect(texts()[0]?.background).toBe('soft');
  });

  it('the outline starts in the color that stands out from the text, takes its own color, and comes off', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('editor-text-outline'));
    // Butter is light, so its outline starts black.
    expect(texts()[0]?.outline).toBe('ink');
    expect(isOn('editor-text-outline')).toBe(true);
    expect(isOn('editor-text-outline-color-ink')).toBe(true);
    expect(screen.getByTestId('editor-text-outline-colors').props.accessibilityLabel).toBe('Outline color');

    await fireEvent.press(screen.getByTestId('editor-text-outline-color-red'));
    expect(texts()[0]?.outline).toBe('red');
    // The text color is separate from the outline's.
    expect(texts()[0]?.color).toBe('butter');

    await fireEvent.press(screen.getByTestId('editor-text-outline'));
    expect(texts()[0]).toEqual(saved);
    expect(screen.queryByTestId('editor-text-outline-colors')).toBeNull();

    await undo();
    expect(texts()[0]?.outline).toBe('red');
    await undo();
    expect(texts()[0]?.outline).toBe('ink');
    await undo();
    expect(texts()[0]).toEqual(saved);
  });

  it('typing changes the text live as one step; blank goes back to the saved text when editing ends', async () => {
    await open();
    await fireEvent.changeText(field(), 'sinigang');
    expect(texts()[0]?.text).toBe('sinigang');
    await fireEvent.changeText(field(), 'sinigang szn!! ');
    expect(texts()[0]?.text).toBe('sinigang szn!! ');
    await fireEvent(field(), 'endEditing');
    expect(texts()[0]?.text).toBe('sinigang szn!!');

    await fireEvent.changeText(field(), '   ');
    expect(texts()[0]?.text).toBe('sinigang szn!!');
    await fireEvent(field(), 'endEditing');
    expect(field().props.value).toBe('sinigang szn!!');

    await undo();
    expect(texts()[0]).toEqual(saved);
    expect(field().props.value).toBe('sinigang szn');
    expect(undoState()).toBe('nothing to undo');
  });

  it('every control has a spoken name and a 44-point target', async () => {
    await open();
    await fireEvent.press(screen.getByTestId('editor-text-outline'));
    const controls = [
      ...screen.getAllByRole('radio'),
      ...screen.getAllByRole('switch'),
      background(),
      screen.getByTestId('editor-text-new'),
    ];
    for (const c of controls) {
      expect(c.props.accessibilityLabel).toBeTruthy();
      const { width, height, minHeight } = StyleSheet.flatten(c.props.style) as Record<string, number | undefined>;
      const slop = (c.props.hitSlop as { top?: number } | undefined)?.top ?? 0;
      if (height !== undefined || minHeight !== undefined) {
        expect(Math.max(height ?? 0, minHeight ?? 0) + 2 * slop).toBeGreaterThanOrEqual(44);
      }
      if (width !== undefined) expect(width + 2 * slop).toBeGreaterThanOrEqual(44);
    }
  });
});

const PALETTE_KEYS: Record<string, string> = {
  White: 'white',
  Black: 'ink',
  Gray: 'gray',
  Red: 'red',
  Orange: 'orange',
  Yellow: 'yellow',
  'Pickle green': 'pickle',
  Teal: 'teal',
  Blue: 'blue',
  Purple: 'purple',
  Pink: 'pink',
  'Sky blue': 'sky',
};
