import { useImage } from '@shopify/react-native-skia';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import { RoundIconButton } from '@/components/RoundIconButton';
import { EditorView, type EditorTool } from '@/features/edit/EditorView';
import { useEditorState } from '@/features/edit/useEditorState';
import { formatTime } from '@/lib/format';
import { getItem } from '@/lib/queue/store';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

// For now a moment being edited is a local queue item (its row id); it has no server id until uploaded.
const paramsSchema = z.object({ momentId: z.coerce.number().int().positive() });

// Editor (M2-11; FR-CAP-04; design: Capture). Only Filters works so far; saving the edits, caption and
// privacy are M2-12, and the camera opens this screen from M2-12 too. Reach it with pickld://edit/<queue id>.
export default function EditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const parsed = paramsSchema.safeParse(useLocalSearchParams());
  const id = parsed.success ? parsed.data.momentId : null;

  const item = useQuery({
    queryKey: ['queueItem', id],
    queryFn: () => getItem(id ?? 0),
    enabled: id !== null,
  });
  const image = useImage(item.data?.photoUri);
  const editor = useEditorState();
  const [tool, setTool] = useState<EditorTool>('filters');

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

  const shotAt = item.data.capturedAt === null ? new Date(item.data.createdAt) : new Date(item.data.capturedAt);
  return (
    <EditorView
      image={image}
      slot={item.data.slot}
      time={formatTime(shotAt, item.data.tz)}
      filter={editor.filter}
      tool={tool}
      insets={insets}
      onClose={close}
      onSelectFilter={editor.selectFilter}
      onSelectTool={setTool}
    />
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, backgroundColor: colors.editor, paddingHorizontal: space.lg, gap: space.xxl },
  missingText: { color: colors.surface },
});
