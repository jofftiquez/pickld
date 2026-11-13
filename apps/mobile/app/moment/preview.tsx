import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { openTodayJar } from '@/features/jar/rollover';
import { buildTodayGrid, holdsSlot } from '@/features/jar/todayGrid';
import { jarPageQueryKeys, useJarPage } from '@/features/jar/useJarPage';
import { phoneTimeZone, todayQueryKeys, useToday } from '@/features/jar/useToday';
import { MomentOptions, type MomentOptionsSelection } from '@/features/moment/MomentOptions';
import type { MomentOptionsMode } from '@/features/moment/MomentOptionsSheet';
import { MomentPreviewView } from '@/features/moment/MomentPreviewView';
import { deleteMoment, MomentOptionError, type OptionError } from '@/features/moment/momentActions';
import { buildPreviewItems, type PreviewItem } from '@/features/moment/momentPreview';
import { currentSlot } from '@/lib/jars';
import { captureError } from '@/lib/monitoring';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { slots } from '@/theme/tokens';

const slotParam = z.enum(slots);

// /moment/preview?slot=<slot>: the moment preview (QA item 3, D-54; FR-JAR-02), opened from a filled tile on
// Today. It reads Today's own data (the open jar, the offline queue) so photos still on the phone can be
// previewed too, and today's jar page for the full photos, captions, likes and comments. A separate route
// rather than /moment/[id], which takes server moment ids and shows others' moments as well.
export default function MomentPreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ slot?: string }>();
  const startSlot = slotParam.catch('whereami').parse(params.slot);
  const [now] = useState(() => new Date());
  const tz = phoneTimeZone();
  const { userId, localDate, jar: jarData, me, queue } = useToday(now);
  const today = useMemo(() => openTodayJar(jarData, now), [jarData, now]);
  const jarId = today?.jar?.id ?? null;
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
    localDate: today?.jar?.localDate ?? localDate,
    moments: today?.moments ?? [],
    queue,
    nowSlot: currentSlot(now, tz),
    jarTz: today?.jar?.tz ?? null,
  });
  const items =
    jarData === undefined
      ? undefined
      : buildPreviewItems({ tiles, queue, jarId, page: page.data, defaultVisibility: me?.defaultVisibility });

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  }, [router]);

  // The last moment deleted or moved away: nothing is left to preview, so go back to Today.
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
    setOptions((o) => ({ selection: { tile: item.tile, target: item.target }, mode, open: true, n: (o?.n ?? 0) + 1 }));

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
    }
    showToast('momentDeleted');
  };

  const editHref = (item: PreviewItem) =>
    item.target.kind === 'queued' ? `/edit/${item.target.queueId}` : `/edit/${item.target.momentId}`;

  return (
    <>
      {/* Light status bar text over the dark screen. */}
      <Stack.Screen options={{ statusBarStyle: 'light' }} />
      <MomentPreviewView
        items={items}
        startSlot={startSlot}
        tz={today?.jar?.tz ?? tz}
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
        onDelete={(item) => {
          setError(null);
          setConfirmDelete(item);
        }}
      />
      {options && userId !== null ? (
        <MomentOptions
          key={options.n}
          visible={options.open}
          mode={options.mode}
          selection={options.selection}
          userId={userId}
          freeSlots={tiles.filter((tile) => !holdsSlot(tile)).map((tile) => tile.slot)}
          tz={today?.jar?.tz ?? tz}
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
