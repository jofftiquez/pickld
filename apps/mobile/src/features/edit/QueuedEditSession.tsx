import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { trackMomentAdded } from '@/features/capture/momentAnalytics';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import { pastDayLabel } from '@/features/days/pastDay';
import { todayQueryKeys, type Me } from '@/features/jar/useToday';
import { useIsOffline } from '@/lib/connectivity';
import { captureError } from '@/lib/monitoring';
import { requestUploads } from '@/lib/queue/runner';
import { discardItem, releaseEditing, saveEdits, type QueueItem } from '@/lib/queue/store';
import { showToast } from '@/lib/toast';
import type { Visibility } from '@/lib/visibility';

import { EditSession } from './EditSession';

export const queueItemQueryKey = (id: number) => ['queueItem', id] as const;

export type QueuedEditSessionProps = {
  /** The queued moment. Its photo follows preparation (raw, then the prepared file); the rest is read once. */
  item: QueueItem;
  focusCaption?: boolean;
  insets: EdgeInsets;
  onLeave: () => void;
  /** A shared photo's way back to its slot choice: the draft is dropped first, so another slot can be chosen. */
  onBack?: () => void;
};

/**
 * The editor on a queued moment (M2-12): saves into the queue item. However the editor is left, the item's
 * editing hold ends and the upload worker is woken, so the photo is never stuck in the queue.
 */
export function QueuedEditSession({ item, focusCaption, insets, onLeave, onBack }: QueuedEditSessionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // A photo queued before the profile loaded has no visibility yet: it would go up at the owner's default
  // (D-48), so the editor starts there. Unknown here too: Readers, the narrower of the two shared choices.
  const [ownerDefault] = useState(
    () => queryClient.getQueryData<Me>(todayQueryKeys.me(item.userId))?.defaultVisibility ?? null,
  );
  const offline = useIsOffline();
  // A photo just taken is held for the editor; one that is already waiting is being edited again.
  const [isNew] = useState(item.editingSince !== null);
  // A photo just taken becomes a moment when this editor is left, saved or not: its analytics go once, then.
  const notAdded = useRef(isNew ? item : null);
  const added = (visibility: Visibility) => {
    const moment = notAdded.current;
    notAdded.current = null;
    if (moment) void trackMomentAdded(moment, visibility);
  };

  // Closing without saving (Close, back gesture) keeps the photo queued as it is, and lets it upload.
  useEffect(() => {
    const id = item.id;
    const pending = notAdded;
    return () => {
      const moment = pending.current;
      pending.current = null;
      if (moment) void trackMomentAdded(moment, moment.visibility ?? ownerDefault);
      void releaseEditing(id)
        .catch((error: unknown) => captureError(error, { area: 'edit' }))
        .finally(() => void requestUploads());
    };
  }, [item.id, ownerDefault]);

  // Crop (the photo button) opens on the photo as the editor shows it, turned or mirrored included, and saves
  // the new crop straight into the queue row like Moment options' Re-crop (M2-23). Back in the editor the row
  // is read again, so the editor moves to the new photo.
  const router = useRouter();
  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const cropOpened = useRef(false);
  const openCrop = async (photoUri: string) => {
    try {
      const size = await Image.getSize(photoUri);
      setPendingCrop({
        photo: { uri: photoUri, ...size, temporary: false },
        slot: item.slot,
        userId: item.userId,
        recrop: { kind: 'queued', queueId: item.id },
      });
    } catch (error) {
      captureError(error, { area: 'edit' });
      return;
    }
    cropOpened.current = true;
    router.push('/crop');
  };
  useFocusEffect(
    useCallback(() => {
      if (!cropOpened.current) return;
      cropOpened.current = false;
      void queryClient.invalidateQueries({ queryKey: queueItemQueryKey(item.id) });
    }, [queryClient, item.id]),
  );

  // Back from a shared photo drops the draft (it never became a moment), then returns to the slot choice.
  const back = async (leave: () => void) => {
    notAdded.current = null;
    try {
      await discardItem(item.id);
    } catch (error) {
      captureError(error, { area: 'edit' });
    }
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(item.userId) });
    leave();
  };

  return (
    <EditSession
      photoUri={item.photoUri}
      // Rotate, Flip and Crop work on the prepared 3:4 photo: off for the moment a just-taken one is prepared.
      photoTools={{ ready: item.prepared, onCrop: (uri) => void openCrop(uri) }}
      slot={item.slot}
      shotAt={new Date(item.capturedAt ?? item.createdAt)}
      tz={item.tz}
      // D-156: a photo going into a past day's jar names that day, not its own shot date or Today.
      forDay={pastDayLabel(item.localDate, new Date(), item.tz)}
      initial={{ ...item, visibility: item.visibility ?? ownerDefault ?? 'readers' }}
      saveLabel={isNew ? t('edit.addToSlot', { slot: t(`slots.${item.slot}`) }) : t('edit.done')}
      focusCaption={focusCaption}
      insets={insets}
      onLeave={onLeave}
      onBack={onBack && (() => void back(onBack))}
      onSave={async (input, photo) => {
        const saved = photo
          ? await saveEdits(item.id, input, { photoUri: photo.full.uri, thumbUri: photo.thumb.uri })
          : await saveEdits(item.id, input);
        added(input.visibility);
        // Reopening the editor starts from what was saved, not a cached copy from before.
        queryClient.setQueryData(queueItemQueryKey(item.id), saved);
        void requestUploads();
        showToast(isNew ? (offline ? 'momentSavedOffline' : 'momentAdded') : 'changesSaved', {
          slot: t(`slots.${item.slot}`),
        });
      }}
    />
  );
}
