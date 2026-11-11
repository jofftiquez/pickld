import { useCallback, useRef, useState, type ReactElement } from 'react';

import type { Slot } from '@/theme/tokens';

import { ReplaceDialog } from './ReplaceDialog';

/**
 * The camera's Replace question (M2-22, FR-JAR-03): `confirm(slot)` shows the Replace dialog and resolves
 * true on Replace, false on Cancel. Render `dialog` next to the screen.
 */
export function useReplaceConfirm(): { confirm: (slot: Slot) => Promise<boolean>; dialog: ReactElement | null } {
  const [slot, setSlot] = useState<Slot | null>(null);
  const answer = useRef<((replace: boolean) => void) | null>(null);

  const confirm = useCallback(
    (target: Slot) =>
      new Promise<boolean>((resolve) => {
        answer.current?.(false); // a question still open is cancelled
        answer.current = resolve;
        setSlot(target);
      }),
    [],
  );
  const settle = (replace: boolean) => {
    answer.current?.(replace);
    answer.current = null;
    setSlot(null);
  };

  const dialog =
    slot === null ? null : (
      <ReplaceDialog visible slot={slot} onReplace={() => settle(true)} onClose={() => settle(false)} />
    );
  return { confirm, dialog };
}
