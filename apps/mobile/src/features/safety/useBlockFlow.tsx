import { useState } from 'react';

import { BlockDialog } from './BlockDialog';
import { useBlock } from './block';

type Person = { id: string; name: string };

/**
 * The Block confirmation opened from Report (the Block tab or Also block). `onBlocked` runs once the block
 * is saved, e.g. to leave a screen that is about the blocked person.
 */
export function useBlockFlow(onBlocked?: () => void) {
  const { block, busy } = useBlock();
  const [person, setPerson] = useState<Person | null>(null);
  const dialog = (
    <BlockDialog
      visible={person !== null}
      name={person?.name ?? ''}
      busy={busy}
      onClose={() => setPerson(null)}
      onBlock={() => {
        if (!person) return;
        void block(person.id).then(
          () => {
            setPerson(null);
            onBlocked?.();
          },
          () => setPerson(null),
        );
      }}
    />
  );
  return { open: (p: Person) => setPerson(p), dialog };
}
