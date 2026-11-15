import { useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isThreeByFour } from '@/features/capture/cropMath';
import { usePendingCrop } from '@/features/capture/pendingCrop';
import type { PickedPhoto } from '@/features/capture/pickFromGallery';
import { galleryTarget, saveGalleryPhoto } from '@/features/capture/saveCapture';
import { SharedPhotoView, type SharedPhotoState } from '@/features/capture/SharedPhotoView';
import {
  copySharedPhoto,
  parseSharedPhotoId,
  releaseSharedPhoto,
  sharedPhotoDay,
  takeSharedPhoto,
} from '@/features/capture/sharedPhoto';
import { useFillCapture } from '@/features/capture/useFillCapture';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { currentSlot } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { slots, type Slot } from '@/theme/tokens';

// /shared-photo?id=<id> (FR-CAP-02): Photos' Share → Pickld (targets/share) opens it with the photo it handed
// over. The photo goes to the day it was taken: today's open jar, or an earlier day's jar as a past day's page fills
// (the server marks it "Added later"); a photo dated after today is refused. The user picks a free slot of
// that day, then it continues exactly like a gallery photo: Crop unless it is already 3:4, then the editor.
export default function SharedPhotoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const status = useAuthStore((s) => s.status);
  const [now] = useState(() => new Date());
  const tz = phoneTimeZone();
  const { userId, localDate, jar, queue, me } = useToday(now);

  const id = parseSharedPhotoId(params.id);
  const [loaded, setPhoto] = useState<PickedPhoto | 'failed' | null>(null);
  // The photo stays here until this screen is left, so Back from the editor can choose another slot; Crop
  // and the queue get copies (they delete what they are given). Leaving deletes the photo and any copy left.
  const files = useRef<string[]>([]);
  const photo = id === null ? 'failed' : loaded;
  useEffect(() => {
    if (id === null) return;
    let active = true;
    takeSharedPhoto(id).then(
      (taken) => {
        files.current.push(taken.uri);
        if (active) setPhoto(taken);
        // Loaded after the screen was left: nothing will use it.
        else releaseSharedPhoto(id, [taken.uri]);
      },
      (error: unknown) => {
        captureError(error, { area: 'gallery' });
        if (active) setPhoto('failed');
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (id === null) return;
    const owned = files.current;
    return () => releaseSharedPhoto(id, owned);
  }, [id]);

  const picked = photo !== null && photo !== 'failed' ? photo : null;
  const day = picked ? sharedPhotoDay(picked.exif, tz, now, localDate) : null;
  // An earlier day: that day's jar and the slots it already holds, as a past day's page fills it.
  const fill = useFillCapture(day?.kind === 'past' ? day.localDate : null, localDate, tz);
  const taken =
    fill?.taken ??
    new Set<Slot>(
      buildTodayGrid({
        localDate: jar?.jar?.localDate ?? localDate,
        moments: jar?.moments ?? [],
        queue,
        nowSlot: currentSlot(now, tz),
      })
        .filter(holdsSlot)
        .map((tile) => tile.slot),
    );

  const setPendingCrop = usePendingCrop((s) => s.setPending);
  const [busy, setBusy] = useState(false);

  if (status === 'signedOut') return <Redirect href="/" />;

  const state: SharedPhotoState =
    photo === 'failed'
      ? 'failed'
      : day === null
        ? 'loading'
        : day.kind === 'future'
          ? 'future'
          : slots.every((slot) => taken.has(slot))
            ? 'full'
            : 'choose';
  const dayLabel =
    day?.kind === 'past' && fill
      ? t('sharedPhoto.past', { date: fill.dateLabel })
      : day?.kind === 'today'
        ? t('sharedPhoto.today')
        : null;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  // Like the camera: Crop opens over this screen (its Cancel comes back here to choose again) and replaces
  // itself with the editor. A 3:4 photo skips Crop: the editor opens over this screen. Either way the editor's
  // Back drops the draft and comes back here to choose again; saving takes this screen away too.
  const onChoose = async (slot: Slot) => {
    if (busy || picked === null || userId === null || taken.has(slot)) return;
    setBusy(true);
    try {
      const target = galleryTarget({
        exif: picked.exif,
        tz,
        now: new Date(),
        openJar: jar?.jar ?? null,
        fill: fill?.target ?? null,
      });
      const copy = await copySharedPhoto(picked);
      files.current.push(copy.uri);
      if (!isThreeByFour(picked)) {
        setPendingCrop({ photo: copy, slot, userId, target, shared: true });
        router.push('/crop');
        setBusy(false);
        return;
      }
      const visibility = me?.defaultVisibility ?? null;
      const item = await saveGalleryPhoto({ uri: copy.uri, slot, userId, target, crop: null, visibility });
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      router.push({ pathname: '/edit/[momentId]', params: { momentId: String(item.id), via: 'share' } });
      setBusy(false);
    } catch (error) {
      captureError(error, { area: 'gallery' });
      setBusy(false);
    }
  };

  return (
    <SharedPhotoView
      insets={insets}
      state={state}
      photoUri={picked?.uri ?? null}
      dayLabel={dayLabel}
      taken={taken}
      busy={busy}
      onChoose={(slot) => void onChoose(slot)}
      onClose={leave}
    />
  );
}
