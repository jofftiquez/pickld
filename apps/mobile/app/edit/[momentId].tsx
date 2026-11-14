import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { RoundIconButton } from '@/components/RoundIconButton';
import { MomentEditSession } from '@/features/edit/MomentEditSession';
import { QueuedEditSession, queueItemQueryKey } from '@/features/edit/QueuedEditSession';
import { StampMomentProvider } from '@/features/edit/stickers/stamps';
import { useEditableMoment } from '@/features/moment/useEditableMoment';
import { getItem } from '@/lib/queue/store';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

// A queued photo is edited by its queue row id (it has no server id until uploaded); an uploaded moment by
// its moment id (Moment options, M2-23). `focus=caption` is Moment options' Edit caption: it opens on the
// details step (D-104). `via=crop`: Crop
// opened it on a gallery photo, replacing itself, so the camera is still below (Camera → Crop → Editor).
const paramsSchema = z.object({
  momentId: z.union([z.coerce.number().int().positive(), z.uuid()]),
  focus: z.literal('caption').optional(),
  via: z.literal('crop').optional(),
});

// Editor (M2-11, M2-12, M2-23; FR-CAP-04, FR-CAP-08, FR-CAP-09, FR-CAP-10; designs: EditPhoto, EditDetails),
// in two steps on this one route (D-103): the photo and its tools, then Next to the caption and visibility. The camera
// opens it on the photo it just queued; pickld://edit/<queue id> reopens a queued photo with its saved
// edits, and pickld://edit/<moment id> an uploaded one.
export default function EditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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

  const viaCrop = parsed.success && parsed.data.via === 'crop';

  // Back to where the camera was opened from (Today, or a past day's page): after a gallery photo through
  // Crop, the camera is still below the editor, so it goes too, as after the shutter (which replaces itself).
  const close = () => {
    if (!router.canGoBack()) router.replace('/today');
    else if (viaCrop) router.dismiss(2);
    else router.back();
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
      />
    </StampMomentProvider>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: colors.editor, paddingHorizontal: space.lg, gap: space.xxl },
  missingText: { color: colors.surface },
});
