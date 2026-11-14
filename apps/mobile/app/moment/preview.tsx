import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { parseFillDateParam } from '@/features/capture/fillTarget';
import { useDayJar } from '@/features/days/useDayJar';
import { openTodayJar } from '@/features/jar/rollover';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { jarPageQueryKeys, useJarPage } from '@/features/jar/useJarPage';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { MomentOptions, type MomentOptionsSelection } from '@/features/moment/MomentOptions';
import type { MomentOptionsMode } from '@/features/moment/MomentOptionsSheet';
import { MomentPreviewView } from '@/features/moment/MomentPreviewView';
import { deleteMoment, MomentOptionError, type OptionError } from '@/features/moment/momentActions';
import { buildPreviewItems, canSetCover, type PreviewItem } from '@/features/moment/momentPreview';
import { useSetJarCover } from '@/features/moment/useSetJarCover';
import { currentSlot } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { usePop } from '@/lib/usePop';
import { slots } from '@/theme/tokens';

const slotParam = z.enum(slots);
// The preview grows in from this share of its size as it fades in (D-77).
const PREVIEW_ENTER_FROM = 0.96;

// /moment/preview?slot=<slot>: the moment preview (QA item 3, D-54; FR-JAR-02), opened from a filled tile on
// Today. It reads Today's own data (the open jar, the offline queue) so photos still on the phone can be
// previewed too, and today's jar page for the full photos, captions, likes and comments. A separate route
// rather than /moment/[id], which takes server moment ids and shows others' moments as well.
// `&date=YYYY-MM-DD` (a past day) previews that day's jar instead, from the day page (D-55): the same model
// built from that day's jar (`useDayJar`) and the queue.
export default function MomentPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ slot?: string; date?: string }>();
  const startSlot = slotParam.catch('whereami').parse(params.slot);
  const [now] = useState(() => new Date());
  const tz = phoneTimeZone();
  const { userId, localDate, jar: jarData, me, queue } = useToday(now);
  // Deep links are untrusted: only a real past date picks a past jar; anything else is Today's.
  const pastDate = parseFillDateParam(params.date, localDate);
  const { day } = useDayJar(pastDate);
  const today = useMemo(() => openTodayJar(jarData, now), [jarData, now]);
  const shown = pastDate ? day : today;
  const jarId = shown?.jar?.id ?? null;
  const page = useJarPage(jarId ?? undefined);

  // Back from the editor or Share: re-read the jar page too, for a new caption.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      if (userId !== null && jarId !== null)
        void queryClient.invalidateQueries({ queryKey: jarPageQueryKeys.jar(userId, jarId) });
    }, [userId, jarId, queryClient]),
  );

  const tiles = buildTodayGrid({
    localDate: shown?.jar?.localDate ?? pastDate ?? localDate,
    moments: shown?.moments ?? [],
    queue,
    nowSlot: pastDate ? null : currentSlot(now, tz),
    jarTz: shown?.jar?.tz ?? null,
  });
  const items =
    (pastDate ? day : jarData) === undefined
      ? undefined
      : buildPreviewItems({ tiles, queue, jarId, page: page.data, defaultVisibility: me?.defaultVisibility });

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(pastDate ? `/day/${pastDate}` : '/today');
  }, [router, pastDate]);

  // The last moment deleted or moved away: nothing is left to preview, so go back (to Today or the day page).
  const hadItems = useRef(false);
  const itemCount = items?.length;
  useEffect(() => {
    if (itemCount === undefined) return;
    if (itemCount > 0) hadItems.current = true;
    else if (hadItems.current) close();
  }, [itemCount, close]);

  // Moment options (M2-23) as the preview's Visibility page and More menu. The last selection stays while the
  // sheet animates out; each opening starts fresh.
  const [options, setOptions] = useState<{
    selection: MomentOptionsSelection;
    mode: MomentOptionsMode;
    open: boolean;
    n: number;
  } | null>(null);
  const openOptions = (item: PreviewItem, mode: MomentOptionsMode) =>
    setOptions((o) => ({
      selection: { tile: item.tile, target: item.target, canSetCover: canSetCover(item) },
      mode,
      open: true,
      n: (o?.n ?? 0) + 1,
    }));

  // Delete on a photo still on the phone (a live moment's Delete is under More).
  const [confirmDelete, setConfirmDelete] = useState<PreviewItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OptionError | null>(null);
  const runDelete = async (item: PreviewItem) => {
    setBusy(true);
    setError(null);
    try {
      await deleteMoment(getSupabase(), item.target);
    } catch (cause) {
      captureError(cause, { area: 'moment-preview' });
      setError(cause instanceof MomentOptionError ? cause.reason : 'failed');
      setBusy(false);
      return;
    }
    setBusy(false);
    if (userId !== null) {
      void queryClient.invalidateQueries({ queryKey: todayQueryKeys.queue(userId) });
      void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
      void queryClient.invalidateQueries({ queryKey: ['day', userId] });
    }
    showToast('momentDeleted');
  };

  // Set as cover from the bar (D-98): the same action as under More.
  const setCover = useSetJarCover(userId ?? '');
  const runSetCover = async (item: PreviewItem) => {
    if (item.target.kind !== 'server' || busy) return;
    setBusy(true);
    setError(null);
    try {
      await setCover(item.target.jarId, item.target.momentId);
    } catch (cause) {
      captureError(cause, { area: 'moment-preview' });
      setError(cause instanceof MomentOptionError ? cause.reason : 'failed');
    }
    setBusy(false);
  };

  // Opening from a tile: the screen fades in (the stack's animation) and grows slightly; with Reduce Motion only
  // the fade (D-58, D-77).
  const enter = usePop(true, PREVIEW_ENTER_FROM, true);

  const editHref = (item: PreviewItem) =>
    item.target.kind === 'queued' ? `/edit/${item.target.queueId}` : `/edit/${item.target.momentId}`;

  return (
    <>
      {/* Light status bar text over the dark screen. */}
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      <Animated.View style={[styles.enter, enter]}>
        <MomentPreviewView
          items={items}
          startSlot={startSlot}
          tz={shown?.jar?.tz ?? tz}
          insets={insets}
          busy={busy}
          error={error}
          onClose={close}
          onEdit={(item) => router.push(editHref(item))}
          onShare={(item) => {
            if (item.target.kind === 'server')
              router.push({
                pathname: '/share/[jarId]',
                params: { jarId: item.target.jarId, moment: item.target.momentId },
              });
          }}
          onVisibility={(item) => openOptions(item, 'visibility')}
          onMore={(item) => openOptions(item, 'more')}
          onSetCover={(item) => void runSetCover(item)}
          onDelete={(item) => {
            setError(null);
            setConfirmDelete(item);
          }}
        />
      </Animated.View>
      {options && userId !== null ? (
        <MomentOptions
          key={options.n}
          visible={options.open}
          mode={options.mode}
          selection={options.selection}
          userId={userId}
          freeSlots={tiles.filter((tile) => !holdsSlot(tile)).map((tile) => tile.slot)}
          tz={shown?.jar?.tz ?? tz}
          onClose={() => setOptions((o) => (o ? { ...o, open: false } : o))}
        />
      ) : null}
      <Dialog
        visible={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t('momentOptions.deleteTitle', { slot: confirmDelete ? t(`slots.${confirmDelete.slot}`) : '' })}
        message={t('momentOptions.deleteMessage')}
        testID="preview-delete-dialog"
      >
        <DangerButton
          label={t('momentOptions.deleteConfirm')}
          onPress={() => {
            const item = confirmDelete;
            setConfirmDelete(null);
            if (item) void runDelete(item);
          }}
          testID="preview-delete-confirm"
        />
      </Dialog>
    </>
  );
}

const styles = StyleSheet.create({
  enter: { flex: 1 },
});
