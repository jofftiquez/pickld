import type { SkImage } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { SlotTag } from '@/features/capture/SlotTag';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import type { Overlay } from './edits';
import { FilteredPhoto } from './FilteredPhoto';
import { filterIdSchema, filterMatrices, type FilterId } from './filters';
import { FilterThumbnail } from './FilterThumbnail';
import { OverlayLayer } from './overlays/OverlayLayer';
import type { Transform } from './overlays/transform';
import type { CatalogSticker } from './stickers/catalog';
import { StickersPanel } from './stickers/StickersPanel';

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
  overlays: readonly Overlay[];
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  onTransformOverlay: (id: string, transform: Transform) => void;
  onBringOverlayToFront: (id: string) => void;
  onDeleteOverlay: (id: string) => void;
  /** A sticker tapped in the Stickers tool (M2-15). */
  onAddSticker: (sticker: CatalogSticker) => void;
  onSelectTool: (tool: EditorTool) => void;
  caption: string;
  onChangeCaption: (caption: string) => void;
  isPrivate: boolean;
  onChangePrivate: (isPrivate: boolean) => void;
  canUndo: boolean;
  onUndo: () => void;
  /** "Add to #slot" for a photo just taken, "Done" when editing it again. Already translated. */
  saveLabel: string;
  saving: boolean;
  saveFailed: boolean;
  onSave: () => void;
};

export const CAPTION_MAX = 150;

// Room below the photo for the tools, caption, privacy switch and save button; the photo shrinks on
// short phones so they fit. With large text the whole screen scrolls.
const PANEL_MIN_HEIGHT = 330;

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
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  onTransformOverlay,
  onBringOverlayToFront,
  onDeleteOverlay,
  onAddSticker,
  onSelectTool,
  caption,
  onChangeCaption,
  isPrivate,
  onChangePrivate,
  canUndo,
  onUndo,
  saveLabel,
  saving,
  saveFailed,
  onSave,
}: EditorViewProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const available = window.height - insets.top - PANEL_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);
  const height = width / photo.aspect;
  // The screen stops scrolling while a finger moves an overlay.
  const [overlayGesture, setOverlayGesture] = useState(false);

  return (
    // The app has no gesture root, so the editor brings its own for the overlay gestures.
    <GestureHandlerRootView style={styles.root}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        scrollEnabled={!overlayGesture}
        testID="editor-screen"
      >
        <View style={[styles.photo, { width, height }]}>
          <View
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
          {/* A sibling of the photo, not inside it, so screen readers reach each overlay. */}
          <OverlayLayer
            overlays={overlays}
            selectedId={selectedOverlayId}
            width={width}
            height={height}
            onSelect={onSelectOverlay}
            onTransform={onTransformOverlay}
            onBringToFront={onBringOverlayToFront}
            onDelete={onDeleteOverlay}
            onGestureActiveChange={setOverlayGesture}
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
          ) : tool === 'stickers' ? (
            <StickersPanel slot={slot} onAdd={onAddSticker} />
          ) : (
            // TODO(M2-15 #44 Stickers, M2-16 #45 Bubble, M2-17 #46 Text): each tool's panel.
            <View style={styles.emptyPanel} testID={`editor-panel-${tool}`} />
          )}
          <TextField
            label={t('edit.caption')}
            value={caption}
            onChangeText={onChangeCaption}
            maxLength={CAPTION_MAX}
            placeholder={t('edit.captionPlaceholder')}
            testID="editor-caption"
          />
          <View style={styles.privateRow}>
            <View
              style={styles.privateText}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Text style={[textStyle('bodyMedium', '600'), styles.privateLabel]}>{t('edit.private')}</Text>
              <Text style={[textStyle('label', '500'), styles.privateHint]}>{t('edit.privateHint')}</Text>
            </View>
            <Toggle
              value={isPrivate}
              onValueChange={onChangePrivate}
              accessibilityLabel={`${t('edit.private')}. ${t('edit.privateHint')}`}
              testID="editor-private"
            />
          </View>
          <View style={styles.spacer} />
          {saveFailed ? (
            <Text
              style={[textStyle('bodySmall'), styles.error]}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {t('edit.saveFailed')}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {canUndo ? (
              <View>
                <SecondaryButton
                  variant="outline"
                  label={t('edit.undo')}
                  accessibilityHint={t('edit.undoHint')}
                  onPress={onUndo}
                  testID="editor-undo"
                />
              </View>
            ) : null}
            <View style={styles.save}>
              <PrimaryButton label={saveLabel} onPress={onSave} disabled={saving} testID="editor-save" />
            </View>
          </View>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.editor },
  content: { flexGrow: 1 },
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
  emptyPanel: { minHeight: sizes.filterThumb },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: sizes.minTap,
  },
  privateText: { flex: 1 },
  privateLabel: { color: colors.ink },
  privateHint: { color: colors.muted },
  spacer: { flexGrow: 1 },
  error: { color: colors.danger },
  actions: { flexDirection: 'row', gap: space.md - 2 },
  save: { flex: 1 },
});
