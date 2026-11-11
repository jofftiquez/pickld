import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { editsSchema, type Edits } from '../edits';
import { TextPanel } from '../text/TextPanel';
import { applyTextChange, naturalScale, type TextOverlay } from '../text/textOverlay';
import { useEditorState } from '../useEditorState';

// The Text panel (FR-CAP-07, design: Text) wired to the real editor state, the way EditorView wires it,
// so each control is checked on the edits that get saved and on Undo.

function Harness({ initial }: { initial: Edits }) {
  const editor = useEditorState(initial);
  const selected =
    editor.edits.overlays.find((o): o is TextOverlay => o.type === 'text' && o.id === editor.selectedId) ?? null;
  return (
    <>
      <TextPanel
        key={selected ? `${selected.id}:${selected.text}` : 'new'}
        selected={selected}
        onAdd={editor.addOverlay}
        onChange={(id, patch) => editor.updateOverlay(id, (o) => (o.type === 'text' ? applyTextChange(o, patch) : o))}
      />
      <Text testID="edits">{JSON.stringify(editor.edits)}</Text>
      <Text testID="selected">{String(editor.selectedId)}</Text>
      <Text onPress={editor.undo} testID="undo">
        {editor.canUndo ? 'can undo' : 'nothing to undo'}
      </Text>
    </>
  );
}

const empty: Edits = { v: 1, filter: 'original', overlays: [] };
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

const edits = (): Edits => editsSchema.parse(JSON.parse(String(screen.getByTestId('edits').props.children)));
const texts = () => edits().overlays.filter((o): o is TextOverlay => o.type === 'text');
const field = () => screen.getByLabelText('Your text');
const radio = (name: string) => screen.getByRole('radio', { name });
const checked = (name: string) => radio(name).props.accessibilityState?.checked === true;
const slider = () => screen.getByRole('adjustable', { name: 'Text size' });

describe('TextPanel', () => {
  it('starts empty with the designed defaults: Bold, white, size 30, centered', async () => {
    await render(<Harness initial={empty} />);
    expect(field().props.value).toBe('');
    expect(field().props.maxLength).toBe(80);
    expect(screen.getByText('0 / 80')).toBeTruthy();
    expect(['Clean font', 'Bold font', 'Type font', 'Serif font'].filter(checked)).toEqual(['Bold font']);
    expect(['White', 'Black', 'Pickle green', 'Butter yellow', 'Blush pink', 'Sky blue'].filter(checked)).toEqual([
      'White',
    ]);
    expect(['Align left', 'Align center'].filter(checked)).toEqual(['Align center']);
    expect(slider().props.accessibilityValue).toEqual({ min: 12, max: 64, now: 30 });
    expect(screen.getByRole('button', { name: 'Add text' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('Add text adds the trimmed text with the chosen style, selects it, and Undo takes it away', async () => {
    await render(<Harness initial={empty} />);
    await fireEvent.press(radio('Serif font'));
    await fireEvent.press(radio('Pickle green'));
    await fireEvent.press(radio('Align left'));
    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    // Setting up the next text is not an edit yet.
    expect(screen.getByTestId('undo').props.children).toBe('nothing to undo');

    await fireEvent.changeText(field(), '  sinigang szn  ');
    expect(screen.getByText('16 / 80')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add text' }));

    expect(texts()).toHaveLength(1);
    const added = texts()[0];
    expect(added).toMatchObject({ text: 'sinigang szn', font: 'serif', color: 'pickle', align: 'left', size: 32 });
    expect(added?.scale).toBeCloseTo(naturalScale({ text: 'sinigang szn', font: 'serif', size: 32 }), 10);
    expect(screen.getByTestId('selected').props.children).toBe(added?.id);
    // Now the panel edits it: the field shows its text and there is nothing to add.
    expect(field().props.value).toBe('sinigang szn');
    expect(screen.queryByRole('button', { name: 'Add text' })).toBeNull();

    await fireEvent.press(screen.getByTestId('undo'));
    expect(texts()).toHaveLength(0);
    expect(screen.getByTestId('undo').props.children).toBe('nothing to undo');
    expect(field().props.value).toBe('');
  });

  it('a blank text cannot be added', async () => {
    await render(<Harness initial={empty} />);
    await fireEvent.changeText(field(), '    ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add text' }));
    expect(texts()).toHaveLength(0);
  });
});

describe('TextPanel editing a selected overlay', () => {
  function Selected() {
    const editor = useEditorState({ ...empty, overlays: [saved] });
    const selected =
      editor.edits.overlays.find((o): o is TextOverlay => o.type === 'text' && o.id === editor.selectedId) ?? null;
    return (
      <>
        <Text onPress={() => editor.selectOverlay('old')} testID="select">
          select
        </Text>
        <TextPanel
          key={selected ? `${selected.id}:${selected.text}` : 'new'}
          selected={selected}
          onAdd={editor.addOverlay}
          onChange={(id, patch) => editor.updateOverlay(id, (o) => (o.type === 'text' ? applyTextChange(o, patch) : o))}
        />
        <Text testID="edits">{JSON.stringify(editor.edits)}</Text>
        <Text onPress={editor.undo} testID="undo">
          {editor.canUndo ? 'can undo' : 'nothing to undo'}
        </Text>
      </>
    );
  }

  async function open() {
    await render(<Selected />);
    await fireEvent.press(screen.getByTestId('select'));
  }

  it('shows the selected overlay’s text and settings', async () => {
    await open();
    expect(field().props.value).toBe('sinigang szn');
    expect(checked('Serif font')).toBe(true);
    expect(checked('Butter yellow')).toBe(true);
    expect(checked('Align left')).toBe(true);
    expect(slider().props.accessibilityValue).toMatchObject({ now: 40 });
  });

  it('font, color, alignment and size each change the overlay as one step, keeping its place', async () => {
    await open();
    await fireEvent.press(radio('Clean font'));
    await fireEvent.press(radio('Black'));
    await fireEvent.press(radio('Align center'));
    await fireEvent(slider(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(texts()[0]).toMatchObject({ id: 'old', font: 'clean', color: 'ink', align: 'center', size: 38 });
    expect(texts()[0]).toMatchObject({ x: 0.3, y: 0.7, rotation: 0.2 });
    expect(checked('Black')).toBe(true);

    for (const expected of [{ size: 40 }, { align: 'left' }, { color: 'butter' }, { font: 'serif' }]) {
      await fireEvent.press(screen.getByTestId('undo'));
      expect(texts()[0]).toMatchObject(expected);
    }
    expect(texts()[0]).toEqual(saved);
    expect(screen.getByTestId('undo').props.children).toBe('nothing to undo');
  });

  it('typing changes the text when editing ends, as one step; blank goes back to the saved text', async () => {
    await open();
    await fireEvent.changeText(field(), 'sinigang');
    await fireEvent.changeText(field(), 'sinigang szn!!');
    expect(texts()[0]?.text).toBe('sinigang szn'); // not yet
    await fireEvent(field(), 'endEditing');
    expect(texts()[0]?.text).toBe('sinigang szn!!');
    expect(field().props.value).toBe('sinigang szn!!');

    await fireEvent.changeText(field(), '   ');
    await fireEvent(field(), 'endEditing');
    expect(texts()[0]?.text).toBe('sinigang szn!!');
    expect(field().props.value).toBe('sinigang szn!!');

    await fireEvent.press(screen.getByTestId('undo'));
    expect(texts()[0]).toEqual(saved);
    expect(field().props.value).toBe('sinigang szn');
  });

  it('dragging the slider moves the thumb live and commits once, when the finger lifts', async () => {
    await open();
    await fireEvent(slider(), 'layout', { nativeEvent: { layout: { width: 222, height: 44 } } });
    // Track travel is 200 (222 − the 22-point thumb), starting 11 in: 12 at x=11, 64 at x=211.
    await fireEvent(slider(), 'responderGrant', { nativeEvent: { locationX: 11, pageX: 100 } });
    expect(slider().props.accessibilityValue).toMatchObject({ now: 12 });
    await fireEvent(slider(), 'responderMove', { nativeEvent: { locationX: 0, pageX: 200 } });
    expect(slider().props.accessibilityValue).toMatchObject({ now: 38 });
    await fireEvent(slider(), 'responderMove', { nativeEvent: { locationX: 0, pageX: 900 } });
    expect(slider().props.accessibilityValue).toMatchObject({ now: 64 });
    expect(texts()[0]?.size).toBe(40); // nothing saved mid-drag
    await fireEvent(slider(), 'responderRelease', { nativeEvent: {} });
    expect(texts()[0]?.size).toBe(64);
    await fireEvent.press(screen.getByTestId('undo'));
    expect(texts()[0]?.size).toBe(40);
    expect(screen.getByTestId('undo').props.children).toBe('nothing to undo');
  });

  it('every control has a spoken name and a 44-point target', async () => {
    await open();
    for (const r of screen.getAllByRole('radio')) {
      expect(r.props.accessibilityLabel).toBeTruthy();
      const { width, height, minHeight } = StyleSheet.flatten(r.props.style) as Record<string, number | undefined>;
      const slop = (r.props.hitSlop as { top?: number } | undefined)?.top ?? 0;
      expect(Math.max(height ?? 0, minHeight ?? 0) + 2 * slop).toBeGreaterThanOrEqual(44);
      if (width !== undefined) expect(width + 2 * slop).toBeGreaterThanOrEqual(44);
    }
  });
});
