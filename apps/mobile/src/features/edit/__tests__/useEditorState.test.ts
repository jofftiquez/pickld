import { act, renderHook } from '@testing-library/react-native';

import { DEFAULT_EDITS, type Edits } from '../edits';
import { UNDO_LIMIT, useEditorState } from '../useEditorState';

// The editor's edit history (FR-CAP-09 Undo).

const saved: Edits = {
  v: 1,
  filter: 'merienda',
  overlays: [{ id: 's1', type: 'sticker', x: 0.5, y: 0.5, scale: 0.3, rotation: 0 }],
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
