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
import { discardItem, keepAsDraft, saveEdits, type QueueItem } from '@/lib/queue/store';
import { showToast } from '@/lib/toast';
import type { PreparedPhoto } from '@/lib/image/pipeline';
import type { Visibility } from '@/lib/visibility';

import { EditSession } from './EditSession';
import { forgetPhotoPlace, PhotoPlaceProvider, photoPlaceFor } from './place/photoPlace';

export const queueItemQueryKey = (id: number) => ['queueItem', id] as const;

export type QueuedEditSessionProps = {
  /** The queued moment. Its photo follows preparation (raw, then the prepared file); the rest is read once. */
  item: QueueItem;
  focusCaption?: boolean;
  insets: EdgeInsets;
  onLeave: () => void;
  /** After Add on a new photo: lands on the page of the photo's day (its local date and zone). */
  onAdded?: (localDate: string, tz: string) => void;
  /** A shared photo's way back to its slot choice: the draft is dropped first, so another slot can be chosen. */
  onBack?: () => void;
};

/**
 * The editor on a queued moment (M2-12): saves into the queue item. A photo not added yet (just taken,
 * picked or shared, or a draft) uploads only on Add to #slot: leaving otherwise asks Save draft (it stays on
 * the phone as a draft) or Discard (it is deleted), so an unfinished photo never uploads.
 */
export function QueuedEditSession({ item, focusCaption, insets, onLeave, onAdded, onBack }: QueuedEditSessionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // A photo queued before the profile loaded has no visibility yet: it would go up at the owner's default
  // (D-48), so the editor starts there. Unknown here too: Readers, the narrower of the two shared choices.
  const [ownerDefault] = useState(
    () => queryClient.getQueryData<Me>(todayQueryKeys.me(item.userId))?.defaultVisibility ?? null,
  );
  const offline = useIsOffline();
  // A photo just taken, picked or shared is held for the editor, and a draft waits for it; one that is
  // already waiting to upload is being edited again.
  const [isNew] = useState(item.editingSince !== null || item.draft);
  // A new photo becomes a moment on Add to #slot: its analytics go once, then.
  const notAdded = useRef(isNew ? item : null);
  const added = (visibility: Visibility) => {
    const moment = notAdded.current;
    notAdded.current = null;
    if (moment) void trackMomentAdded(moment, visibility);
  };

  // The editor torn down on a new photo without Add, Save draft or Discard (the leave prompt covers every
  // way out, so this is a fallback): it stays on the phone as a draft, as it was last saved, never uploaded.
  useEffect(() => {
    const id = item.id;
    const pending = notAdded;
    return () => {
      if (!pending.current) return;
      pending.current = null;
      void keepAsDraft(id).catch((error: unknown) => captureError(error, { area: 'edit' }));
    };
  }, [item.id]);

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

  // Discard (and a shared photo's Back, which returns to the slot choice) deletes the photo and its row: it
  // never became a moment.
  const discard = async () => {
    notAdded.current = null;
    forgetPhotoPlace(item.id);
    try {
      await discardItem(item.id);
    } catch (error) {
      captureError(error, { area: 'edit' });
    }
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(item.userId) });
  };
  const back = async (leave: () => void) => {
    await discard();
    leave();
  };
  // Save draft: what was edited is stored on the row, which stays a draft on the phone (never uploaded).
  const saveDraft = async (input: Parameters<typeof saveEdits>[1], photo: PreparedPhoto | null) => {
    try {
      const saved = photo
        ? await saveEdits(item.id, input, { photoUri: photo.full.uri, thumbUri: photo.thumb.uri }, { draft: true })
        : await saveEdits(item.id, input, undefined, { draft: true });
      notAdded.current = null;
      queryClient.setQueryData(queueItemQueryKey(item.id), saved);
      showToast('draftSaved', { slot: t(`slots.${item.slot}`) });
    } catch (error) {
      // The unmount fallback still keeps it as a draft, as it was.
      captureError(error, { area: 'edit' });
    }
    void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(item.userId) });
  };

  // A picked or shared photo's own coordinates, kept in memory only, for the Place tool (photoPlace.ts).
  const [photoPlace] = useState(() => photoPlaceFor(item.id));

  return (
    <PhotoPlaceProvider value={photoPlace}>
      <EditSession
        photoUri={item.photoUri}
        // Rotate, Flip and Crop work on the prepared 3:4 photo: off for the moment a just-taken one is prepared.
        // A photo framed by Fit keeps only Flip: Rotate and a re-crop would cut its frame away.
        photoTools={{ ready: item.prepared, framed: item.crop?.fit !== undefined, onCrop: (uri) => void openCrop(uri) }}
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
        onAdded={isNew && onAdded ? () => onAdded(item.localDate, item.tz) : undefined}
        onBack={onBack && (() => void back(onBack))}
        unfinished={isNew ? { saveDraft, discard } : undefined}
        onSave={async (input, photo) => {
          // Without `draft`, a draft is finished here and uploads.
          const saved = photo
            ? await saveEdits(item.id, input, { photoUri: photo.full.uri, thumbUri: photo.thumb.uri })
            : await saveEdits(item.id, input);
          added(input.visibility);
          forgetPhotoPlace(item.id);
          // Reopening the editor starts from what was saved, not a cached copy from before.
          queryClient.setQueryData(queueItemQueryKey(item.id), saved);
          void requestUploads();
          showToast(isNew ? (offline ? 'momentSavedOffline' : 'momentAdded') : 'changesSaved', {
            slot: t(`slots.${item.slot}`),
          });
        }}
      />
    </PhotoPlaceProvider>
  );
}
