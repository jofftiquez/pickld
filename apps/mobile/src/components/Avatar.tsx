import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

export type AvatarSize = 'sm' | 'feed' | 'header' | 'story' | 'md' | 'lg' | 'edit' | 'xl';

export type AvatarProps = {
  /** Display name: the accessible label, and the initials when there is no photo. */
  name: string;
  uri?: string | null;
  size?: AvatarSize;
  /** White ring and shadow, for profile headers over a cover photo. */
  ring?: boolean;
  /** Hide from screen readers when the name is already read next to it. */
  decorative?: boolean;
  testID?: string;
};

const diameter: Record<AvatarSize, number> = {
  sm: sizes.avatarSm,
  feed: sizes.feedAvatar,
  header: sizes.avatarHeader,
  // Inside the Jars avatar row's ring and its gap (design: Feed).
  story: sizes.storyAvatar - 2 * (sizes.storyRing + sizes.storyGap),
  md: sizes.avatarMd,
  lg: sizes.avatarLg,
  edit: sizes.avatarEdit,
  xl: sizes.avatarXl,
};

/** Up to two initials, e.g. "Mika Reyes" → "MR". */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase();
}

/** Round profile photo, with initials on brand tint when there is no photo. */
export function Avatar({ name, uri, size = 'md', ring = false, decorative = false, testID }: AvatarProps) {
  const d = diameter[size];
  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : name}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={decorative}
      style={[styles.circle, { width: d, height: d }, ring ? styles.ring : null]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      ) : (
        // Fixed inside a fixed circle, so it doesn't scale with system text; the name is the label.
        <Text
          allowFontScaling={false}
          style={[textStyle('label', '800'), { fontSize: Math.round(d * 0.38), color: colors.brandText }]}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ring: {
    borderWidth: sizes.avatarRing,
    borderColor: colors.surface,
  },
});
