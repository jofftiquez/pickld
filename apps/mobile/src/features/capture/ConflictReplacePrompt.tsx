import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { QueuedMoment } from '@/features/jar/todayGrid';

import { ReplaceDialog } from './ReplaceDialog';
import { keepCurrentPhoto, nextConflict, replaceUpload } from './replaceUpload';

export type ConflictReplacePromptProps = {
  /** The user's queue, as Today reads it. */
  queue: readonly Pick<QueuedMoment, 'id' | 'state' | 'slot'>[];
};

/**
 * Asks about an upload that ended as a conflict (its slot already had a moment, FR-JAR-03): Replace, Keep
 * current photo, or Not now (asked again after the app restarts). One conflict at a time, oldest first.
 */
export function ConflictReplacePrompt({ queue }: ConflictReplacePromptProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<ReadonlySet<number>>(new Set());
  const item = nextConflict(queue, dismissed);
  if (!item) return null;
  // Hide this one at once; the queue then moves it out of conflict (Replace) or drops it (Keep).
  const settle = (action: (id: number) => Promise<void>) => {
    setDismissed((prev) => new Set(prev).add(item.id));
    void action(item.id);
  };
  return (
    <ReplaceDialog
      visible
      slot={item.slot}
      onReplace={() => settle(replaceUpload)}
      onKeep={() => settle(keepCurrentPhoto)}
      onClose={() => settle(async () => {})}
      cancelLabel={t('replace.notNow')}
    />
  );
}
