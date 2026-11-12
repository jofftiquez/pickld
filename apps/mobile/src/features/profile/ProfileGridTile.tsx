import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { PhotoTile } from '@/components/PhotoTile';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type ProfileGridTileProps = {
  uri: string | null;
  width: number;
  /** First line over the fade, e.g. "Nov 8" or "#ootd". Already translated. */
  title: string;
  /** Optional second line, e.g. "8/8". */
  detail?: string;
  /** Spoken name for the whole tile. Already translated. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress?: () => void;
  testID?: string;
};

/** A 3:4 tile in a profile's Jars or Moments grid (Profile): photo, dark fade, one or two lines of white text. */
export function ProfileGridTile({
  uri,
  width,
  title,
  detail,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  testID,
}: ProfileGridTileProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ width }, pressed && onPress ? { opacity: PRESSED_OPACITY } : null]}
      testID={testID}
    >
      <PhotoTile uri={uri} radius={radius.thumbLg} fadeHeight={sizes.profileTileFade}>
        <View style={styles.text} pointerEvents="none">
          <Text style={[textStyle('label', '700'), { color: colors.surface }]} numberOfLines={1}>
            {title}
          </Text>
          {detail ? (
            <Text style={[textStyle('caption', '600'), { color: colors.surface }]} numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
      </PhotoTile>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm - 1 },
});
