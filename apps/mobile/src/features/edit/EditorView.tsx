import type { SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '@/lib/useReduceMotion';
import type { Visibility } from '@/lib/visibility';
import { colors, sizes, space, type Slot } from '@/theme/tokens';

import { EditDetailsStep } from './EditDetailsStep';
import { EditorToolbar } from './EditorToolbar';
import { EditPhotoStep, type EditorTool } from './EditPhotoStep';
import type { Edits, Overlay } from './edits';
import type { FilterId } from './filters';
import type { Transform } from './overlays/transform';
import type { CatalogSticker } from './stickers/catalog';

export { editorTools, type EditorTool } from './EditPhotoStep';
export { CAPTION_MAX } from './EditDetailsStep';

/** The editor's two steps (D-103): the photo and its tools, then the caption and visibility. */
export type EditorStep = 'photo' | 'details';

export type EditorViewProps = {
  step: EditorStep;
  onChangeStep: (step: EditorStep) => void;
  image: SkImage | null;
  /** The photo's URI, for the details step's preview. */
  photoUri: string;
  slot: Slot;
  /** Capture time, formatted for the slot tag. */
  time: string;
  edits: Edits;
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
  /** Who can see the moment (D-48): Readers, Everyone or Only me, starting at the owner's default. */
  visibility: Visibility;
  onChangeVisibility: (visibility: Visibility) => void;
  canUndo: boolean;
  onUndo: () => void;
  /** "Add to #slot" for a photo just taken, "Done" when editing it again. Already translated. */
  saveLabel: string;
  saving: boolean;
  saveFailed: boolean;
  onSave: () => void;
};

// The step change slides like a navigation push: the details step comes in from the right while the
// photo step moves a quarter of the way out to the left. Reduce Motion: it switches in place.
const STEP_DURATION = 260;
const PHOTO_STEP_SHIFT = 0.25;
// A swipe from the screen's left edge on the details step goes back to the photo step, like a back swipe.
const EDGE_WIDTH = 24;
const BACK_SWIPE = 60;

/**
 * The editor (D-103; designs: EditPhoto, EditDetails), Instagram's two steps in one screen: the photo
 * with its tools, then Next to the caption, the slot's hashtag and visibility, saved by Add to #slot or
 * Done. Both steps share one session, so going back and forth keeps everything; nothing is saved until
 * Save. The toolbar stays on top of both (D-59, D-80).
 */
export function EditorView({
  step,
  onChangeStep,
  image,
  photoUri,
  slot,
  time,
  edits,
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
  visibility,
  onChangeVisibility,
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
  // The details step stays mounted once opened, so its caption keeps its place when going back and forth.
  const [detailsOpened, setDetailsOpened] = useState(step === 'details');
  const onDetails = step === 'details';
  if (onDetails && !detailsOpened) setDetailsOpened(true);

  // 0 on the photo step, 1 on the details step.
  const progress = useSharedValue(onDetails ? 1 : 0);
  useEffect(() => {
    const target = onDetails ? 1 : 0;
    progress.set(
      reduceMotion ? target : withTiming(target, { duration: STEP_DURATION, easing: Easing.out(Easing.cubic) }),
    );
  }, [onDetails, reduceMotion, progress]);
  const photoMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.get() * window.width * PHOTO_STEP_SHIFT }],
  }));
  const detailsMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.get()) * window.width }],
  }));

  const next = () => {
    Keyboard.dismiss();
    onSelectOverlay(null);
    onChangeStep('details');
  };
  const back = () => {
    Keyboard.dismiss();
    onChangeStep('photo');
  };
  const backSwipe = Gesture.Pan()
    .runOnJS(true)
    .hitSlop({ left: 0, width: EDGE_WIDTH })
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX > BACK_SWIPE) back();
    });

  return (
    // The app has no gesture root, so the editor brings its own for the overlay gestures.
    <GestureHandlerRootView style={styles.root}>
      {/* First, so screen readers start with Close or Back and the step's action; zIndex keeps it over both steps. */}
      <EditorToolbar
        topInset={insets.top}
        slot={t(`slots.${slot}`)}
        time={time}
        leading={onDetails ? 'back' : 'close'}
        onLeading={onDetails ? back : onClose}
        actionLabel={onDetails ? saveLabel : t('edit.next')}
        actionHint={onDetails ? undefined : t('edit.nextHint')}
        actionTestID={onDetails ? 'editor-save' : 'editor-next'}
        actionDisabled={onDetails && saving}
        onAction={onDetails ? onSave : next}
        onHeight={(h) => setToolbarHeight(Math.round(h))}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, photoMotion]}
        pointerEvents={onDetails ? 'none' : 'auto'}
        importantForAccessibility={onDetails ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={onDetails}
        testID="editor-step-photo"
      >
        <EditPhotoStep
          image={image}
          slot={slot}
          filter={filter}
          tool={tool}
          toolbarHeight={toolbarHeight}
          bottomInset={insets.bottom}
          onSelectFilter={onSelectFilter}
          overlays={overlays}
          selectedOverlayId={selectedOverlayId}
          onSelectOverlay={onSelectOverlay}
          onTransformOverlay={onTransformOverlay}
          onBringOverlayToFront={onBringOverlayToFront}
          onDeleteOverlay={onDeleteOverlay}
          onAddSticker={onAddSticker}
          onAddOverlay={onAddOverlay}
          onUpdateOverlay={onUpdateOverlay}
          onSelectTool={onSelectTool}
          canUndo={canUndo}
          onUndo={onUndo}
        />
      </Animated.View>
      {detailsOpened ? (
        <GestureDetector gesture={backSwipe}>
          <Animated.View
            style={[StyleSheet.absoluteFill, detailsMotion]}
            pointerEvents={onDetails ? 'auto' : 'none'}
            importantForAccessibility={onDetails ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={!onDetails}
            testID="editor-step-details"
          >
            <EditDetailsStep
              photoUri={photoUri}
              edits={edits}
              slot={slot}
              toolbarHeight={toolbarHeight}
              bottomInset={insets.bottom}
              caption={caption}
              onChangeCaption={onChangeCaption}
              focusCaption={focusCaption}
              visibility={visibility}
              onChangeVisibility={onChangeVisibility}
              saveFailed={saveFailed}
            />
          </Animated.View>
        </GestureDetector>
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.editor },
});
