import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { maxTextScale, textStyle, type FontWeight, type TextVariant } from '@/theme/text';
import { colors, photo, radius as radii, sizes, space } from '@/theme/tokens';
import { photoSource } from '@/lib/image/photoCache';

export type PhotoTileProps = {
  /** Photo to show; `null` shows the placeholder color (e.g. while a queued photo loads). */
  uri: string | null;
  /** Drawn instead of `uri`'s plain image, filling the tile (e.g. a moment with its edits). */
  photoView?: ReactNode;
  /** Describes the photo for screen readers. Without it the image is decorative and hidden. */
  alt?: string;
  /** Fixed height (e.g. `sizes.momentTile`); the tile still grows if its content needs more. Defaults to 3:4. */
  height?: number;
  /** Corner radius token value; defaults to `radius.tile`. */
  radius?: number;
  /** Height of the dark bottom fade; defaults to `sizes.momentTileFade`. */
  fadeHeight?: number;
  /** Caption at the bottom left, over the fade (e.g. "#ootd"). Already translated. */
  label?: string;
  labelVariant?: TextVariant;
  labelWeight?: FontWeight;
  /** Corner slots for pills and badges (time, lock, "Added later"). */
  topLeft?: ReactNode;
  topRight?: ReactNode;
  /** Blurs the photo, e.g. while it is being checked. */
  blurred?: boolean;
  /** Tint over the whole photo behind `children` (upload states). */
  overlayColor?: keyof typeof colors;
  /** Centered overlay content (upload states). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** A photo with a bottom fade, an optional caption and corner slots. Used by MomentTile, Story and jar cards. */
export function PhotoTile({
  uri,
  photoView,
  alt,
  height,
  radius = radii.tile,
  fadeHeight = sizes.momentTileFade,
  label,
  labelVariant = 'body',
  labelWeight = '700',
  topLeft,
  topRight,
  blurred = false,
  overlayColor,
  children,
  style,
  testID,
}: PhotoTileProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.tile,
        { borderRadius: radius },
        height === undefined ? { aspectRatio: photo.aspect } : { minHeight: height },
        style,
      ]}
    >
      {photoView ? (
        photoView
      ) : uri ? (
        <Image
          testID="photo-tile-image"
          source={photoSource(uri)}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={blurred ? photo.checkingBlur : undefined}
          accessible={alt !== undefined}
          accessibilityRole={alt !== undefined ? 'image' : undefined}
          accessibilityLabel={alt}
          accessibilityElementsHidden={alt === undefined}
          importantForAccessibility={alt !== undefined ? 'yes' : 'no-hide-descendants'}
        />
      ) : null}
      {overlayColor ? (
        <View
          testID="photo-tile-overlay"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors[overlayColor] }]}
        />
      ) : null}
      <LinearGradient
        testID="photo-tile-fade"
        colors={[colors.photoFadeClear, colors.photoFade]}
        pointerEvents="none"
        style={[styles.fade, { height: fadeHeight }]}
      />
      {children ? <View style={styles.overlay}>{children}</View> : null}
      {topLeft || topRight ? (
        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.corner}>{topLeft}</View>
          <View style={styles.corner}>{topRight}</View>
        </View>
      ) : null}
      {label ? (
        <Text
          maxFontSizeMultiplier={maxTextScale.tile}
          style={[textStyle(labelVariant, labelWeight), styles.label]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
  },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.sm,
  },
  top: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    right: space.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  corner: { flexDirection: 'row', gap: space.xs },
  label: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.sm,
    color: colors.surface,
    textShadowColor: colors.textShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
