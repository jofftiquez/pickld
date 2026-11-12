import { StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, stickerTool } from '@/theme/tokens';

export type StampStickerProps = {
  /** The live value, e.g. "2:14 PM". */
  text: string;
  width: number;
  height: number;
  testID?: string;
};

const s = stickerTool.stamp;

/**
 * An auto stamp drawn in the style of its art (stickers/stamps): the value on a white label with an ink
 * border inside a dashed ring. Part of the picture, so it scales with the overlay, not the text size.
 */
export function StampSticker({ text, width, height, testID }: StampStickerProps) {
  return (
    <View
      style={[
        styles.ring,
        { width, height, borderWidth: Math.max(1, s.ring * height), borderRadius: (s.radius + s.inset) * height },
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.label,
          {
            margin: s.inset * height,
            borderWidth: Math.max(1, s.border * height),
            borderRadius: s.radius * height,
            paddingHorizontal: s.padding * height,
          },
        ]}
      >
        {/* a11y-fixed-size: part of the sticker artwork, scaled with the sticker */}
        <Text
          style={[textStyle('body', '800'), styles.text, { fontSize: s.text * height }]}
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderStyle: 'dashed', borderColor: colors.ink },
  label: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.ink,
  },
  text: { color: colors.ink },
});
