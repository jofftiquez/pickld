import type { SkImage } from '@shopify/react-native-skia';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { FilteredPhoto } from './FilteredPhoto';
import type { ColorMatrix } from './filters';

export type FilterThumbnailProps = {
  /** Already translated, e.g. "Kalamansi". */
  label: string;
  image: SkImage | null;
  matrix: ColorMatrix;
  selected: boolean;
  onPress: () => void;
  /** The thumbnail square; the editor sizes it so the row ends on half a thumbnail (filterRow.ts). */
  size?: number;
  testID?: string;
};

/** A filter choice previewing the real photo, with a green ring when selected (Capture). */
export function FilterThumbnail({
  label,
  image,
  matrix,
  selected,
  onPress,
  size = sizes.filterThumb,
  testID,
}: FilterThumbnailProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      testID={testID}
      // A fixed width, so the row's layout (filterRow.ts) doesn't depend on the label's length or weight.
      style={[styles.root, { width: size + 2 * (sizes.filterRing + sizes.filterRingGap) }]}
    >
      {/* The ring is always laid out so choosing a filter doesn't shift the row. */}
      <View style={[styles.ring, selected ? styles.ringSelected : null]}>
        <View style={[styles.thumb, { width: size, height: size }]}>
          <FilteredPhoto image={image} matrix={matrix} width={size} height={size} />
        </View>
      </View>
      <Text style={[textStyle('label', selected ? '700' : '500'), styles.label]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Thumbnail plus ring is about 68 px wide, above the 44 px minimum tap size.
  root: { alignItems: 'center', gap: space.xs },
  ring: {
    padding: sizes.filterRingGap,
    borderWidth: sizes.filterRing,
    borderColor: colors.surface, // the panel's own white, so the ring is invisible until selected
    borderRadius: radius.filterThumb + sizes.filterRingGap + sizes.filterRing,
  },
  ringSelected: { borderColor: colors.brand },
  thumb: {
    borderRadius: radius.filterThumb,
    overflow: 'hidden',
    backgroundColor: colors.editorPhoto,
  },
  label: { color: colors.ink, textAlign: 'center' },
});
