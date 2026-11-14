import type { SkImage } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import { BubblePanel } from './bubble/BubblePanel';
import type { Overlay } from './edits';
import { FilteredPhoto } from './FilteredPhoto';
import { FILTER_GAP, FILTER_LEAD, filterThumbSize } from './filterRow';
import { filterIdSchema, filterMatrices, type FilterId } from './filters';
import { FilterThumbnail } from './FilterThumbnail';
import { OverlayLayer } from './overlays/OverlayLayer';
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
};

// Room below the photo for the tool tabs and the filter row; the photo shrinks on short phones so they
// fit. Taller tools (Stickers, Text with the keyboard up) and large text scroll the screen.
const PANEL_MIN_HEIGHT = 260;

// Parallax (item 14, kept on the photo step by D-105): while the panel scrolls up over it, the photo moves
// up at 40% of the scroll speed and shrinks to 92%, so its top stays in view under the toolbar.
const PHOTO_SCROLL_SPEED = 0.4;
const PHOTO_MIN_SCALE = 0.92;
// The panel can scroll up until this much of the photo's height is left showing between the toolbar and
// the panel; the panel is at least tall enough to allow it.
const PHOTO_PEEK = 0.25;

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
}: EditPhotoStepProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const available = window.height - toolbarHeight - PANEL_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);
  const height = width / photo.aspect;
  const filterThumb = filterThumbSize(window.width);
  const panelMinHeight = Math.max(PANEL_MIN_HEIGHT, window.height - toolbarHeight - Math.round(height * PHOTO_PEEK));
  // The screen stops scrolling while a finger moves an overlay.
  const [overlayGesture, setOverlayGesture] = useState(false);
  const selectedText = overlays.find((o): o is TextOverlay => o.type === 'text' && o.id === selectedOverlayId) ?? null;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  // The photo scrolls with the content, so it is pushed back down by the part of the scroll it skips.
  // Pulling down past the top (bounce) moves it with the content. Reduce Motion: a plain scroll.
  const photoMotion = useAnimatedStyle(() => {
    if (reduceMotion || height <= 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const scrolled = Math.max(0, scrollY.get());
    const progress = Math.min(1, scrolled / height);
    return {
      transform: [{ translateY: scrolled * (1 - PHOTO_SCROLL_SPEED) }, { scale: 1 - (1 - PHOTO_MIN_SCALE) * progress }],
    };
  });

  return (
    <Animated.ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: toolbarHeight }]}
      scrollIndicatorInsets={{ top: toolbarHeight }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      scrollEnabled={!overlayGesture}
      onScroll={onScroll}
      scrollEventThrottle={16}
      testID="editor-screen"
    >
      <Animated.View style={[styles.photo, { width, height }, photoMotion]}>
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
      </Animated.View>

      {/* After the photo, so it draws over it (and takes the taps) as it slides up. */}
      <View style={[styles.panel, { minHeight: panelMinHeight, paddingBottom: bottomInset + space.xxl }]}>
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
            style={styles.filterRow}
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
                size={filterThumb}
                testID={`editor-filter-${id}`}
              />
            ))}
          </ScrollView>
        ) : tool === 'stickers' ? (
          <StickersPanel slot={slot} onAdd={onAddSticker} />
        ) : tool === 'bubble' ? (
          <BubblePanel
            overlays={overlays}
            selectedId={selectedOverlayId}
            onAdd={onAddOverlay}
            onUpdate={onUpdateOverlay}
          />
        ) : (
          <TextPanel
            key={selectedText ? `${selectedText.id}:${selectedText.text}` : 'new'}
            selected={selectedText}
            onAdd={onAddOverlay}
            onChange={(id, patch) => onUpdateOverlay(id, (o) => (o.type === 'text' ? applyTextChange(o, patch) : o))}
          />
        )}
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
  root: { flex: 1, backgroundColor: colors.editor },
  content: { flexGrow: 1 },
  photo: {
    alignSelf: 'center',
    // The parallax shrinks it toward its top edge, which stays under the toolbar.
    transformOrigin: 'top',
    overflow: 'hidden',
    backgroundColor: colors.editorPhoto,
    borderBottomLeftRadius: radius.editorPhoto,
    borderBottomRightRadius: radius.editorPhoto,
  },
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
  // The row runs to both screen edges, so the last thumbnail in view is cut by the edge (filterRow.ts).
  filterRow: { marginHorizontal: -space.xl },
  // 12 px between thumbnails, as designed: each thumbnail already reserves its ring and white gap.
  filters: { gap: FILTER_GAP, paddingHorizontal: FILTER_LEAD },
  actions: { flexDirection: 'row' },
});
