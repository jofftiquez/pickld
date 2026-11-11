import type { SkImage } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { RoundIconButton } from '@/components/RoundIconButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SlotTag } from '@/features/capture/SlotTag';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import { FilteredPhoto } from './FilteredPhoto';
import { filterIdSchema, filterMatrices, type FilterId } from './filters';
import { FilterThumbnail } from './FilterThumbnail';

export const editorTools = ['filters', 'stickers', 'bubble', 'text'] as const;
export type EditorTool = (typeof editorTools)[number];

export type EditorViewProps = {
  image: SkImage | null;
  slot: Slot;
  /** Capture time, formatted for the slot tag. */
  time: string;
  filter: FilterId;
  tool: EditorTool;
  insets: EdgeInsets;
  onClose: () => void;
  onSelectFilter: (filter: FilterId) => void;
  onSelectTool: (tool: EditorTool) => void;
};

// Room below the photo for the tool tabs and filter row on short phones.
const PANEL_MIN_HEIGHT = 200;

/** The editor layout (design: Capture): the 3:4 photo with the filter applied, tool tabs, the tool's panel. */
export function EditorView({
  image,
  slot,
  time,
  filter,
  tool,
  insets,
  onClose,
  onSelectFilter,
  onSelectTool,
}: EditorViewProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const available = window.height - insets.top - PANEL_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);
  const height = width / photo.aspect;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="editor-screen">
      <View
        style={[styles.photo, { width, height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('edit.photo', { filter: t(`edit.filter.${filter}`) })}
      >
        <FilteredPhoto
          image={image}
          matrix={filterMatrices[filter]}
          width={width}
          height={height}
          testID="editor-photo"
        />
      </View>
      {/* Outside the accessible photo group so VoiceOver can reach the buttons. */}
      <View style={[styles.topRow, { top: insets.top + space.xxl }]}>
        <RoundIconButton
          icon="close"
          variant="glass"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          testID="editor-close"
        />
        <SlotTag slot={t(`slots.${slot}`)} time={time} />
        <View style={styles.topRowSpacer} />
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + space.xxl }]}>
        <SegmentedControl
          segments={editorTools.map((key) => ({ key, label: t(`edit.tool.${key}`) }))}
          selected={tool}
          onSelect={onSelectTool}
          accessibilityLabel={t('edit.tools')}
          variant="dark"
          testID="editor-tools"
        />
        {tool === 'filters' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityLabel={t('edit.filters')}
            contentContainerStyle={styles.filters}
            testID="editor-filters"
          >
            {filterIdSchema.options.map((id) => (
              <FilterThumbnail
                key={id}
                label={t(`edit.filter.${id}`)}
                image={image}
                matrix={filterMatrices[id]}
                selected={id === filter}
                onPress={() => onSelectFilter(id)}
                testID={`editor-filter-${id}`}
              />
            ))}
          </ScrollView>
        ) : (
          // TODO(M2-15 #44 Stickers, M2-16 #45 Bubble, M2-17 #46 Text): each tool's panel.
          <View style={styles.emptyPanel} testID={`editor-panel-${tool}`} />
        )}
        {/* TODO(M2-12 #41): caption, Keep this moment private, Undo and "Add to #slot". */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.editor },
  photo: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.editorPhoto,
    borderBottomLeftRadius: radius.editorPhoto,
    borderBottomRightRadius: radius.editorPhoto,
  },
  topRow: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  topRowSpacer: { width: sizes.roundButton },
  panel: {
    flex: 1,
    marginTop: -sizes.editorPanelOverlap,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: space.lg + 2,
    paddingHorizontal: space.xl,
    gap: space.md + 2,
  },
  // 12 px between thumbnails, as designed: each thumbnail already reserves its ring and white gap.
  filters: { gap: space.md - 2 * (sizes.filterRing + sizes.filterRingGap) },
  emptyPanel: { flex: 1 },
});
