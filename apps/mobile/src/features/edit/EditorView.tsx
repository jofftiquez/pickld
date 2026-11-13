import type { SkImage } from '@shopify/react-native-skia';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import { BubblePanel } from './bubble/BubblePanel';
import { EditorToolbar } from './EditorToolbar';
import type { Overlay } from './edits';
import { FilteredPhoto } from './FilteredPhoto';
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
  /** Adds an overlay on top and selects it (Bubble tool); see useEditorState.addOverlay. */
  onAddOverlay: (overlay: Overlay, group?: string) => void;
  /** Changes an overlay's content (Bubble tool); see useEditorState.updateOverlay. */
  onUpdateOverlay: (id: string, update: (overlay: Overlay) => Overlay, group?: string) => void;
  onSelectTool: (tool: EditorTool) => void;
  caption: string;
  onChangeCaption: (caption: string) => void;
  /** Opened from Moment options' Edit caption (M2-23): the caption field starts focused. */
  focusCaption?: boolean;
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

// Room below the photo for the tools, caption and privacy switch (Save is in the toolbar, D-59); the
// photo shrinks on short phones so they fit. Taller tools (Stickers) and large text scroll the screen.
const PANEL_MIN_HEIGHT = 260;

// Parallax (item 14): while the panel scrolls up over it, the photo moves up at 40% of the scroll speed
// and shrinks to 92%, so its top stays in view under the toolbar.
const PHOTO_SCROLL_SPEED = 0.4;
const PHOTO_MIN_SCALE = 0.92;
// The panel can scroll up until this much of the photo's height is left showing between the toolbar and
// the panel; the panel is at least tall enough to allow it.
const PHOTO_PEEK = 0.25;

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
  onAddOverlay,
  onUpdateOverlay,
  onSelectTool,
  caption,
  onChangeCaption,
  focusCaption = false,
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
  const reduceMotion = useReduceMotion();
  // The toolbar's height until it has been measured: the safe area, a round button and its padding.
  const [toolbarHeight, setToolbarHeight] = useState(insets.top + sizes.roundButton + 2 * space.sm);
  const available = window.height - toolbarHeight - PANEL_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);
  const height = width / photo.aspect;
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
    // The app has no gesture root, so the editor brings its own for the overlay gestures.
    <GestureHandlerRootView style={styles.root}>
      {/* First, so screen readers start with Close and Save; zIndex keeps it over the scrolling photo. */}
      <EditorToolbar
        topInset={insets.top}
        slot={t(`slots.${slot}`)}
        time={time}
        saveLabel={saveLabel}
        saving={saving}
        onClose={onClose}
        onSave={onSave}
        onHeight={(h) => setToolbarHeight(Math.round(h))}
      />
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
        <View style={[styles.panel, { minHeight: panelMinHeight, paddingBottom: insets.bottom + space.xxl }]}>
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
          ) : tool === 'bubble' ? (
            <BubblePanel
              overlays={overlays}
              selectedId={selectedOverlayId}
              onAdd={onAddOverlay}
              onUpdate={onUpdateOverlay}
            />
          ) : tool === 'text' ? (
            <TextPanel
              key={selectedText ? `${selectedText.id}:${selectedText.text}` : 'new'}
              selected={selectedText}
              onAdd={onAddOverlay}
              onChange={(id, patch) => onUpdateOverlay(id, (o) => (o.type === 'text' ? applyTextChange(o, patch) : o))}
            />
          ) : (
            <View style={styles.emptyPanel} testID={`editor-panel-${tool}`} />
          )}
          <TextField
            label={t('edit.caption')}
            value={caption}
            onChangeText={onChangeCaption}
            maxLength={CAPTION_MAX}
            placeholder={t('edit.captionPlaceholder')}
            autoFocus={focusCaption}
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
          {saveFailed ? (
            <Text
              style={[textStyle('bodySmall'), styles.error]}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
            >
              {t('edit.saveFailed')}
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
    </GestureHandlerRootView>
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
  error: { color: colors.danger },
  actions: { flexDirection: 'row' },
});
