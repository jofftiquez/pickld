import { act, renderHook } from '@testing-library/react-native';

import { DEFAULT_EDITS, type Edits, type Overlay } from '../edits';
import { UNDO_LIMIT, useEditorState } from '../useEditorState';
import { kape } from './stickerFixture';

// The editor's edit history (FR-CAP-09 Undo).

const saved: Edits = {
  v: 1,
  filter: 'merienda',
  overlays: [{ id: 's1', type: 'sticker', ...kape, x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }],
};

describe('useEditorState', () => {
  it('starts from the saved edits with nothing to undo', async () => {
    const { result } = await renderHook(() => useEditorState(saved));
    expect(result.current.edits).toEqual(saved);
    expect(result.current.filter).toBe('merienda');
    expect(result.current.canUndo).toBe(false);
  });

  it('Undo steps back through filter changes one at a time, keeping the overlays', async () => {
    const { result } = await renderHook(() => useEditorState(saved));
    await act(() => result.current.selectFilter('mono'));
    await act(() => result.current.selectFilter('dusk'));
    expect(result.current.edits).toEqual({ ...saved, filter: 'dusk' });
    expect(result.current.canUndo).toBe(true);

    await act(() => result.current.undo());
    expect(result.current.filter).toBe('mono');
    expect(result.current.canUndo).toBe(true);

    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(saved);
    expect(result.current.canUndo).toBe(false);

    await act(() => result.current.undo()); // nothing left: stays put
    expect(result.current.edits).toEqual(saved);
  });

  it('choosing the filter that is already on records no step', async () => {
    const { result } = await renderHook(() => useEditorState(DEFAULT_EDITS));
    await act(() => result.current.selectFilter('original'));
    expect(result.current.canUndo).toBe(false);
    await act(() => result.current.selectFilter('kalamansi'));
    await act(() => result.current.selectFilter('kalamansi'));
    await act(() => result.current.undo());
    expect(result.current.filter).toBe('original');
    expect(result.current.canUndo).toBe(false);
  });

  it(`keeps the last ${UNDO_LIMIT} steps`, async () => {
    const { result } = await renderHook(() => useEditorState(DEFAULT_EDITS));
    const cycle = ['kalamansi', 'mono'] as const;
    for (let i = 0; i < UNDO_LIMIT + 5; i += 1) await act(() => result.current.selectFilter(cycle[i % 2] ?? 'mono'));
    for (let i = 0; i < UNDO_LIMIT; i += 1) await act(() => result.current.undo());
    expect(result.current.canUndo).toBe(false);
    // The oldest steps (back to Original) were dropped.
    expect(result.current.filter).not.toBe('original');
  });
});

describe('useEditorState overlays (FR-CAP-05, FR-CAP-08)', () => {
  const a: Overlay = { id: 'a', type: 'sticker', ...kape, x: 0.2, y: 0.2, scale: 0.3, rotation: 0 };
  const b: Overlay = {
    id: 'b',
    type: 'bubble',
    x: 0.5,
    y: 0.5,
    scale: 0.4,
    rotation: 0.5,
    shape: 'speech',
    color: 'white',
    text: '',
  };
  const c: Overlay = {
    id: 'c',
    type: 'text',
    x: 0.8,
    y: 0.8,
    scale: 0.2,
    rotation: -0.5,
    text: 'hi',
    font: 'bold',
    color: 'white',
    size: 30,
    align: 'center',
  };
  const start: Edits = { v: 1, filter: 'mono', overlays: [a, b, c] };
  const ids = (edits: Edits) => edits.overlays.map((o) => o.id);

  it('adds an overlay on top, clamped, and selects it; Undo takes it away and clears the selection', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() =>
      result.current.addOverlay({ id: 'd', type: 'sticker', ...kape, x: 1.4, y: -0.1, scale: 9, rotation: 0 }),
    );
    expect(ids(result.current.edits)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.current.edits.overlays[3]).toEqual({
      id: 'd',
      type: 'sticker',
      ...kape,
      x: 1,
      y: 0,
      scale: 2,
      rotation: 0,
    });
    expect(result.current.selectedId).toBe('d');

    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.canUndo).toBe(false);
  });

  it('refuses a second overlay with the same id', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.addOverlay({ ...a, x: 0.9 }));
    expect(result.current.edits).toEqual(start);
    expect(result.current.canUndo).toBe(false);
  });

  it('selecting is not an edit: no Undo step, and Undo does not just move the selection', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.selectOverlay('b'));
    expect(result.current.selectedId).toBe('b');
    expect(result.current.canUndo).toBe(false);
    await act(() => result.current.selectFilter('dusk'));
    await act(() => result.current.selectOverlay('c'));
    await act(() => result.current.undo());
    expect(result.current.filter).toBe('mono');
    expect(result.current.selectedId).toBe('c');
    await act(() => result.current.selectOverlay(null));
    expect(result.current.selectedId).toBeNull();
    await act(() => result.current.selectOverlay('nope'));
    expect(result.current.selectedId).toBeNull();
  });

  it('transforms an overlay, clamped, bringing it to the front, as one step', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.transformOverlay('a', { x: -0.5, y: 0.6, scale: 0.01, rotation: 3 * Math.PI }));
    expect(ids(result.current.edits)).toEqual(['b', 'c', 'a']);
    const moved = result.current.edits.overlays[2];
    expect(moved).toMatchObject({ id: 'a', type: 'sticker', ...kape, x: 0, y: 0.6, scale: 0.1 });
    expect(moved?.rotation).toBeCloseTo(Math.PI, 10);

    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
  });

  it('records nothing for a transform that changes nothing on the top overlay, or an unknown id', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.transformOverlay('c', { x: c.x, y: c.y, scale: c.scale, rotation: c.rotation }));
    await act(() => result.current.transformOverlay('zz', { x: 0.1, y: 0.1, scale: 0.5, rotation: 0 }));
    expect(result.current.edits).toEqual(start);
    expect(result.current.canUndo).toBe(false);
    // The same transform on an overlay underneath still raises it.
    await act(() => result.current.transformOverlay('a', { x: a.x, y: a.y, scale: a.scale, rotation: a.rotation }));
    expect(ids(result.current.edits)).toEqual(['b', 'c', 'a']);
    expect(result.current.canUndo).toBe(true);
  });

  it('brings an overlay to the front; already on top records nothing', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.bringToFront('c'));
    expect(result.current.canUndo).toBe(false);
    await act(() => result.current.bringToFront('a'));
    expect(ids(result.current.edits)).toEqual(['b', 'c', 'a']);
    expect(result.current.edits.overlays[2]).toEqual(a);
    await act(() => result.current.undo());
    expect(ids(result.current.edits)).toEqual(['a', 'b', 'c']);
  });

  it('deletes an overlay and its selection; Undo puts it back where it was in the stack', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.selectOverlay('b'));
    await act(() => result.current.deleteOverlay('b'));
    expect(ids(result.current.edits)).toEqual(['a', 'c']);
    expect(result.current.selectedId).toBeNull();
    await act(() => result.current.deleteOverlay('b')); // already gone: nothing to record
    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
    expect(result.current.canUndo).toBe(false);
  });

  it('Undo walks back across filter and overlay changes in order', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() =>
      result.current.addOverlay({ id: 'd', type: 'sticker', ...kape, x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }),
    );
    await act(() => result.current.transformOverlay('d', { x: 0.6, y: 0.5, scale: 0.3, rotation: 0 }));
    await act(() => result.current.selectFilter('dusk'));
    await act(() => result.current.bringToFront('a'));
    await act(() => result.current.deleteOverlay('d'));
    const history: string[][] = [];
    for (let i = 0; i < 5; i += 1) {
      await act(() => result.current.undo());
      history.push([result.current.filter, ...result.current.edits.overlays.map((o) => `${o.id}@${o.x}`)]);
    }
    expect(history).toEqual([
      ['dusk', 'b@0.5', 'c@0.8', 'd@0.6', 'a@0.2'],
      ['dusk', 'a@0.2', 'b@0.5', 'c@0.8', 'd@0.6'],
      ['mono', 'a@0.2', 'b@0.5', 'c@0.8', 'd@0.6'],
      ['mono', 'a@0.2', 'b@0.5', 'c@0.8', 'd@0.5'],
      ['mono', 'a@0.2', 'b@0.5', 'c@0.8'],
    ]);
    expect(result.current.canUndo).toBe(false);
  });
});

describe('useEditorState updateOverlay for text (FR-CAP-07)', () => {
  const sticker: Overlay = { id: 's', type: 'sticker', ...kape, x: 0.2, y: 0.2, scale: 0.3, rotation: 0 };
  const text: Overlay = {
    id: 't',
    type: 'text',
    x: 0.5,
    y: 0.5,
    scale: 0.4,
    rotation: 0,
    text: 'hi',
    font: 'bold',
    color: 'white',
    size: 30,
    align: 'center',
  };
  const start: Edits = { v: 1, filter: 'original', overlays: [text, sticker] };
  const recolor = (o: Overlay): Overlay => (o.type === 'text' ? { ...o, color: 'ink' } : o);

  it('changes one overlay as one Undo step and keeps it in its place in the stack', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('t', recolor));
    expect(result.current.edits.overlays).toEqual([{ ...text, color: 'ink' }, sticker]);
    expect(result.current.canUndo).toBe(true);
    await act(() => result.current.undo());
    expect(result.current.edits).toEqual(start);
    expect(result.current.canUndo).toBe(false);
  });

  it('records no step when the change returns the same overlay or the overlay is gone', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('t', (o) => o));
    await act(() => result.current.updateOverlay('missing', recolor));
    expect(result.current.edits).toBe(start);
    expect(result.current.canUndo).toBe(false);
  });

  it('clamps the size, and refuses a change that swaps the overlay for another', async () => {
    const { result } = await renderHook(() => useEditorState(start));
    await act(() => result.current.updateOverlay('t', (o) => ({ ...o, scale: 9 })));
    expect(result.current.edits.overlays[0]).toMatchObject({ id: 't', scale: 2 });
    await act(() => result.current.updateOverlay('t', (o) => ({ ...o, id: 'other' })));
    expect(result.current.edits.overlays[0]).toMatchObject({ id: 't' });
  });
});
