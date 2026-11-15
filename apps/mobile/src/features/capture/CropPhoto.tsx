import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';

import { Icon } from '@/components/Icon';
import type { FitFrame, Size } from '@/lib/image/crop';
import { textStyle } from '@/theme/text';
import { colors, crop, fitFrameColors, radius } from '@/theme/tokens';

import { containScale, coverScale, panCrop, zoomCrop, type CropState } from './cropMath';

export type CropPhotoProps = {
  uri: string;
  /** The photo's pixel size, before rotation. */
  image: Size;
  /** The frame (3:4, or square or 5:2 for profile photos) in points, centred across `areaWidth`; the area
   * is the frame plus `crop.frameInsetY` above and below. */
  frame: Size;
  areaWidth: number;
  state: CropState;
  /** Every drag or pinch step, already clamped so the photo fills the frame. */
  onChange: (state: CropState) => void;
  /** The lock chip's text and label, already translated, e.g. "3:4" and "Crop locked to 3:4". */
  aspect: string;
  aspectLabel: string;
  /** The avatar's circle guide instead of the thirds grid (D-79): the corners outside it are dimmed. */
  circle?: boolean;
  /**
   * Fit (D-152): the whole photo inside the frame on this frame style, as preparation draws it; drag and pinch
   * do nothing. Null or absent: Fill, today's crop.
   */
  fit?: FitFrame | null;
};

/**
 * expo-image's blur radius that looks like the saved photo's blur (sigma `crop.fitBlur` of the frame's width):
 * expo-image halves the radius and SDWebImage blurs with a Gaussian of that sigma, in points.
 */
export function previewBlurRadius(frameWidth: number): number {
  return crop.fitBlur * frameWidth * 2;
}

const THIRDS = ['33.333%', '66.666%'] as const;
const CORNERS = [
  {
    top: -crop.cornerOffset,
    left: -crop.cornerOffset,
    borderTopWidth: crop.cornerWidth,
    borderLeftWidth: crop.cornerWidth,
    borderTopLeftRadius: crop.cornerRadius,
  },
  {
    top: -crop.cornerOffset,
    right: -crop.cornerOffset,
    borderTopWidth: crop.cornerWidth,
    borderRightWidth: crop.cornerWidth,
    borderTopRightRadius: crop.cornerRadius,
  },
  {
    bottom: -crop.cornerOffset,
    left: -crop.cornerOffset,
    borderBottomWidth: crop.cornerWidth,
    borderLeftWidth: crop.cornerWidth,
    borderBottomLeftRadius: crop.cornerRadius,
  },
  {
    bottom: -crop.cornerOffset,
    right: -crop.cornerOffset,
    borderBottomWidth: crop.cornerWidth,
    borderRightWidth: crop.cornerWidth,
    borderBottomRightRadius: crop.cornerRadius,
  },
] as const;

/**
 * The dark photo area of the Crop screen (FR-CAP-03): the photo under a fixed frame with rule-of-thirds
 * grid (or the avatar's circle guide) and corner marks, the aspect lock chip and the gesture hint. Drag moves the photo, pinch zooms it about
 * the frame's centre; both stay clamped so the frame is always filled. Nothing animates (Reduce Motion).
 */
export function CropPhoto({
  uri,
  image,
  frame,
  areaWidth,
  state,
  onChange,
  aspect,
  aspectLabel,
  circle = false,
  fit = null,
}: CropPhotoProps) {
  const { t } = useTranslation();
  // Gesture callbacks read the latest state, not the one from when they were made.
  const latest = useRef(state);
  const fitting = useRef(fit !== null);
  useEffect(() => {
    latest.current = state;
    fitting.current = fit !== null;
  }, [state, fit]);
  const panStart = useRef(state.pan);
  const zoomStart = useRef(state.zoom);

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    testID: 'crop-pan',
    onActivate: () => {
      panStart.current = latest.current.pan;
    },
    onUpdate: (e) => {
      if (fitting.current) return;
      const next = { x: panStart.current.x + e.translationX, y: panStart.current.y + e.translationY };
      onChange(panCrop(latest.current, next, image, frame));
    },
  });
  const pinch = usePinchGesture({
    runOnJS: true,
    testID: 'crop-pinch',
    onActivate: () => {
      zoomStart.current = latest.current.zoom;
    },
    onUpdate: (e) => {
      if (fitting.current) return;
      onChange(zoomCrop(latest.current, zoomStart.current * e.scale, image, frame));
    },
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const width = areaWidth;
  const inset = (areaWidth - frame.width) / 2;
  const height = frame.height + crop.frameInsetY * 2;
  // Fit: the whole photo, centred, whatever the zoom and pan say (they come back on Fill).
  const scale = fit
    ? containScale(image, frame, state.rotation)
    : coverScale(image, frame, state.rotation) * state.zoom;
  const shown = { width: image.width * scale, height: image.height * scale };
  const centre = fit ? { x: width / 2, y: height / 2 } : { x: width / 2 + state.pan.x, y: height / 2 + state.pan.y };
  const bottom = crop.frameInsetY + frame.height;
  // Turned first, then mirrored on screen: the order the image pipeline applies them.
  const turn = [{ scaleX: state.flip ? -1 : 1 }, { rotate: `${state.rotation}deg` }];
  const cover = coverScale(image, frame, state.rotation);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.root, { height }]} testID="crop-area">
        {fit ? (
          // Fit's frame style fills the frame behind the photo: a plain colour, or the photo itself covering the
          // frame, blurred. Decoded at its shown size, so the blur matches the saved photo's.
          <View
            pointerEvents="none"
            style={[
              styles.backdrop,
              { left: inset, top: crop.frameInsetY, width: frame.width, height: frame.height },
              fit === 'blur' ? null : { backgroundColor: fitFrameColors[fit] },
            ]}
            testID={`crop-fit-backdrop-${fit}`}
          >
            {fit === 'blur' ? (
              <Image
                source={{ uri }}
                cachePolicy="memory"
                contentFit="fill"
                blurRadius={previewBlurRadius(frame.width)}
                style={{
                  position: 'absolute',
                  left: frame.width / 2 - (image.width * cover) / 2,
                  top: frame.height / 2 - (image.height * cover) / 2,
                  width: image.width * cover,
                  height: image.height * cover,
                  transform: turn,
                }}
              />
            ) : null}
          </View>
        ) : null}
        {/* Full resolution, held in memory: the view's size changes on every pinch step, and expo-image would
            otherwise shrink the photo to each size with a fresh decode from disk, cancelled by the next step,
            so the photo showed a smaller copy stretched up while zooming (D-139). */}
        <Image
          source={{ uri }}
          allowDownscaling={false}
          cachePolicy="memory"
          contentFit="fill"
          accessible
          accessibilityLabel={t('crop.photo')}
          style={{
            position: 'absolute',
            left: centre.x - shown.width / 2,
            top: centre.y - shown.height / 2,
            width: shown.width,
            height: shown.height,
            transform: turn,
          }}
          testID="crop-photo"
        />
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.scrim, { left: 0, right: 0, top: 0, height: crop.frameInsetY }]} />
          <View style={[styles.scrim, { left: 0, right: 0, top: bottom, bottom: 0 }]} />
          <View style={[styles.scrim, { left: 0, width: inset, top: crop.frameInsetY, height: frame.height }]} />
          <View style={[styles.scrim, { right: 0, width: inset, top: crop.frameInsetY, height: frame.height }]} />
          <View
            style={[styles.frame, { left: inset, top: crop.frameInsetY, width: frame.width, height: frame.height }]}
            testID="crop-frame"
          >
            {circle ? (
              <View style={styles.circleClip} testID="crop-circle">
                {/* A ring as thick as the radius: its inner edge is the guide, its body dims the corners. */}
                <View
                  style={[
                    styles.circleRing,
                    {
                      left: -frame.width / 2,
                      top: -frame.height / 2,
                      width: frame.width * 2,
                      height: frame.height * 2,
                      borderRadius: frame.width,
                      borderWidth: frame.width / 2,
                    },
                  ]}
                />
                <View style={[styles.circleGuide, { borderRadius: frame.width / 2 }]} />
              </View>
            ) : (
              <>
                {THIRDS.map((at) => (
                  <View key={`v${at}`} style={[styles.vertical, { left: at }]} />
                ))}
                {THIRDS.map((at) => (
                  <View key={`h${at}`} style={[styles.horizontal, { top: at }]} />
                ))}
              </>
            )}
            {CORNERS.map((corner, i) => (
              <View key={i} style={[styles.corner, corner]} />
            ))}
          </View>
        </View>
        <View accessible accessibilityLabel={aspectLabel} style={styles.chip} testID="crop-aspect-chip">
          <Icon name="lock" color="ink" size={crop.chipIcon} strokeWidth={2.6} />
          <Text style={[textStyle('label', '700'), styles.chipText]}>{aspect}</Text>
        </View>
        <Text style={[textStyle('bodySmall'), styles.hint]}>{t(fit ? 'crop.layout.fitHint' : 'crop.hint')}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: colors.editor },
  scrim: { position: 'absolute', backgroundColor: colors.cropScrim },
  backdrop: { position: 'absolute', overflow: 'hidden' },
  frame: { position: 'absolute', borderWidth: crop.frameOutline, borderColor: colors.cropOutline },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.cropGrid },
  horizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.cropGrid },
  circleClip: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  circleRing: { position: 'absolute', borderColor: colors.cropScrim },
  circleGuide: { ...StyleSheet.absoluteFill, borderWidth: crop.frameOutline, borderColor: colors.cropOutline },
  corner: { position: 'absolute', width: crop.corner, height: crop.corner, borderColor: colors.surface },
  chip: {
    position: 'absolute',
    top: crop.chipTop,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: crop.chipGap,
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: crop.chipPaddingX,
    paddingVertical: crop.chipPaddingY,
  },
  chipText: { color: colors.ink },
  hint: {
    position: 'absolute',
    bottom: crop.hintBottom,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.onDarkMuted,
  },
});
