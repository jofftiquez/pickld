import type { SkImage } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { textStyle } from '@/theme/text';
import { colors, space, type Slot } from '@/theme/tokens';

import { BubblePanel } from './bubble/BubblePanel';
import type { Overlay } from './edits';
import { editorPhotoStyles, useEditorPhotoFrame } from './editorPhotoFrame';
import { FilteredPhoto } from './FilteredPhoto';
import { FILTER_GAP, filterThumbSize } from './filterGrid';
import { filterIdSchema, filterMatrices, type FilterId } from './filters';
import { FilterThumbnail } from './FilterThumbnail';
import { OverlayLayer } from './overlays/OverlayLayer';
import { PhotoTools, type PhotoToolsProps } from './PhotoTools';
import type { Transform } from './overlays/transform';
import type { CatalogSticker } from './stickers/catalog';
import { StickersPanel } from './stickers/StickersPanel';
import { TextPanel } from './text/TextPanel';
import { applyTextChange, type TextOverlay } from './text/textOverlay';

export const editorTools = ['filters', 'stickers', 'bubble', 'text'] as const;
export type EditorTool = (typeof editorTools)[number];

export type EditPhotoStepProps = {
  image: SkImage | null;
  slot: Slot;
  filter: FilterId;
  tool: EditorTool;
  /** The fixed toolbar's measured height: the photo starts below it. */
  toolbarHeight: number;
  bottomInset: number;
  onSelectFilter: (filter: FilterId) => void;
  overlays: readonly Overlay[];
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
  onTransformOverlay: (id: string, transform: Transform) => void;
  onBringOverlayToFront: (id: string) => void;
  onDeleteOverlay: (id: string) => void;
  /** A sticker tapped in the Stickers tool (M2-15). */
  onAddSticker: (sticker: CatalogSticker) => void;
  /** Adds an overlay on top and selects it (Bubble and Text tools); see useEditorState.addOverlay. */
  onAddOverlay: (overlay: Overlay, group?: string) => void;
  /** Changes an overlay's content (Bubble and Text tools); see useEditorState.updateOverlay. */
  onUpdateOverlay: (id: string, update: (overlay: Overlay) => Overlay, group?: string) => void;
  onSelectTool: (tool: EditorTool) => void;
  canUndo: boolean;
  onUndo: () => void;
  /** The quick photo buttons on the photo (Rotate, Flip, Crop), where the photo can be changed. */
  photoTools?: PhotoToolsProps;
  /** Rotate or Flip couldn't make the changed photo. */
  adjustFailed?: boolean;
};

// The Stickers tool is a tray, as on Instagram: picking it slides the panel all the way up so the whole
// pack fills the screen, and adding a sticker slides it back down to show the sticker on the photo.

/**
 * The editor's first step (D-103; design: EditPhoto): the 3:4 photo as large as fits, with the filter and
 * overlays, then the tool tabs (Filters, Stickers, Bubble, Text), the tool's panel and Undo. No caption or
 * visibility here: Next opens the details step.
 */
export function EditPhotoStep({
  image,
  slot,
  filter,
  tool,
  toolbarHeight,
  bottomInset,
  onSelectFilter,
  overlays,
  selectedOverlayId,
  onSelectOverlay,
  onTransformOverlay,
  onBringOverlayToFront,
  onDeleteOverlay,
  onAddSticker,
  onAddOverlay,
  onUpdateOverlay,
  onSelectTool,
  canUndo,
  onUndo,
  photoTools,
  adjustFailed = false,
}: EditPhotoStepProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const { width, height, panelMinHeight, panelTop, onScroll, photoMotion, reduceMotion } =
    useEditorPhotoFrame(toolbarHeight);
  const filterThumb = filterThumbSize(window.width - 2 * space.xl);
  // The screen stops scrolling while a finger moves an overlay.
  const [overlayGesture, setOverlayGesture] = useState(false);
  const selectedText = overlays.find((o): o is TextOverlay => o.type === 'text' && o.id === selectedOverlayId) ?? null;

  const scroller = useRef<ComponentRef<typeof Animated.ScrollView>>(null);
  const scrollPanel = (to: 'top' | 'photo') =>
    scroller.current?.scrollTo({
      y: to === 'top' ? panelTop : 0,
      animated: !reduceMotion,
    });
  const selectTool = (next: EditorTool) => {
    onSelectTool(next);
    if (next === 'stickers') scrollPanel('top');
  };
  const addSticker = (sticker: CatalogSticker) => {
    onAddSticker(sticker);
    scrollPanel('photo');
  };

  return (
    <Animated.ScrollView
      ref={scroller}
      style={editorPhotoStyles.root}
      contentContainerStyle={[editorPhotoStyles.content, { paddingTop: toolbarHeight }]}
      scrollIndicatorInsets={{ top: toolbarHeight }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      scrollEnabled={!overlayGesture}
      onScroll={onScroll}
      scrollEventThrottle={16}
      testID="editor-screen"
    >
      <Animated.View style={[editorPhotoStyles.photo, { width, height }, photoMotion]} testID="editor-photo-frame">
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
        {photoTools ? <PhotoTools {...photoTools} /> : null}
      </Animated.View>

      {/* After the photo, so it draws over it (and takes the taps) as it slides up. */}
      <View
        style={[
          editorPhotoStyles.panel,
          styles.panel,
          { minHeight: panelMinHeight, paddingBottom: bottomInset + space.xxl },
        ]}
      >
        <SegmentedControl
          segments={editorTools.map((key) => ({ key, label: t(`edit.tool.${key}`) }))}
          selected={tool}
          onSelect={selectTool}
          accessibilityLabel={t('edit.tools')}
          variant="dark"
          testID="editor-tools"
        />
        {tool === 'filters' ? (
          <View accessibilityLabel={t('edit.filters')} style={styles.filters} testID="editor-filters">
            {filterIdSchema.options.map((id) => (
              <FilterThumbnail
                key={id}
                label={t(`edit.filter.${id}`)}
                image={image}
                matrix={filterMatrices[id]}
                selected={id === filter}
                onPress={() => onSelectFilter(id)}
                size={filterThumb}
                testID={`editor-filter-${id}`}
              />
            ))}
          </View>
        ) : tool === 'stickers' ? (
          <StickersPanel slot={slot} onAdd={addSticker} />
        ) : tool === 'bubble' ? (
          <BubblePanel
            overlays={overlays}
            selectedId={selectedOverlayId}
            onAdd={onAddOverlay}
            onUpdate={onUpdateOverlay}
          />
        ) : (
          <TextPanel
            selected={selectedText}
            textCount={overlays.filter((o) => o.type === 'text').length}
            onAdd={onAddOverlay}
            onChange={(id, patch, group) =>
              onUpdateOverlay(id, (o) => (o.type === 'text' ? applyTextChange(o, patch) : o), group)
            }
            onDeselect={() => onSelectOverlay(null)}
          />
        )}
        {adjustFailed ? (
          <Text
            style={[textStyle('bodySmall'), styles.error]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            {t('edit.adjust.failed')}
          </Text>
        ) : null}
        {canUndo ? (
          <View style={styles.actions}>
            <SecondaryButton
              variant="outline"
              label={t('edit.undo')}
              accessibilityHint={t('edit.undoHint')}
              onPress={onUndo}
              testID="editor-undo"
            />
          </View>
        ) : null}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md + 2 },
  // Every filter at once, four to a row (filterGrid.ts): 12 px between the photos, as designed; each
  // thumbnail already reserves its ring and white gap.
  filters: { flexDirection: 'row', flexWrap: 'wrap', columnGap: FILTER_GAP, rowGap: space.sm },
  actions: { flexDirection: 'row' },
  error: { color: colors.danger },
});
