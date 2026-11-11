import { act, renderHook } from '@testing-library/react-native';

import type { Bubble, Edits, Overlay } from '../edits';
import { useEditorState } from '../useEditorState';
import { kape } from './stickerFixture';

// Adding and editing a bubble through the editor's history (FR-CAP-06, FR-CAP-09 Undo): each change is
// one Undo step, and typing into one bubble is one step however many keystrokes it takes.

const sticker: Overlay = { id: 's', type: 'sticker', ...kape, x: 0.2, y: 0.2, scale: 0.3, rotation: 0 };
const b: Bubble = {
  id: 'b',
  type: 'bubble',
  x: 0.5,
  y: 0.3,
  scale: 0.6,
  rotation: 0,
  shape: 'speech',
  color: 'white',
  text: '',
};
const start: Edits = { v: 1, filter: 'original', overlays: [b, sticker] };
const setText = (text: string) => (o: Overlay) => (o.type === 'bubble' ? { ...o, text } : o);
const bubbleIn = (edits: Edits, id = 'b') => edits.overlays.find((o) => o.id === id);

describe('useEditorState bubbles', () => {
  it('adding a bubble is one Undo step', async () => {
    const { result } = await renderHook(() => useEditorState({ ...start, overlays: [sticker] }));
    await act(() => result.current.addOverlay(b));
    expect(result.current.edits.overlays).toEqual([sticker, b]);
    expect(result.current.selectedId).toBe('b');
    await act(() => result.current.undo());
    expect(result.current.edits.overlays).toEqual([sticker]);
    expect(result.current.canUndo).toBe(false);
  });

  it('updates a bubble in place: same position, size, angle and stacking', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('b', (o) => (o.type === 'bubble' ? { ...o, shape: 'thought' } : o)));
    expect(result.current.edits.overlays).toEqual([{ ...b, shape: 'thought' }, sticker]);
    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
  });

  it('typing into a bubble is one Undo step', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    for (const text of ['H', 'Hi', 'Hi!']) await act(() => result.current.updateOverlay('b', setText(text), 'text:b'));
    expect(bubbleIn(result.current.edits)).toEqual({ ...b, text: 'Hi!' });
    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
    expect(result.current.canUndo).toBe(false);
  });

  it('a bubble added by typing and the typing that follows are one step', async () => {
    const { result } = await renderHook(() => useEditorState({ ...start, overlays: [sticker] }));
    await act(() => result.current.addOverlay({ ...b, text: 'Y' }, 'text:b'));
    await act(() => result.current.updateOverlay('b', setText('Yo'), 'text:b'));
    expect(bubbleIn(result.current.edits)).toEqual({ ...b, text: 'Yo' });
    await act(() => result.current.undo());
    expect(result.current.edits.overlays).toEqual([sticker]);
  });

  it('any other change ends a typing run, so the next typing is a new step', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('b', setText('one'), 'text:b'));
    await act(() => result.current.updateOverlay('b', (o) => (o.type === 'bubble' ? { ...o, color: 'sky' } : o)));
    await act(() => result.current.updateOverlay('b', setText('one two'), 'text:b'));
    await act(() => result.current.undo());
    expect(bubbleIn(result.current.edits)).toEqual({ ...b, text: 'one', color: 'sky' });
    await act(() => result.current.undo());
    expect(bubbleIn(result.current.edits)).toEqual({ ...b, text: 'one' });
    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
  });

  it('Undo and selecting another overlay also end a typing run', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('b', setText('a'), 'text:b'));
    await act(() => result.current.selectOverlay('s'));
    await act(() => result.current.updateOverlay('b', setText('ab'), 'text:b'));
    await act(() => result.current.undo());
    expect(bubbleIn(result.current.edits)).toEqual({ ...b, text: 'a' });

    await act(() => result.current.updateOverlay('b', setText('ax'), 'text:b'));
    await act(() => result.current.undo());
    await act(() => result.current.updateOverlay('b', setText('ay'), 'text:b'));
    await act(() => result.current.undo());
    expect(bubbleIn(result.current.edits)).toEqual({ ...b, text: 'a' });
  });

  it('an update that changes nothing, misses, or swaps the overlay records no step', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('b', (o) => ({ ...o })));
    await act(() => result.current.updateOverlay('gone', setText('x')));
    await act(() => result.current.updateOverlay('b', () => ({ ...sticker, id: 'b' })));
    await act(() => result.current.updateOverlay('b', (o) => ({ ...o, id: 'other' })));
    expect(result.current.edits).toEqual(start);
    expect(result.current.canUndo).toBe(false);
  });
});
