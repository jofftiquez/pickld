import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { RoundIconButton } from '@/components/RoundIconButton';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import { CameraSideButton } from './CameraSideButton';
import type { FlashSetting } from './CameraPreview';
import { CameraTouchArea } from './CameraTouchArea';
import type { Point } from './cameraZoom';
import { ShutterButton } from './ShutterButton';
import { SlotTag } from './SlotTag';
import type { CameraZoom } from './useCameraZoom';
import { ViewfinderGrid } from './ViewfinderGrid';
import { ZoomControls } from './ZoomControls';

export type CameraViewProps = {
  /** The live preview (vision-camera) or the dev mock; fills the 3:4 viewfinder. */
  preview: ReactNode;
  /** The slot the photo is added to; shown read only in the slot tag (the tile that opened the camera). */
  slot: Slot;
  /** Current time, formatted for the slot tag. */
  time: string;
  /** Fill this jar: the past day being filled, formatted for the slot tag. */
  date?: string;
  flash: FlashSetting;
  flashSupported: boolean;
  shutterDisabled: boolean;
  /** Pinch to zoom and the lens buttons (D-144). */
  zoom: Pick<CameraZoom, 'plan' | 'selected' | 'pinchFactor' | 'select' | 'pinch'>;
  /** Whether tapping the viewfinder focuses there (the lens supports it). */
  canFocus: boolean;
  onFocus: (point: Point) => void;
  insets: EdgeInsets;
  onClose: () => void;
  onToggleFlash: () => void;
  onFlip: () => void;
  onGallery: () => void;
  onShutter: () => void;
  /** Rendered over the screen, e.g. the Replace dialog (M2-22). */
  overlay?: ReactNode;
};

// Room below the viewfinder for the shutter row on short phones.
const CONTROLS_MIN_HEIGHT = 140;

/** The Camera screen layout (design: Camera): 3:4 viewfinder with grid, controls and slot tag, then the shutter row. */
export function CameraView({
  preview,
  slot,
  time,
  date,
  flash,
  flashSupported,
  shutterDisabled,
  zoom,
  canFocus,
  onFocus,
  insets,
  onClose,
  onToggleFlash,
  onFlip,
  onGallery,
  onShutter,
  overlay,
}: CameraViewProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const tag = t(`slots.${slot}`);
  const available = window.height - insets.top - insets.bottom - CONTROLS_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);

  // The camera is a full-screen modal, outside the app's root gesture view; pinch and tap need their own.
  return (
    <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top }]} testID="camera-screen">
      <View style={[styles.viewfinder, { width, height: width / photo.aspect }]} testID="camera-viewfinder">
        <CameraTouchArea pinch={zoom.pinch} canFocus={canFocus} onFocus={onFocus}>
          {preview}
        </CameraTouchArea>
        <ViewfinderGrid />
        <View style={styles.topRow}>
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            testID="camera-close"
          />
          <SlotTag slot={tag} time={time} date={date} />
          <RoundIconButton
            icon={flash === 'on' ? 'flash' : 'flashOff'}
            variant="glass"
            accessibilityLabel={flash === 'on' ? t('camera.flashOn') : t('camera.flashOff')}
            accessibilityHint={t('camera.flashHint')}
            onPress={onToggleFlash}
            disabled={!flashSupported}
            testID="camera-flash"
          />
        </View>
        <View style={styles.bottom} pointerEvents="box-none">
          <ZoomControls
            stops={zoom.plan?.stops ?? []}
            selected={zoom.selected}
            pinchFactor={zoom.pinchFactor}
            onSelect={zoom.select}
          />
        </View>
        {/* The 3:4 label sits in the bottom-left corner, under the Close button and level with the zoom row,
            so the zoom row has the bottom of the viewfinder to itself (D-145). It is only a label: taps pass
            through to tap to focus, and screen readers skip it. */}
        <View
          style={styles.aspectCorner}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          testID="camera-aspect"
        >
          <View style={styles.aspect}>
            <Text
              style={[textStyle('caption'), { color: colors.surface }]}
              maxFontSizeMultiplier={maxTextScale.control}
              numberOfLines={1}
            >
              {t('camera.aspect')}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.shutterRow, { paddingBottom: insets.bottom + space.md }]}>
        <CameraSideButton
          icon="gallery"
          shape="tile"
          accessibilityLabel={t('camera.gallery')}
          onPress={onGallery}
          testID="camera-gallery"
        />
        <ShutterButton
          accessibilityLabel={t('camera.shutter')}
          accessibilityHint={t('camera.shutterHint', { slot: tag })}
          onPress={onShutter}
          disabled={shutterDisabled}
        />
        <CameraSideButton
          icon="flip"
          shape="round"
          accessibilityLabel={t('camera.flip')}
          onPress={onFlip}
          testID="camera-flip"
        />
      </View>
      {overlay}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera },
  viewfinder: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.camera,
    borderBottomLeftRadius: radius.viewfinder,
    borderBottomRightRadius: radius.viewfinder,
  },
  topRow: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  bottom: {
    position: 'absolute',
    bottom: space.md,
    alignSelf: 'center',
    alignItems: 'center',
  },
  // As tall as the zoom buttons and as far in as Close, so the label lines up with both.
  aspectCorner: {
    position: 'absolute',
    left: space.lg,
    bottom: space.md,
    height: sizes.zoomButton,
    justifyContent: 'center',
  },
  aspect: {
    backgroundColor: colors.badge,
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm + 2,
  },
  shutterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xxxl + space.sm,
  },
});
