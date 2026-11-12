import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { trackMomentAdded } from '@/features/capture/momentAnalytics';
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { releaseEditing, saveEdits, type QueueItem } from '@/lib/queue/store';

import { EditSession } from './EditSession';

export const queueItemQueryKey = (id: number) => ['queueItem', id] as const;

export type QueuedEditSessionProps = {
  /** The queued moment, read once. */
  item: QueueItem;
  focusCaption?: boolean;
  insets: EdgeInsets;
  onLeave: () => void;
};

/**
 * The editor on a queued moment (M2-12): saves into the queue item. However the editor is left, the item's
 * editing hold ends and the upload worker is woken, so the photo is never stuck in the queue.
 */
export function QueuedEditSession({ item, focusCaption, insets, onLeave }: QueuedEditSessionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // A photo just taken is held for the editor; one that is already waiting is being edited again.
  const [isNew] = useState(item.editingSince !== null);
  // A photo just taken becomes a moment when this editor is left, saved or not: its analytics go once, then.
  const notAdded = useRef(isNew ? item : null);
  const added = (isPrivate: boolean) => {
    const moment = notAdded.current;
    notAdded.current = null;
    if (moment) void trackMomentAdded(moment, isPrivate);
  };

  // Closing without saving (Close, back gesture) keeps the photo queued as it is, and lets it upload.
  useEffect(() => {
    const id = item.id;
    const pending = notAdded;
    return () => {
      const moment = pending.current;
      pending.current = null;
      if (moment) void trackMomentAdded(moment, moment.isPrivate);
      void releaseEditing(id)
        .catch((error: unknown) => captureError(error, { area: 'edit' }))
        .finally(() => void requestUploads());
    };
  }, [item.id]);

  return (
    <EditSession
      photoUri={item.photoUri}
      slot={item.slot}
      shotAt={new Date(item.capturedAt ?? item.createdAt)}
      tz={item.tz}
      initial={item}
      saveLabel={isNew ? t('edit.addToSlot', { slot: t(`slots.${item.slot}`) }) : t('edit.done')}
      focusCaption={focusCaption}
      insets={insets}
      onLeave={onLeave}
      onSave={async (input) => {
        const saved = await saveEdits(item.id, input);
        added(input.isPrivate);
        // Reopening the editor starts from what was saved, not a cached copy from before.
        queryClient.setQueryData(queueItemQueryKey(item.id), saved);
        void requestUploads();
      }}
    />
  );
}
