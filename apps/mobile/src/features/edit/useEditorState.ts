import { useReducer } from 'react';

import type { Edits } from './edits';
import type { FilterId } from './filters';

/** How many steps Undo can go back. */
export const UNDO_LIMIT = 50;

type History = { past: Edits[]; present: Edits };
type Action = { type: 'apply'; edits: Edits } | { type: 'undo' };

function reducer(state: History, action: Action): History {
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    return previous ? { past: state.past.slice(0, -1), present: previous } : state;
  }
  return { past: [...state.past, state.present].slice(-UNDO_LIMIT), present: action.edits };
}

export type EditorState = {
  edits: Edits;
  filter: FilterId;
  selectFilter: (filter: FilterId) => void;
  /** Steps back one change (filter now; overlays from M2-13 on). */
  undo: () => void;
  canUndo: boolean;
};

/**
 * The editor's edits with an Undo history, starting from `initial` (the queue item's saved edits, so
 * reopening the editor restores them). Choosing the filter that is already on records nothing.
 */
export function useEditorState(initial: Edits): EditorState {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial });
  const edits = state.present;
  return {
    edits,
    filter: edits.filter,
    selectFilter: (filter) => {
      if (filter !== edits.filter) dispatch({ type: 'apply', edits: { ...edits, filter } });
    },
    undo: () => dispatch({ type: 'undo' }),
    canUndo: state.past.length > 0,
  };
}
