import { useReducer } from 'react';

import type { Edits, Overlay } from './edits';
import type { FilterId } from './filters';
import { clampTransform, sameTransform, type Transform } from './overlays/transform';

/** How many steps Undo can go back. */
export const UNDO_LIMIT = 50;

// The selected overlay is not an edit: it is kept beside the history, so Undo never just moves the
// selection, and it is ignored once its overlay is gone (deleted, or taken back by Undo).
// `group` is the coalescing key of the last change: a run of changes with the same key (typing into a
// bubble) is one Undo step. Any other action ends the run.
type State = { past: Edits[]; present: Edits; selectedId: string | null; group?: string };
type Action =
  | { type: 'change'; change: (edits: Edits) => Edits; select?: string | null; group?: string }
  | { type: 'select'; id: string | null }
  | { type: 'undo' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'undo': {
      const previous = state.past.at(-1);
      return previous ? { ...state, past: state.past.slice(0, -1), present: previous, group: undefined } : state;
    }
    case 'select':
      return action.id === state.selectedId ? state : { ...state, selectedId: action.id, group: undefined };
    case 'change': {
      // A change that returns the same edits (nothing to do) records no step.
      const next = action.change(state.present);
      if (next === state.present) return state;
      const selectedId = action.select === undefined ? state.selectedId : action.select;
      if (action.group !== undefined && action.group === state.group) {
        return { ...state, present: next, selectedId };
      }
      return {
        past: [...state.past, state.present].slice(-UNDO_LIMIT),
        present: next,
        selectedId,
        group: action.group,
      };
    }
  }
}

function withOverlays(edits: Edits, overlays: Overlay[]): Edits {
  return { ...edits, overlays };
}

/** Moves the overlay to the end of the list, which is drawn last (on top). */
function raise(overlays: Overlay[], id: string): Overlay[] {
  const overlay = overlays.find((o) => o.id === id);
  return overlay ? [...overlays.filter((o) => o.id !== id), overlay] : overlays;
}

export type EditorState = {
  edits: Edits;
  filter: FilterId;
  selectFilter: (filter: FilterId) => void;
  /** The overlay with the dashed outline and handles, if any. */
  selectedId: string | null;
  selectOverlay: (id: string | null) => void;
  /**
   * Adds an overlay on top and selects it (the tools in M2-15, M2-16, M2-17 call this). With a `group`,
   * updates in the same group right after it join its Undo step (a bubble added by typing).
   */
  addOverlay: (overlay: Overlay, group?: string) => void;
  /**
   * Changes an overlay's content (a bubble's text, shape or color) in place, keeping its transform and
   * stacking. Changes passing the same `group` back to back are one Undo step (typing a word).
   */
  updateOverlay: (id: string, update: (overlay: Overlay) => Overlay, group?: string) => void;
  /** Sets an overlay's position, size and angle (clamped) and brings it to the front, as one step. */
  transformOverlay: (id: string, transform: Transform) => void;
  bringToFront: (id: string) => void;
  deleteOverlay: (id: string) => void;
  /** Steps back one change: a filter, or an overlay added, moved, raised or deleted. */
  undo: () => void;
  canUndo: boolean;
};

/**
 * The editor's edits with an Undo history, starting from `initial` (the queue item's saved edits, so
 * reopening the editor restores them). A change that changes nothing (the filter already on, an overlay
 * already on top) records no step.
 */
export function useEditorState(initial: Edits): EditorState {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, selectedId: null });
  const edits = state.present;
  const change = (fn: (edits: Edits) => Edits, select?: string | null, group?: string) =>
    dispatch({ type: 'change', change: fn, select, group });
  return {
    edits,
    filter: edits.filter,
    selectFilter: (filter) => change((e) => (e.filter === filter ? e : { ...e, filter })),
    selectedId: edits.overlays.some((o) => o.id === state.selectedId) ? state.selectedId : null,
    selectOverlay: (id) => dispatch({ type: 'select', id }),
    addOverlay: (overlay, group) =>
      change(
        (e) =>
          e.overlays.some((o) => o.id === overlay.id)
            ? e
            : withOverlays(e, [...e.overlays, { ...overlay, ...clampTransform(overlay) }]),
        overlay.id,
        group,
      ),
    updateOverlay: (id, update, group) =>
      change(
        (e) => {
          const current = e.overlays.find((o) => o.id === id);
          if (!current) return e;
          const next = update(current);
          // Content only: an update can't swap the overlay for another, or change nothing.
          if (next.id !== id || next.type !== current.type || JSON.stringify(next) === JSON.stringify(current)) {
            return e;
          }
          return withOverlays(
            e,
            e.overlays.map((o) => (o.id === id ? next : o)),
          );
        },
        undefined,
        group,
      ),
    transformOverlay: (id, transform) =>
      change((e) => {
        const current = e.overlays.find((o) => o.id === id);
        if (!current) return e;
        const next = clampTransform(transform);
        if (sameTransform(current, next) && e.overlays.at(-1)?.id === id) return e;
        const moved = e.overlays.map((o) => (o.id === id ? { ...o, ...next } : o));
        return withOverlays(e, raise(moved, id));
      }),
    bringToFront: (id) =>
      change((e) =>
        e.overlays.at(-1)?.id === id || !e.overlays.some((o) => o.id === id)
          ? e
          : withOverlays(e, raise(e.overlays, id)),
      ),
    deleteOverlay: (id) =>
      change((e) =>
        e.overlays.some((o) => o.id === id)
          ? withOverlays(
              e,
              e.overlays.filter((o) => o.id !== id),
            )
          : e,
      ),
    undo: () => dispatch({ type: 'undo' }),
    canUndo: state.past.length > 0,
  };
}
