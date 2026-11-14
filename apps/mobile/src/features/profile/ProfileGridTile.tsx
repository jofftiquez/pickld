import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { PhotoTile } from '@/components/PhotoTile';
import type { Edits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import { MomentCover } from '@/features/moment/MomentCover';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

export type ProfileGridTileProps = {
  uri: string | null;
  /** The moment's edits (D-96): drawn over the photo when it has any, else the plain thumbnail. */
  edits?: Edits;
  /** What its auto stamps show (capture time in the jar's zone). */
  stamp?: StampMoment | null;
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

/** A 3:4 tile in a profile's Jars or Moments grid (Profile): photo with its edits (D-96), dark fade, one or two lines of white text. */
export function ProfileGridTile({
  uri,
  edits,
  stamp = null,
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
      <PhotoTile
        uri={uri}
        photoView={
          uri !== null && edits && hasVisibleEdits(edits) ? (
            <MomentCover
              uri={uri}
              edits={edits}
              stamp={stamp}
              accessible={false}
              testID={`${testID ?? 'profile-tile'}-moment`}
            />
          ) : undefined
        }
        radius={radius.thumbLg}
        fadeHeight={sizes.profileTileFade}
      >
        <View style={styles.text} pointerEvents="none">
          <Text
            maxFontSizeMultiplier={maxTextScale.tile}
            style={[textStyle('label', '700'), { color: colors.surface }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {detail ? (
            <Text
              maxFontSizeMultiplier={maxTextScale.tile}
              style={[textStyle('caption', '600'), { color: colors.surface }]}
              numberOfLines={1}
            >
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
