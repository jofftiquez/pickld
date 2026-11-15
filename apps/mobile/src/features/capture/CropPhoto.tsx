import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import {
  GestureDetector,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

import { Icon } from '@/components/Icon';
import { SnapGuides } from '@/components/SnapGuides';
import { selectionHaptic } from '@/lib/haptics';
import {
  clampFitLayout,
  DEFAULT_FIT_PLACE,
  fitPlacement,
  rotatedSize,
  type FitLayout,
  type FitPlace,
  type Size,
} from '@/lib/image/crop';
import { snapCenter } from '@/lib/image/snap';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, crop, fitBorderColors, fitFrameColors, radius, sizes } from '@/theme/tokens';

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
  /**
   * Fit (D-152, D-154): the whole photo inside the frame where this layout puts it, with its border and corners,
   * on its frame style, as preparation draws it. No crop chrome; drag moves the photo, pinch resizes it and a
   * double tap puts it back whole and centred, each step clamped so it stays whole inside the frame
   * (`onFitChange`). A drag snaps the photo's centre to the frame's centre across and/or down (D-158), with a
   * guide line and a tick while snapped. Null or absent: Fill, today's crop.
   */
  fit?: FitLayout | null;
  onFitChange?: (place: FitPlace) => void;
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
 * the frame's centre; both stay clamped so the frame is always filled. In Fit (D-154) the frame shows its style
 * with the photo laid out on it and no crop chrome. Nothing animates (Reduce Motion).
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
  onFitChange,
}: CropPhotoProps) {
  const { t } = useTranslation();
  // The turned photo's size, and Fit's layout pulled back inside the frame: what is drawn, and where gestures start.
  const turned = rotatedSize(image, state.rotation);
  const placed = fit ? clampFitLayout(turned, fit, frame) : null;
  // Gesture callbacks read the latest state, not the one from when they were made.
  const latest = useRef({ state, placed, turned, onFitChange });
  useEffect(() => {
    latest.current = { state, placed, turned, onFitChange };
  });
  const panStart = useRef(state.pan);
  const zoomStart = useRef(state.zoom);
  const placeStart = useRef<FitPlace>(DEFAULT_FIT_PLACE);
  // Fit's centre snap (D-158): which axes are snapped now, kept for the next drag step and shown as guides.
  const snapped = useRef({ x: false, y: false });
  const [guides, setGuides] = useState({ x: false, y: false });
  const showGuides = (next: { x: boolean; y: boolean }) => {
    snapped.current = next;
    setGuides((shown) => (shown.x === next.x && shown.y === next.y ? shown : next));
  };
  // Fit: the layout moved or resized from where the gesture started, clamped, handed up.
  const moveFit = (change: Partial<FitPlace>) => {
    const { placed: now, turned: size, onFitChange: report } = latest.current;
    if (!now) return;
    const next = clampFitLayout(size, { ...now, ...placeStart.current, ...change }, frame);
    report?.({ scale: next.scale, x: next.x, y: next.y });
  };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    testID: 'crop-pan',
    onActivate: () => {
      panStart.current = latest.current.state.pan;
      if (latest.current.placed) placeStart.current = latest.current.placed;
      snapped.current = { x: false, y: false };
    },
    onUpdate: (e) => {
      const { placed: now, turned: size } = latest.current;
      if (now) {
        const start = placeStart.current;
        const x = start.x + e.translationX / frame.width;
        const y = start.y + e.translationY / frame.height;
        // Snapped in points from the frame's centre, so the threshold is the same on any screen; only on an axis
        // the photo can move along (one that spans the frame is always centred there, so it shows no guide).
        const room = clampFitLayout(size, { ...now, ...start, x: 1, y: 1 }, frame);
        const was = snapped.current;
        const snap = snapCenter({ x: x * frame.width, y: y * frame.height }, sizes.snapThreshold, was);
        const next = { x: snap.snappedX && room.x > 0, y: snap.snappedY && room.y > 0 };
        if ((next.x && !was.x) || (next.y && !was.y)) selectionHaptic();
        showGuides(next);
        // Snapped means exactly centred: 0, the double tap's value, so the saved photo matches the preview.
        moveFit({ x: next.x ? 0 : x, y: next.y ? 0 : y });
        return;
      }
      const next = { x: panStart.current.x + e.translationX, y: panStart.current.y + e.translationY };
      onChange(panCrop(latest.current.state, next, image, frame));
    },
    onFinalize: () => showGuides({ x: false, y: false }),
  });
  const pinch = usePinchGesture({
    runOnJS: true,
    testID: 'crop-pinch',
    onActivate: () => {
      zoomStart.current = latest.current.state.zoom;
      if (latest.current.placed) placeStart.current = latest.current.placed;
    },
    onUpdate: (e) => {
      if (latest.current.placed) {
        moveFit({ scale: placeStart.current.scale * e.scale });
        return;
      }
      onChange(zoomCrop(latest.current.state, zoomStart.current * e.scale, image, frame));
    },
  });
  // Fit only: a double tap puts the photo back whole and centred.
  const recentre = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    enabled: fit !== null,
    testID: 'crop-double-tap',
    onActivate: () => {
      if (!latest.current.placed) return;
      placeStart.current = DEFAULT_FIT_PLACE;
      moveFit({});
    },
  });
  const gesture = useSimultaneousGestures(pan, pinch, recentre);

  const width = areaWidth;
  const inset = (areaWidth - frame.width) / 2;
  const height = frame.height + crop.frameInsetY * 2;
  const bottom = crop.frameInsetY + frame.height;
  // Turned first, then mirrored on screen: the order the image pipeline applies them.
  const turn = [{ scaleX: state.flip ? -1 : 1 }, { rotate: `${state.rotation}deg` }];
  const cover = coverScale(image, frame, state.rotation);
  // Fit: where the layout puts the photo in the frame, in points (zoom and pan come back on Fill).
  const place = placed ? fitPlacement(turned, frame, placed) : null;
  const scale = place ? place.photo.width / turned.width : cover * state.zoom;
  const shown = { width: image.width * scale, height: image.height * scale };
  const centre = { x: width / 2 + state.pan.x, y: height / 2 + state.pan.y };
  const photo = (
    // Full resolution, held in memory: the view's size changes on every pinch step, and expo-image would
    // otherwise shrink the photo to each size with a fresh decode from disk, cancelled by the next step, so the
    // photo showed a smaller copy stretched up while zooming (D-139).
    <Image
      source={{ uri }}
      allowDownscaling={false}
      cachePolicy="memory"
      contentFit="fill"
      accessible
      accessibilityLabel={t('crop.photo')}
      style={{
        position: 'absolute',
        left: place ? place.photo.width / 2 - shown.width / 2 : centre.x - shown.width / 2,
        top: place ? place.photo.height / 2 - shown.height / 2 : centre.y - shown.height / 2,
        width: shown.width,
        height: shown.height,
        transform: turn,
      }}
      testID="crop-photo"
    />
  );

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
              fit.frame === 'blur' ? null : { backgroundColor: fitFrameColors[fit.frame] },
            ]}
            testID={`crop-fit-backdrop-${fit.frame}`}
          >
            {fit.frame === 'blur' ? (
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
        {place && placed ? (
          <>
            {/* The border: a rounded box of its colour under the photo, as wide on every side. */}
            <View
              pointerEvents="none"
              style={[
                styles.placed,
                {
                  left: inset + place.box.x,
                  top: crop.frameInsetY + place.box.y,
                  width: place.box.width,
                  height: place.box.height,
                  borderRadius: place.radius,
                },
                place.border > 0 ? { backgroundColor: fitBorderColors[placed.borderColor] } : null,
              ]}
              testID="crop-fit-box"
            />
            {/* The photo, clipped to its own corners inside the border. */}
            <View
              pointerEvents="none"
              style={[
                styles.placed,
                {
                  left: inset + place.photo.x,
                  top: crop.frameInsetY + place.photo.y,
                  width: place.photo.width,
                  height: place.photo.height,
                  borderRadius: Math.max(0, place.radius - place.border),
                },
              ]}
              testID="crop-fit-photo"
            >
              {photo}
            </View>
          </>
        ) : (
          photo
        )}
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
          {/* Fit is a layout, not a crop: no frame outline, grid or corner marks over it (D-154). */}
          {place ? null : (
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
          )}
        </View>
        {place ? (
          <View
            pointerEvents="none"
            style={[styles.placed, { left: inset, top: crop.frameInsetY, width: frame.width, height: frame.height }]}
          >
            <SnapGuides vertical={guides.x} horizontal={guides.y} testID="crop-snap" />
          </View>
        ) : null}
        {place ? null : (
          <View accessible accessibilityLabel={aspectLabel} style={styles.chip} testID="crop-aspect-chip">
            <Icon name="lock" color="ink" size={crop.chipIcon} strokeWidth={2.6} />
            <Text style={[textStyle('label', '700'), styles.chipText]}>{aspect}</Text>
          </View>
        )}
        <Text style={[textStyle('bodySmall'), styles.hint]} maxFontSizeMultiplier={maxTextScale.control}>
          {t(fit ? 'crop.layout.fitHint' : 'crop.hint')}
        </Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: colors.editor },
  scrim: { position: 'absolute', backgroundColor: colors.cropScrim },
  backdrop: { position: 'absolute', overflow: 'hidden' },
  placed: { position: 'absolute', overflow: 'hidden' },
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
