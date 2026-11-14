import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type StoryAvatarProps = {
  name: string;
  /** Short label under the ring (first name, or "You"). Already translated. */
  label: string;
  uri: string | null;
  /** Green ring: the author has a jar the reader hasn't seen. */
  isNew: boolean;
  /** Spoken label, e.g. "Mika Reyes, new jar". Already translated. */
  accessibilityLabel: string;
  /** Opens the profile; without it the avatar isn't pressable. */
  onPress?: () => void;
  testID?: string;
};

/** An author in the Jars avatar row (design: Feed): photo inside a ring, green when there is a new jar. */
export function StoryAvatar({ name, label, uri, isNew, accessibilityLabel, onPress, testID }: StoryAvatarProps) {
  const ring = isNew ? (
    <LinearGradient
      colors={[colors.brand, colors.storyRingNew]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.storyRingSeen }]} />
  );
  const body = (
    <>
      <View style={styles.ring} testID={testID ? `${testID}-${isNew ? 'new' : 'seen'}` : undefined}>
        {ring}
        <View style={styles.gap}>
          <Avatar name={name} uri={uri} decorative size="story" />
        </View>
      </View>
      {/* A first name under a 64-point ring: past 1.3× it shrank to one letter ("M…"), so it stops there like
          tile labels (D-37). The spoken label has the full name. */}
      <Text
        style={[textStyle('caption', '600'), styles.label]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxTextScale.tile}
      >
        {label}
      </Text>
    </>
  );
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.item}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} accessible accessibilityLabel={accessibilityLabel} style={styles.item}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: space.xs, width: sizes.storyAvatar },
  ring: {
    width: sizes.storyAvatar,
    height: sizes.storyAvatar,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gap: {
    width: sizes.storyAvatar - 2 * sizes.storyRing,
    height: sizes.storyAvatar - 2 * sizes.storyRing,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.inkSoft, maxWidth: sizes.storyAvatar },
});
