import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, space } from '@/theme/tokens';

export type CommentsButtonProps = {
  count: number;
  /** Pill height: 44 on the Jar page bar, 46 in Moment detail's sheet. */
  height: number;
  onPress: () => void;
  testID?: string;
};

/** The comment count pill on the Jar page and Moment detail (Story, Moment): opens Comments. */
export function CommentsButton({ count, height, onPress, testID }: CommentsButtonProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('jarPage.comments', { count })}
      accessibilityHint={t('jarPage.openComments')}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, height)}
      style={[styles.pill, { height }, pressed ? { opacity: PRESSED_OPACITY } : null]}
      testID={testID}
    >
      <Icon name="comment" color="ink" size={16} strokeWidth={2} />
      <Text style={[textStyle('bodyMedium', '600'), { color: colors.ink }]}>{count}</Text>
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
    backgroundColor: colors.subtle,
  },
});
