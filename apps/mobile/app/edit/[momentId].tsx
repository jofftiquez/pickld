import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { RoundIconButton } from '@/components/RoundIconButton';
import { pastDayLabel } from '@/features/days/pastDay';
import { MomentEditSession } from '@/features/edit/MomentEditSession';
import { QueuedEditSession, queueItemQueryKey } from '@/features/edit/QueuedEditSession';
import { StampMomentProvider } from '@/features/edit/stickers/stamps';
import { useEditableMoment } from '@/features/moment/useEditableMoment';
import { getItem, subscribeQueue } from '@/lib/queue/store';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

// A queued photo is edited by its queue row id (it has no server id until uploaded); an uploaded moment by
// its moment id (Moment options, M2-23). `focus=caption` is Moment options' Edit caption: it opens on the
// details step (D-104). `via=crop`: Crop
// opened it on a gallery photo, replacing itself, so what opened Crop is still below: the camera (Camera →
// Crop → Editor) or a past day's page (Day → Crop → Editor, D-153).
// `via=share`: a photo from Photos' Share, with the slot choice below (Add to Pickld → Editor, Crop having
// replaced itself if it was shown); the editor's Back drops the draft and returns there to choose again.
const paramsSchema = z.object({
  momentId: z.union([z.coerce.number().int().positive(), z.uuid()]),
  focus: z.literal('caption').optional(),
  via: z.enum(['crop', 'share']).optional(),
});

// Editor (M2-11, M2-12, M2-23; FR-CAP-04, FR-CAP-08, FR-CAP-09, FR-CAP-10; designs: EditPhoto, EditDetails),
// in two steps on this one route (D-103): the photo and its tools, then Next to the caption and visibility. The camera
// opens it on the photo it just queued; pickld://edit/<queue id> reopens a queued photo with its saved
// edits, and pickld://edit/<moment id> an uploaded one.
export default function EditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const parsed = paramsSchema.safeParse(useLocalSearchParams());
  const queueId = parsed.success && typeof parsed.data.momentId === 'number' ? parsed.data.momentId : null;
  const momentId =
    parsed.success && typeof parsed.data.momentId === 'string' ? parsed.data.momentId.toLowerCase() : null;
  const focusCaption = parsed.success && parsed.data.focus === 'caption';

  const item = useQuery({
    queryKey: queueItemQueryKey(queueId ?? 0),
    queryFn: () => getItem(queueId ?? 0),
    enabled: queueId !== null,
  });
  const server = useEditableMoment(momentId);

  // A photo just queued is prepared in the background (cropped, WebP), and preparing deletes the raw file:
  // the row is read again when it changes, so the editor and the caption preview move to the prepared file.
  const raw = item.data ? !item.data.prepared : false;
  useEffect(() => {
    if (queueId === null || !raw) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: queueItemQueryKey(queueId) });
    const unsubscribe = subscribeQueue((change) => {
      if (change === 'status') refresh();
    });
    // Preparation may have finished between the first read and this subscription.
    refresh();
    return unsubscribe;
  }, [queueId, raw, queryClient]);

  const via = parsed.success ? parsed.data.via : undefined;

  // Back to where the photo came from: after a gallery photo through Crop from the camera, the camera is
  // still below the editor, so it goes too, back to Today, as after the shutter (which replaces itself).
  // From a past day's page (D-153) the day page is below: just back to it. A shared photo's slot choice goes
  // too once the moment is saved.
  const navigation = useNavigation();
  const cameraBelow = () => {
    const state = navigation.getState();
    return state?.routes[state.index - 1]?.name === 'camera';
  };
  const close = () => {
    if (!router.canGoBack()) router.replace('/today');
    else if (via === 'share' || (via === 'crop' && cameraBelow())) router.dismiss(2);
    else router.back();
  };
  // After Add on a new photo: the page of the day it went into (FR-CAP-04). Today's jar is the Today tab,
  // reached by leaving as Close does. A past day's photo (share sheet, a past day's gallery, an older
  // gallery photo from the camera) lands on that day's page: straight back to it when it is below the
  // editor, otherwise leaving as Close does and opening it there, so Back from it goes to Today.
  const addedTo = (localDate: string, tz: string) => {
    if (pastDayLabel(localDate, new Date(), tz) === null) return close();
    const state = navigation.getState();
    const below = state?.routes[state.index - 1];
    if (below?.name === 'day/[date]' && (below.params as { date?: string } | undefined)?.date === localDate) {
      return router.back();
    }
    close();
    router.push({ pathname: '/day/[date]', params: { date: localDate } });
  };

  const missing =
    !parsed.success ||
    (queueId !== null && (item.isError || (item.isSuccess && item.data === null))) ||
    (momentId !== null && (server.isError || server.moment === null));
  if (missing) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + space.lg }]} testID="editor-missing">
        <RoundIconButton icon="close" variant="glass" accessibilityLabel={t('common.close')} onPress={close} />
        <Text style={[textStyle('body'), styles.missingText]}>
          {t(momentId !== null ? 'edit.momentNotFound' : 'edit.notFound')}
        </Text>
      </View>
    );
  }

  if (momentId !== null) {
    const { moment, userId } = server;
    if (!moment || userId === null) return <View style={styles.missing} />;
    return (
      <StampMomentProvider value={{ capturedAt: new Date(moment.shotAt), tz: moment.tz }}>
        <MomentEditSession
          key={moment.id}
          moment={moment}
          userId={userId}
          focusCaption={focusCaption}
          insets={insets}
          onLeave={close}
        />
      </StampMomentProvider>
    );
  }

  if (!item.data) return <View style={styles.missing} />;
  // Auto stamps (M2-15) show the photo's capture time in its jar's zone, as the slot tag does.
  const { capturedAt, createdAt, tz } = item.data;
  return (
    <StampMomentProvider value={{ capturedAt: new Date(capturedAt ?? createdAt), tz }}>
      <QueuedEditSession
        key={item.data.id}
        item={item.data}
        focusCaption={focusCaption}
        insets={insets}
        onLeave={close}
        onAdded={addedTo}
        onBack={via === 'share' && router.canGoBack() ? () => router.back() : undefined}
      />
    </StampMomentProvider>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: colors.editor, paddingHorizontal: space.lg, gap: space.xxl },
  missingText: { color: colors.surface },
});
