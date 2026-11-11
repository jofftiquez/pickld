import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { RoundIconButton } from '@/components/RoundIconButton';
import { EditSession, queueItemQueryKey } from '@/features/edit/EditSession';
import { getItem } from '@/lib/queue/store';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

// For now a moment being edited is a local queue item (its row id); it has no server id until uploaded.
const paramsSchema = z.object({ momentId: z.coerce.number().int().positive() });

// Editor (M2-11, M2-12; FR-CAP-04, FR-CAP-08, FR-CAP-09; design: Capture). The camera opens it on the photo
// it just queued; pickld://edit/<queue id> reopens a queued photo with its saved edits.
export default function EditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const parsed = paramsSchema.safeParse(useLocalSearchParams());
  const id = parsed.success ? parsed.data.momentId : null;

  const item = useQuery({
    queryKey: queueItemQueryKey(id ?? 0),
    queryFn: () => getItem(id ?? 0),
    enabled: id !== null,
  });

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  if (id === null || item.isError || (item.isSuccess && item.data === null)) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + space.lg }]} testID="editor-missing">
        <RoundIconButton icon="close" variant="glass" accessibilityLabel={t('common.close')} onPress={close} />
        <Text style={[textStyle('body'), styles.missingText]}>{t('edit.notFound')}</Text>
      </View>
    );
  }
  if (!item.data) return <View style={styles.missing} />;

  return <EditSession key={item.data.id} item={item.data} insets={insets} onLeave={close} />;
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: colors.editor, paddingHorizontal: space.lg, gap: space.xxl },
  missingText: { color: colors.surface },
});
