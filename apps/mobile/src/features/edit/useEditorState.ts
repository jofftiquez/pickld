import { useState } from 'react';

import type { FilterId } from './filters';

export type EditorState = {
  filter: FilterId;
  selectFilter: (filter: FilterId) => void;
};

/**
 * The editor's edits, kept in component state for now. M2-12 (#41) saves them into the queue item's
 * `edits` JSON and passes the saved filter back in as `initialFilter` when the editor reopens.
 */
export function useEditorState(initialFilter: FilterId = 'original'): EditorState {
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  return { filter, selectFilter: setFilter };
}
