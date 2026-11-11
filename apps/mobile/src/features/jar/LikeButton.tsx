import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, space } from '@/theme/tokens';

export type LikeButtonProps = {
  count: number;
  liked: boolean;
  /** Pill height: 44 on the Jar page bar, 46 in Moment detail's sheet. */
  height: number;
  onPress: () => void;
  testID?: string;
};

/** The like count pill on the Jar page and Moment detail (Story, Moment; FR-SOC-05): a filled heart once liked. */
export function LikeButton({ count, liked, height, onPress, testID }: LikeButtonProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('jarPage.likes', { count })}
      accessibilityHint={liked ? t('jarPage.unlikeHint') : t('jarPage.likeHint')}
      accessibilityState={{ selected: liked }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, height)}
      style={[styles.pill, { height }, pressed ? { opacity: PRESSED_OPACITY } : null]}
      testID={testID}
    >
      <Icon name="heart" color="likeText" size={16} strokeWidth={2.2} filled={liked} />
      <Text style={[textStyle('bodyMedium', '700'), { color: colors.likeText }]}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerTint,
  },
});
