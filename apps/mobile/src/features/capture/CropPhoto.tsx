import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';

import { Icon } from '@/components/Icon';
import type { Size } from '@/lib/image/crop';
import { textStyle } from '@/theme/text';
import { colors, crop, radius } from '@/theme/tokens';

import { coverScale, panCrop, zoomCrop, type CropState } from './cropMath';

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
};

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
}: CropPhotoProps) {
  const { t } = useTranslation();
  // Gesture callbacks read the latest state, not the one from when they were made.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
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
      onChange(zoomCrop(latest.current, zoomStart.current * e.scale, image, frame));
    },
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const width = areaWidth;
  const inset = (areaWidth - frame.width) / 2;
  const height = frame.height + crop.frameInsetY * 2;
  const scale = coverScale(image, frame, state.rotation) * state.zoom;
  const shown = { width: image.width * scale, height: image.height * scale };
  const centre = { x: width / 2 + state.pan.x, y: height / 2 + state.pan.y };
  const bottom = crop.frameInsetY + frame.height;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.root, { height }]} testID="crop-area">
        <Image
          source={{ uri }}
          contentFit="fill"
          accessible
          accessibilityLabel={t('crop.photo')}
          style={{
            position: 'absolute',
            left: centre.x - shown.width / 2,
            top: centre.y - shown.height / 2,
            width: shown.width,
            height: shown.height,
            // Turned first, then mirrored on screen: the order the image pipeline applies them.
            transform: [{ scaleX: state.flip ? -1 : 1 }, { rotate: `${state.rotation}deg` }],
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
        <Text style={[textStyle('bodySmall'), styles.hint]}>{t('crop.hint')}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: colors.editor },
  scrim: { position: 'absolute', backgroundColor: colors.cropScrim },
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
